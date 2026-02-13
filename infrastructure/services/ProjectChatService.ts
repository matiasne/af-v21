import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionCallingMode,
  FunctionDeclaration,
} from "@google/generative-ai";

import {
  RAGRepository,
  RAGSearchResult,
} from "@/domain/repositories/RAGRepository";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProjectContext {
  name: string;
  description?: string;
  status: string;
  githubUrl?: string;
}

export interface MigrationContext {
  currentStep?: string;
  isProcessing?: boolean;
  isCompleted?: boolean;
  techStack?: string[];
  ragStoreName?: string;
}

export interface ProjectChatRequest {
  messages: ChatMessage[];
  projectContext?: ProjectContext;
  migrationContext?: MigrationContext;
}

export interface ProjectChatResponse {
  message: ChatMessage;
}

// Define the search tool for function calling
const searchProjectFilesTool: FunctionDeclaration = {
  name: "search_project_files",
  description:
    "Search for information in the project's analyzed files. Use this tool when the user asks about specific files, business logic, functional details, code structure, or any technical details about their project. This searches through the functional and business analysis of the project files.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description:
          "The search query to find relevant information in the project files. Be specific about what you're looking for.",
      },
    },
    required: ["query"],
  },
};

export class ProjectChatService {
  private genAI: GoogleGenerativeAI;
  private ragRepository: RAGRepository;

  constructor(apiKey: string, ragRepository: RAGRepository) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.ragRepository = ragRepository;
  }

  private buildSystemPrompt(
    projectContext?: ProjectContext,
    migrationContext?: MigrationContext,
    hasRagAccess?: boolean,
  ): string {
    return `You are an intelligent AI assistant
provide insights about their codebase analysis, and assist with any project-related queries.

${
  projectContext
    ? `Current Project Context:
- Project Name: ${projectContext.name}
- Description: ${projectContext.description || "No description provided"}
- Current Status: ${projectContext.status}
- GitHub URL: ${projectContext.githubUrl || "Not provided"}`
    : ""
}

${
  migrationContext
    ? `Migration Context:
- Current Step: ${migrationContext.currentStep || "Not started"}
- Processing: ${migrationContext.isProcessing ? "Yes" : "No"}
- Completed: ${migrationContext.isCompleted ? "Yes" : "No"}
- Target Tech Stack: ${migrationContext.techStack?.join(", ") || "Not defined"}`
    : ""
}

${
  hasRagAccess
    ? `IMPORTANT: You have access to the project's analyzed files through the search_project_files tool.
When the user asks about:
- Specific files in the project
- Business logic or requirements
- Functional details or code structure
- How certain features work
- Technical implementation details
- Any specific aspect of the codebase

You MUST use the search_project_files tool to find accurate information before answering.
Always search for relevant information when the question is about the project's code or functionality.`
    : ""
}

Guidelines for your responses:
1. Be helpful, concise, and professional
2. If asked about project status, reference the context provided
3. For technical questions about the project, USE THE SEARCH TOOL to find accurate information
4. If you don't have enough information, ask clarifying questions
5. Help users understand the migration process and next steps
6. Provide actionable suggestions when appropriate
7. Keep responses focused and avoid unnecessary verbosity
8. When showing search results, synthesize them into a coherent answer

You can help with:
- Understanding project
- Providing guidance on next steps
- General software development questions
- Troubleshooting and debugging suggestions
- Explaining specific files and their functionality (when search is available)
- Understanding business logic and requirements from the codebase`;
  }

  private formatSearchResults(results: RAGSearchResult[]): string {
    if (results.length === 0) {
      return "No relevant information found in the project files.";
    }

    return results
      .map(
        (result) =>
          `[Relevance: ${(result.relevanceScore * 100).toFixed(1)}%]\n${result.content}`,
      )
      .join("\n\n---\n\n");
  }

  async chat(request: ProjectChatRequest): Promise<ProjectChatResponse> {
    const { messages, projectContext, migrationContext } = request;

    // Get RAG store name from migration context (passed from client)
    const ragStoreName = migrationContext?.ragStoreName || null;

    // Configure model with tools if RAG store is available
    const modelConfig: {
      model: string;
      tools?: { functionDeclarations: FunctionDeclaration[] }[];
      toolConfig?: { functionCallingConfig: { mode: FunctionCallingMode } };
    } = {
      model: "gemini-2.0-flash-exp",
    };

    if (ragStoreName) {
      modelConfig.tools = [
        {
          functionDeclarations: [searchProjectFilesTool],
        },
      ];
      modelConfig.toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingMode.AUTO,
        },
      };
    }

    const model = this.genAI.getGenerativeModel(modelConfig);

    const systemPrompt = this.buildSystemPrompt(
      projectContext,
      migrationContext,
      !!ragStoreName,
    );

    // Convert chat history to Gemini format
    const history = messages.slice(0, -1).map((msg: ChatMessage) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: systemPrompt }],
        },
        {
          role: "model",
          parts: [
            {
              text: "I understand. I'm ready to help with your project and migration. How can I assist you today?",
            },
          ],
        },
        ...history,
      ],
    });

    // Get the last message (the current user message)
    const lastMessage = messages[messages.length - 1];

    let result = await chat.sendMessage(lastMessage.content);
    let response = result.response;

    // Handle function calls
    let functionCall = response.functionCalls()?.[0];
    let iterations = 0;
    const maxIterations = 3;

    console.log("Function call loop start", functionCall);

    while (functionCall && iterations < maxIterations) {
      iterations++;

      if (functionCall.name === "search_project_files" && ragStoreName) {
        const query = (functionCall.args as { query?: string })?.query;

        if (query) {
          const searchResults = await this.ragRepository.searchFiles(
            query,
            ragStoreName,
          );
          const formattedResults = this.formatSearchResults(searchResults);

          // Send the function response back to the model
          result = await chat.sendMessage([
            {
              functionResponse: {
                name: "search_project_files",
                response: {
                  results: formattedResults,
                },
              },
            },
          ]);
          response = result.response;
          functionCall = response.functionCalls()?.[0];
        } else {
          break;
        }
      } else {
        break;
      }
    }

    const responseText = response.text();

    return {
      message: {
        role: "assistant",
        content: responseText,
      },
    };
  }
}
