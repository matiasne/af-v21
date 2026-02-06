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

// Define the search tool for OpenRouter (OpenAI-compatible format)
const searchProjectFilesTool = {
  type: "function" as const,
  function: {
    name: "search_project_files",
    description:
      "Search for information in the project's analyzed files. Use this tool when the user asks about specific files, business logic, functional details, code structure, or any technical details about their project. This searches through the functional and business analysis of the project files.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The search query to find relevant information in the project files. Be specific about what you're looking for.",
        },
      },
      required: ["query"],
    },
  },
};

export class ProjectChatService {
  private apiKey: string;
  private ragRepository: RAGRepository;

  constructor(apiKey: string, ragRepository: RAGRepository) {
    this.apiKey = apiKey;
    this.ragRepository = ragRepository;
  }

  private buildSystemPrompt(
    projectContext?: ProjectContext,
    migrationContext?: MigrationContext,
    hasRagAccess?: boolean
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
          `[Relevance: ${(result.relevanceScore * 100).toFixed(1)}%]\n${result.content}`
      )
      .join("\n\n---\n\n");
  }

  async chat(request: ProjectChatRequest): Promise<ProjectChatResponse> {
    const {
      messages,
      projectContext,
      migrationContext,
    } = request;

    // Get RAG store name from migration context (passed from client)
    const ragStoreName = migrationContext?.ragStoreName || null;

    const systemPrompt = this.buildSystemPrompt(
      projectContext,
      migrationContext,
      !!ragStoreName
    );

    // Build messages for OpenRouter
    const chatMessages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      tool_call_id?: string;
    }> = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "assistant",
        content: "I understand. I'm ready to help with your project and migration. How can I assist you today?",
      },
      ...messages.map((msg: ChatMessage) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Prepare request body
    const requestBody: {
      model: string;
      messages: typeof chatMessages;
      temperature: number;
      max_tokens: number;
      tools?: typeof searchProjectFilesTool[];
      tool_choice?: string;
    } = {
      model: "anthropic/claude-3.5-sonnet",
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    // Add tools if RAG store is available
    if (ragStoreName) {
      requestBody.tools = [searchProjectFilesTool];
      requestBody.tool_choice = "auto";
    }

    // Call OpenRouter API
    let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Project Chat Assistant",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      throw new Error("Failed to get response from OpenRouter");
    }

    let data = await response.json();
    let assistantMessage = data.choices?.[0]?.message;

    // Handle tool calls
    let iterations = 0;
    const maxIterations = 3;

    while (assistantMessage?.tool_calls && iterations < maxIterations) {
      iterations++;

      const toolCall = assistantMessage.tool_calls[0];

      if (toolCall.function.name === "search_project_files" && ragStoreName) {
        const args = JSON.parse(toolCall.function.arguments);
        const query = args.query;

        if (query) {
          const searchResults = await this.ragRepository.searchFiles(
            query,
            ragStoreName
          );
          const formattedResults = this.formatSearchResults(searchResults);

          // Add assistant message with tool call and tool response
          chatMessages.push({
            role: "assistant",
            content: assistantMessage.content || "",
            ...({ tool_calls: assistantMessage.tool_calls } as Record<string, unknown>),
          } as typeof chatMessages[number]);

          chatMessages.push({
            role: "tool",
            content: formattedResults,
            tool_call_id: toolCall.id,
          });

          // Make another request with the tool response
          response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
              "X-Title": "Project Chat Assistant",
            },
            body: JSON.stringify({
              ...requestBody,
              messages: chatMessages,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter API error:", errorText);
            throw new Error("Failed to get response from OpenRouter");
          }

          data = await response.json();
          assistantMessage = data.choices?.[0]?.message;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    const responseText = assistantMessage?.content || "";

    return {
      message: {
        role: "assistant",
        content: responseText,
      },
    };
  }
}
