import { NextRequest, NextResponse } from "next/server";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface DefineTechStackResponse {
  message: ChatMessage;
  techStack: string[];
  suggestions: string[];
  isComplete: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, projectContext, currentTechStack } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 },
      );
    }

    const systemPrompt = `You are an AI assistant helping users define the target tech stack for migrating their legacy software project.

${
  projectContext
    ? `Current project context:
- Project Name: ${projectContext.name}
- Description: ${projectContext.description || "No description"}
- GitHub URL: ${projectContext.githubUrl || "Not provided"}`
    : ""
}

${
  currentTechStack && currentTechStack.length > 0
    ? `Current tech stack already selected by the user: [${currentTechStack.join(", ")}]
IMPORTANT: You MUST always include these technologies in your techStack response array. Only add new technologies discussed in the conversation, never remove existing ones unless the user explicitly asks to remove them.`
    : ""
}

Your role is to:
1. Help the user understand what technologies would be best for their migration
2. Ask clarifying questions about their requirements, team expertise, and constraints
3. Suggest modern alternatives to legacy technologies
4. Build a comprehensive tech stack based on the conversation

IMPORTANT: You MUST respond with a JSON object in the following format:
{
  "response": "Your conversational response to the user",
  "techStack": ["Technology1", "Technology2", "Technology3"],
  "suggestions": ["SuggestedTech1", "SuggestedTech2"],
  "isComplete": false
}

CRITICAL: The techStack array MUST ALWAYS contain the COMPLETE list of all technologies that have been discussed and agreed upon so far in the conversation.
You MUST return the full tech stack in EVERY response, not just new additions.
Include technologies like programming languages, frameworks, databases, cloud services, etc.
If no technologies have been defined yet, return an empty array.
If the user has already selected technologies (provided in "Current tech stack already selected"), you MUST include ALL of them plus any new ones discussed.

The suggestions array should contain technologies that you think are missing or would complement the current tech stack.
Consider what's typically needed for a complete stack (frontend, backend, database, deployment, etc.) and suggest what's not yet defined.
If the stack seems complete, return an empty array.
Limit suggestions to 3-5 most relevant technologies.

The isComplete flag should be set to true ONLY when:
1. The user has explicitly confirmed they are satisfied with the tech stack
2. A comprehensive stack has been defined (at least frontend, backend, and database)
3. The user indicates they are ready to proceed or save the configuration

Set isComplete to false while still gathering requirements or if the stack is incomplete.

Common technology names to use (use these exact names for consistency):
- Languages: TypeScript, JavaScript, Python, Java, Go, Rust, C#, Ruby, PHP
- Frontend: React, Next.js, Vue.js, Angular, Svelte, Astro
- Backend: Node.js, Express, NestJS, FastAPI, Django, Spring Boot, .NET
- Databases: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, DynamoDB
- Cloud: AWS, Google Cloud, Azure, Vercel, Netlify
- DevOps: Docker, Kubernetes, GitHub Actions, GitLab CI, Terraform
- Other: GraphQL, REST API, WebSocket, gRPC, RabbitMQ, Kafka

Always respond with valid JSON only. No additional text before or after the JSON.`;

    // Convert chat history to OpenRouter format
    const chatMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "assistant" as const,
        content: JSON.stringify({
          response:
            "I'm ready to help you define the target tech stack for your project migration. Tell me about your current legacy system and what you're looking to achieve with the migration.",
          techStack: [],
          suggestions: [],
          isComplete: false,
        }),
      },
      ...messages.map((msg: ChatMessage) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
    ];

    // Call OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Tech Stack Migration Assistant",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return NextResponse.json(
        { error: "Failed to get response from OpenRouter" },
        { status: 500 },
      );
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "";

    // Parse the JSON response
    let parsedResponse: {
      response: string;
      techStack: string[];
      suggestions: string[];
      isComplete: boolean;
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
      // If parsing fails, return the raw response with empty tech stack
      console.error("Failed to parse JSON response:", responseText);
      parsedResponse = {
        response: responseText,
        techStack: [],
        suggestions: [],
        isComplete: false,
      };
    }

    // Ensure we always return the current tech stack if the AI returns an empty array
    const responseTechStack = parsedResponse.techStack || [];
    const finalTechStack =
      responseTechStack.length > 0 ? responseTechStack : currentTechStack || [];

    return NextResponse.json({
      message: {
        role: "assistant",
        content: parsedResponse.response,
      },
      techStack: finalTechStack,
      suggestions: parsedResponse.suggestions || [],
      isComplete: parsedResponse.isComplete || false,
    } as DefineTechStackResponse);
  } catch (error) {
    console.error("Define tech stack API error:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
