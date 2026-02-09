import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { graphRAGService } from "@/application/services/GraphRAGService";
import { ragRepository } from "@/infrastructure/repositories/PineconeRAGRepository";

/**
 * Detect dependencies from task content using pattern matching
 */
function detectDependenciesFromContent(content: string): { dependsOn: string[]; blocks: string[] } {
  const dependsOn: string[] = [];
  const blocks: string[] = [];

  // DEPENDS_ON patterns
  const dependsOnPatterns = [
    /depends on ["`']?([^"`'\n.]+)["`']?/gi,
    /requires ["`']?([^"`'\n.]+)["`']?/gi,
    /after ["`']?([^"`'\n.]+)["`']? is (done|completed|finished)/gi,
    /needs ["`']?([^"`'\n.]+)["`']? first/gi,
    /blocked by ["`']?([^"`'\n.]+)["`']?/gi,
    /waiting for ["`']?([^"`'\n.]+)["`']?/gi,
    /prerequisite:?\s*["`']?([^"`'\n.]+)["`']?/gi,
  ];

  for (const pattern of dependsOnPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const reference = match[1].trim();
      if (reference.length > 3 && reference.length < 100) {
        dependsOn.push(reference);
      }
    }
  }

  // BLOCKS patterns
  const blocksPatterns = [
    /blocks ["`']?([^"`'\n.]+)["`']?/gi,
    /is required for ["`']?([^"`'\n.]+)["`']?/gi,
    /must be done before ["`']?([^"`'\n.]+)["`']?/gi,
    /prerequisite for ["`']?([^"`'\n.]+)["`']?/gi,
  ];

  for (const pattern of blocksPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const reference = match[1].trim();
      if (reference.length > 3 && reference.length < 100) {
        blocks.push(reference);
      }
    }
  }

  return { dependsOn, blocks };
}

/**
 * Find dependencies for suggested tasks by:
 * 1. Searching existing tasks in the project (via Pinecone)
 * 2. Finding relationships between the suggested tasks themselves
 */
async function findTaskDependencies(
  tasks: SuggestedTask[],
  ragStoreName: string | undefined
): Promise<Map<string, { dependsOn: TaskDependency[]; blocks: TaskDependency[] }>> {
  const dependencyMap = new Map<string, { dependsOn: TaskDependency[]; blocks: TaskDependency[] }>();

  // Initialize dependency arrays for each task
  for (const task of tasks) {
    dependencyMap.set(task.id, { dependsOn: [], blocks: [] });
  }

  // Create a lookup map for suggested tasks by title (lowercase for matching)
  const suggestedTasksByTitle = new Map<string, SuggestedTask>();
  for (const task of tasks) {
    suggestedTasksByTitle.set(task.title.toLowerCase(), task);
  }

  for (const task of tasks) {
    const taskContent = `${task.title}\n${task.description}\n${task.acceptanceCriteria.join("\n")}`;
    const detected = detectDependenciesFromContent(taskContent);
    const taskDeps = dependencyMap.get(task.id)!;

    // Process DEPENDS_ON references
    for (const reference of detected.dependsOn) {
      const refLower = reference.toLowerCase();

      // First check if it matches another suggested task
      let foundInSuggested = false;
      const suggestedEntries = Array.from(suggestedTasksByTitle.entries());
      for (const [title, suggestedTask] of suggestedEntries) {
        if (suggestedTask.id !== task.id && (title.includes(refLower) || refLower.includes(title))) {
          taskDeps.dependsOn.push({
            taskId: suggestedTask.id,
            taskTitle: suggestedTask.title,
            type: "DEPENDS_ON",
            isExisting: false,
          });
          foundInSuggested = true;
          break;
        }
      }

      // If not found in suggested tasks, search in existing tasks via Pinecone
      if (!foundInSuggested && ragStoreName) {
        try {
          const searchResults = await ragRepository.searchFiles(reference, ragStoreName);
          const bestMatch = searchResults.find((r) => r.relevanceScore > 0.6);
          if (bestMatch) {
            // Extract task title from content (first line usually contains "Task: title")
            const titleMatch = bestMatch.content.match(/Task:\s*(.+)/);
            const matchedTitle = titleMatch ? titleMatch[1].trim() : bestMatch.id;

            taskDeps.dependsOn.push({
              taskId: bestMatch.id,
              taskTitle: matchedTitle,
              type: "DEPENDS_ON",
              isExisting: true,
            });
          }
        } catch (error) {
          console.error("[Grooming API] Error searching for dependency:", error);
        }
      }
    }

    // Process BLOCKS references
    for (const reference of detected.blocks) {
      const refLower = reference.toLowerCase();

      // First check if it matches another suggested task
      let foundInSuggested = false;
      const suggestedEntriesForBlocks = Array.from(suggestedTasksByTitle.entries());
      for (const [title, suggestedTask] of suggestedEntriesForBlocks) {
        if (suggestedTask.id !== task.id && (title.includes(refLower) || refLower.includes(title))) {
          taskDeps.blocks.push({
            taskId: suggestedTask.id,
            taskTitle: suggestedTask.title,
            type: "BLOCKS",
            isExisting: false,
          });
          foundInSuggested = true;
          break;
        }
      }

      // If not found in suggested tasks, search in existing tasks via Pinecone
      if (!foundInSuggested && ragStoreName) {
        try {
          const searchResults = await ragRepository.searchFiles(reference, ragStoreName);
          const bestMatch = searchResults.find((r) => r.relevanceScore > 0.6);
          if (bestMatch) {
            const titleMatch = bestMatch.content.match(/Task:\s*(.+)/);
            const matchedTitle = titleMatch ? titleMatch[1].trim() : bestMatch.id;

            taskDeps.blocks.push({
              taskId: bestMatch.id,
              taskTitle: matchedTitle,
              type: "BLOCKS",
              isExisting: true,
            });
          }
        } catch (error) {
          console.error("[Grooming API] Error searching for blocker:", error);
        }
      }
    }
  }

  // Also detect implicit dependencies based on task ordering and categories
  // Tasks in the same epic or with related categories might have dependencies
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const taskDeps = dependencyMap.get(task.id)!;

    // Database tasks often need to be done before backend tasks
    if (task.category === "backend") {
      for (const otherTask of tasks) {
        if (otherTask.id !== task.id && otherTask.category === "database" && task.epicId && task.epicId === otherTask.epicId) {
          // Check if this dependency already exists
          if (!taskDeps.dependsOn.find((d) => d.taskId === otherTask.id)) {
            taskDeps.dependsOn.push({
              taskId: otherTask.id,
              taskTitle: otherTask.title,
              type: "DEPENDS_ON",
              isExisting: false,
            });
          }
        }
      }
    }

    // Frontend tasks often depend on backend/API tasks
    if (task.category === "frontend") {
      for (const otherTask of tasks) {
        if (otherTask.id !== task.id && (otherTask.category === "backend" || otherTask.category === "api") && task.epicId && task.epicId === otherTask.epicId) {
          if (!taskDeps.dependsOn.find((d) => d.taskId === otherTask.id)) {
            taskDeps.dependsOn.push({
              taskId: otherTask.id,
              taskTitle: otherTask.title,
              type: "DEPENDS_ON",
              isExisting: false,
            });
          }
        }
      }
    }
  }

  return dependencyMap;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Dependency between tasks
export interface TaskDependency {
  taskId: string;
  taskTitle: string;
  type: "DEPENDS_ON" | "BLOCKS";
  isExisting: boolean; // true if it's an existing task in the project, false if it's a suggested task
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
  // Dependencies detected automatically or set by user
  dependsOn?: TaskDependency[];
  blocks?: TaskDependency[];
}

interface SuggestedEpic {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  taskIds: string[];
}

export interface GraphNode {
  id: string;
  title: string;
  type: "task" | "epic";
  category?: string;
  priority?: string;
  relevanceScore?: number;
  relationships: {
    type: string;
    targetId: string;
    targetTitle: string;
    targetType: "task" | "epic";
  }[];
}

export interface GroomingResponse {
  message: ChatMessage;
  suggestedTasks: SuggestedTask[];
  suggestedEpics: SuggestedEpic[];
  graphNodes?: GraphNode[];
}

export async function POST(request: NextRequest) {
  try {
    const { messages, projectContext, existingTasks, documentContent, documentName, documentContext, ragStoreName, projectId } = await request.json();

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

    // Search for similar tasks using GraphRAG (Pinecone + Neo4j) if storage name is provided
    let ragSearchResults = "";
    let graphNodes: GraphNode[] = [];
    console.log("[Grooming API] ========== GRAPH RAG SEARCH ==========");
    console.log("[Grooming API] ragStoreName received:", ragStoreName);
    console.log("[Grooming API] projectId received:", projectId);
    if (ragStoreName && projectId) {
      try {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === "user") {
          console.log("[Grooming API] User query:", lastMessage.content);
          console.log("[Grooming API] Calling graphRAGService.search...");
          const searchResults = await graphRAGService.search(
            lastMessage.content,
            ragStoreName,
            projectId,
            { includeGraphContext: true, includeRelatedTasks: true }
          );
          console.log("[Grooming API] Search returned", searchResults.length, "results");
          console.log("[Grooming API] Results:", JSON.stringify(searchResults, null, 2));
          if (searchResults.length > 0) {
            // Use the GraphRAG service to format results with graph context
            ragSearchResults = graphRAGService.formatForLLMContext(searchResults);

            // Convert search results to graph nodes for visualization
            graphNodes = searchResults.map((result) => {
              const node: GraphNode = {
                id: result.taskId || `result-${Math.random().toString(36).slice(2, 11)}`,
                title: result.graphContext?.task?.title || result.content.split("\n")[0].replace("Task: ", ""),
                type: "task",
                category: result.graphContext?.task?.category,
                priority: result.graphContext?.task?.priority,
                relevanceScore: result.relevanceScore,
                relationships: [],
              };

              // Add relationships from graph context
              if (result.graphContext?.relationships) {
                node.relationships = result.graphContext.relationships
                  .filter((rel) => rel.relatedTask || rel.relatedEpic)
                  .map((rel) => ({
                    type: rel.type,
                    targetId: rel.relatedTask?.id || rel.relatedEpic?.id || "",
                    targetTitle: rel.relatedTask?.title || rel.relatedEpic?.title || "",
                    targetType: rel.relatedEpic ? "epic" as const : "task" as const,
                  }));
              }

              // Add related tasks as RELATED_TO relationships
              if (result.relatedTasks) {
                result.relatedTasks.forEach((relatedTask) => {
                  if (!node.relationships.find((r) => r.targetId === relatedTask.id)) {
                    node.relationships.push({
                      type: "RELATED_TO",
                      targetId: relatedTask.id,
                      targetTitle: relatedTask.title,
                      targetType: "task",
                    });
                  }
                });
              }

              return node;
            });

            console.log("[Grooming API] Graph nodes created:", graphNodes.length);
          }
        }
      } catch (error) {
        console.error("[Grooming API] Error searching GraphRAG:", error);
        // Continue without RAG results if search fails
      }
    } else {
      console.log("[Grooming API] No ragStoreName or projectId provided, skipping GraphRAG search");
    }
    console.log("[Grooming API] ========== GRAPH RAG SEARCH END ==========");

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

    // Detect dependencies for suggested tasks
    let tasksWithDependencies = validatedTasks;
    if (validatedTasks.length > 0) {
      try {
        console.log("[Grooming API] Detecting dependencies for", validatedTasks.length, "tasks");
        const dependencyMap = await findTaskDependencies(validatedTasks as SuggestedTask[], ragStoreName);

        // Add dependencies to each task
        tasksWithDependencies = validatedTasks.map((task) => {
          const deps = dependencyMap.get(task.id);
          return {
            ...task,
            dependsOn: deps?.dependsOn || [],
            blocks: deps?.blocks || [],
          };
        });

        console.log("[Grooming API] Dependencies detected successfully");
      } catch (depError) {
        console.error("[Grooming API] Error detecting dependencies:", depError);
        // Continue without dependencies if detection fails
      }
    }

    return NextResponse.json({
      message: {
        role: "assistant",
        content: parsedResponse.response,
      },
      suggestedTasks: tasksWithDependencies,
      suggestedEpics: validatedEpics,
      graphNodes: graphNodes.length > 0 ? graphNodes : undefined,
    } as GroomingResponse);
  } catch (error) {
    console.error("Grooming chat API error:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
