import { NextRequest, NextResponse } from "next/server";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, projectContext } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 500 }
      );
    }

    const systemPrompt = `You are a helpful AI assistant for a project management application.
You help users understand their project status, answer questions about their codebase analysis,
and provide insights about software projects.

${projectContext ? `Current project context:
- Project Name: ${projectContext.name}
- Description: ${projectContext.description || "No description"}
- Current Status: ${projectContext.status}
- GitHub URL: ${projectContext.githubUrl || "Not provided"}` : ""}

Be concise, helpful, and friendly in your responses.`;

    // Convert chat history to OpenRouter format
    const chatMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      {
        role: "assistant" as const,
        content: "I understand. I'm ready to help with your project. How can I assist you?",
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
        "X-Title": "Project Chat Assistant",
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
        { status: 500 }
      );
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      message: {
        role: "assistant",
        content: responseText,
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
