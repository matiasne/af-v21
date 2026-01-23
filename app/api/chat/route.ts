import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Build the conversation history for Gemini
    const systemPrompt = `You are a helpful AI assistant for a project management application.
You help users understand their project status, answer questions about their codebase analysis,
and provide insights about software projects.

${projectContext ? `Current project context:
- Project Name: ${projectContext.name}
- Description: ${projectContext.description || "No description"}
- Current Status: ${projectContext.status}
- GitHub URL: ${projectContext.githubUrl || "Not provided"}` : ""}

Be concise, helpful, and friendly in your responses.`;

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
          parts: [{ text: "I understand. I'm ready to help with your project. How can I assist you?" }],
        },
        ...history,
      ],
    });

    // Get the last message (the current user message)
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response.text();

    return NextResponse.json({
      message: {
        role: "assistant",
        content: response,
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
