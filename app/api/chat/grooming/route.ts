import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FirebaseRAGRepository } from "@/infrastructure/repositories/FirebaseRAGRepository";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  category: "backend" | "frontend" | "database" | "integration" | "api";
  priority: "high" | "medium" | "low";
  cleanArchitectureArea: "domain" | "application" | "infrastructure" | "presentation";
  acceptanceCriteria: string[];
  epicId?: string;
}

interface SuggestedEpic {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  taskIds: string[];
}

export interface GroomingResponse {
  message: ChatMessage;
  suggestedTasks: SuggestedTask[];
  suggestedEpics: SuggestedEpic[];
}

export async function POST(request: NextRequest) {
  try {
    const { messages, projectContext, existingTasks, documentContent, documentName, documentContext, ragStoreName } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 },
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Search for similar tasks in RAG if storage name is provided
    let ragSearchResults = "";
    if (ragStoreName) {
      try {
        const ragRepository = new FirebaseRAGRepository(apiKey);
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === "user") {
          const searchResults = await ragRepository.searchFiles(lastMessage.content, ragStoreName);
          if (searchResults.length > 0) {
            ragSearchResults = `
SIMILAR EXISTING TASKS/CONTEXT FOUND IN PROJECT (from RAG search):
---
${searchResults.map((result, index) => `[Result ${index + 1}] (relevance: ${(result.relevanceScore * 100).toFixed(1)}%)
${result.content}`).join("\n\n")}
---

IMPORTANT: Review the above search results to check if similar tasks already exist in the project. If you find existing tasks that are similar to what the user is asking for:
1. Mention to the user that similar tasks may already exist
2. Explain what you found and how it relates to their request
3. Only suggest NEW tasks that are genuinely different from existing ones
4. If the user's request is already covered by existing tasks, let them know instead of creating duplicates
`;
          }
        }
      } catch (error) {
        console.error("Error searching RAG:", error);
        // Continue without RAG results if search fails
      }
    }

    // Build document context section
    let documentSection = "";
    if (documentContent && documentName) {
      documentSection = `
UPLOADED DOCUMENT "${documentName}":
---
${documentContent.slice(0, 50000)}
---

IMPORTANT: The user has uploaded a document. Analyze it thoroughly and extract ALL relevant tasks, requirements, user stories, or features mentioned in it. Create well-structured tasks for each item found in the document.
`;
    } else if (documentContext) {
      documentSection = `
REFERENCE DOCUMENTS (previously uploaded):
---
${documentContext.slice(0, 50000)}
---

Use these documents as context when the user asks questions or requests tasks related to them.
`;
    }

    const systemPrompt = `You are an AI assistant helping a software team during their grooming session. Your role is to help them break down features, improvements, and bugs into well-defined, actionable tasks.

${
  projectContext
    ? `Project context:
- Project Name: ${projectContext.name}
- Description: ${projectContext.description || "No description"}
- Tech Stack: ${projectContext.techStack?.join(", ") || "Not specified"}`
    : ""
}
${ragSearchResults}
${documentSection}
${
  existingTasks && existingTasks.length > 0
    ? `Tasks already suggested in this session (do not repeat these):
${existingTasks.map((t: SuggestedTask) => `- ${t.title}`).join("\n")}`
    : ""
}
${
  existingTasks?.existingEpics && existingTasks.existingEpics.length > 0
    ? `Epics already suggested in this session (do not repeat these):
${existingTasks.existingEpics.map((e: SuggestedEpic) => `- ${e.title}`).join("\n")}`
    : ""
}

Your responsibilities:
1. Listen to what the user wants to build or improve
2. Ask clarifying questions to understand the requirements better
3. Suggest well-structured tasks that can be added to the backlog
4. Help break down large features into smaller, manageable tasks
5. Ensure tasks have clear acceptance criteria
6. Group related tasks into epics when appropriate

IMPORTANT: You MUST respond with a JSON object in the following format:
{
  "response": "Your conversational response to the user. Be helpful, ask clarifying questions when needed, and summarize what tasks and epics you're suggesting.",
  "suggestedTasks": [
    {
      "id": "unique-task-id",
      "title": "Clear, concise task title",
      "description": "Detailed description of what needs to be done",
      "category": "backend|frontend|database|integration|api",
      "priority": "high|medium|low",
      "cleanArchitectureArea": "domain|application|infrastructure|presentation",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
      "epicId": "optional-epic-id-if-task-belongs-to-an-epic"
    }
  ],
  "suggestedEpics": [
    {
      "id": "unique-epic-id",
      "title": "Epic title describing a major feature or initiative",
      "description": "Detailed description of the epic's goals and scope",
      "priority": "high|medium|low",
      "taskIds": ["task-id-1", "task-id-2"]
    }
  ]
}

Guidelines for creating tasks:
- Each task should be completable in 1-3 days of work
- Title should be action-oriented (e.g., "Implement user authentication endpoint")
- Description should explain the WHY and WHAT, not just HOW
- Include 2-5 acceptance criteria per task
- Choose the most appropriate category and architecture layer
- Use unique IDs (e.g., "task-1", "task-2", or more descriptive like "auth-login-endpoint")
- If a task belongs to an epic, include the epicId field referencing the epic's id

Guidelines for creating epics:
- An epic represents a major feature, initiative, or body of work
- Group 3-10 related tasks under an epic
- Title should describe the overall goal (e.g., "User Authentication System")
- Description should explain the business value and scope
- Use unique IDs (e.g., "epic-1", "epic-auth-system")
- Include taskIds array referencing all tasks that belong to this epic
- Only create epics when there are multiple related tasks that logically belong together

Categories:
- backend: Server-side logic, business rules, services
- frontend: UI components, user interactions, styling
- database: Data models, migrations, queries
- integration: Third-party services, APIs, webhooks
- api: API endpoints, REST/GraphQL design

Architecture Layers:
- domain: Core business entities and rules
- application: Use cases, orchestration, business logic
- infrastructure: External services, databases, frameworks
- presentation: UI, controllers, API handlers

Only suggest tasks when you have enough information. If the user's request is vague, ask questions first before suggesting tasks.

Always respond with valid JSON only. No additional text before or after the JSON.`;

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
              text: JSON.stringify({
                response:
                  "I'm ready to help you with your grooming session. Tell me about the features, improvements, or bugs you'd like to work on, and I'll help you break them down into actionable tasks and epics.",
                suggestedTasks: [],
                suggestedEpics: [],
              }),
            },
          ],
        },
        ...history,
      ],
    });

    // Get the last message (the current user message)
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 },
      );
    }

    const result = await chat.sendMessage(lastMessage.content);
    const responseText = result.response.text();

    // Parse the JSON response
    let parsedResponse: {
      response: string;
      suggestedTasks: SuggestedTask[];
      suggestedEpics: SuggestedEpic[];
    };

    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch {
      // If parsing fails, return the raw response with empty tasks
      console.error("Failed to parse JSON response:", responseText);
      parsedResponse = {
        response: responseText,
        suggestedTasks: [],
        suggestedEpics: [],
      };
    }

    // Validate and sanitize suggested tasks
    const validatedTasks = (parsedResponse.suggestedTasks || []).map((task, index) => ({
      id: task.id || `task-${Date.now()}-${index}`,
      title: task.title || "Untitled Task",
      description: task.description || "",
      category: ["backend", "frontend", "database", "integration", "api"].includes(task.category)
        ? task.category
        : "backend",
      priority: ["high", "medium", "low"].includes(task.priority) ? task.priority : "medium",
      cleanArchitectureArea: ["domain", "application", "infrastructure", "presentation"].includes(
        task.cleanArchitectureArea
      )
        ? task.cleanArchitectureArea
        : "infrastructure",
      acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
      epicId: task.epicId || undefined,
    }));

    // Validate and sanitize suggested epics
    const validatedEpics = (parsedResponse.suggestedEpics || []).map((epic, index) => ({
      id: epic.id || `epic-${Date.now()}-${index}`,
      title: epic.title || "Untitled Epic",
      description: epic.description || "",
      priority: ["high", "medium", "low"].includes(epic.priority) ? epic.priority : "medium",
      taskIds: Array.isArray(epic.taskIds) ? epic.taskIds : [],
    }));

    return NextResponse.json({
      message: {
        role: "assistant",
        content: parsedResponse.response,
      },
      suggestedTasks: validatedTasks,
      suggestedEpics: validatedEpics,
    } as GroomingResponse);
  } catch (error) {
    console.error("Grooming chat API error:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
