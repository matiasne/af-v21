import { NextRequest, NextResponse } from "next/server";

import { getRagRepository } from "@/infrastructure/repositories/FirebaseRAGRepository";
import {
  ProjectChatService,
  ProjectChatRequest,
} from "@/infrastructure/services/ProjectChatService";

export async function POST(request: NextRequest) {
  try {
    const body: ProjectChatRequest = await request.json();

    const { messages } = body;

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

    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json(
        { error: "Last message must be from user" },
        { status: 400 }
      );
    }

    const chatService = new ProjectChatService(apiKey, getRagRepository());
    const response = await chatService.chat(body);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Project Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
