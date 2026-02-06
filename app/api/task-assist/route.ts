import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface TaskAssistRequest {
  field: "description" | "acceptanceCriteria";
  taskTitle: string;
  currentValue: string;
  userPrompt: string;
  projectContext?: {
    name: string;
    description?: string;
    techStack?: string[];
  };
}

export interface TaskAssistResponse {
  suggestion: string;
}

export async function POST(request: NextRequest) {
  try {
    const { field, taskTitle, currentValue, userPrompt, projectContext }: TaskAssistRequest = await request.json();

    if (!taskTitle || !userPrompt) {
      return NextResponse.json(
        { error: "Task title and user prompt are required" },
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    let systemPrompt = "";

    if (field === "description") {
      systemPrompt = `You are an AI assistant helping a developer write a clear and detailed task description for a software development task.

${projectContext ? `Project Context:
- Project Name: ${projectContext.name}
- Project Description: ${projectContext.description || "Not provided"}
- Tech Stack: ${projectContext.techStack?.join(", ") || "Not defined"}` : ""}

Task Title: "${taskTitle}"
${currentValue ? `Current Description Draft: "${currentValue}"` : ""}

The user wants help with: "${userPrompt}"

Write a clear, professional task description that:
1. Explains what needs to be done
2. Provides context on why this task is important
3. Is concise but comprehensive
4. Uses technical language appropriate for developers

Respond with ONLY the description text, no explanations or formatting markers.`;
    } else {
      systemPrompt = `You are an AI assistant helping a developer write acceptance criteria for a software development task.

${projectContext ? `Project Context:
- Project Name: ${projectContext.name}
- Project Description: ${projectContext.description || "Not provided"}
- Tech Stack: ${projectContext.techStack?.join(", ") || "Not defined"}` : ""}

Task Title: "${taskTitle}"
${currentValue ? `Current Acceptance Criteria Draft: "${currentValue}"` : ""}

The user wants help with: "${userPrompt}"

Write clear, testable acceptance criteria that:
1. Define specific conditions that must be met
2. Are measurable and verifiable
3. Cover edge cases when relevant
4. Follow the format of one criterion per line

Respond with ONLY the acceptance criteria, one per line, no bullet points or numbers, no explanations.
Example format:
User can submit the form successfully
Form validates email format before submission
Error message displays when required fields are empty`;
    }

    const result = await model.generateContent(systemPrompt);
    const response = result.response;
    const suggestion = response.text().trim();

    return NextResponse.json({ suggestion } as TaskAssistResponse);
  } catch (error) {
    console.error("Error in task-assist:", error);
    return NextResponse.json(
      { error: "Failed to generate suggestion" },
      { status: 500 }
    );
  }
}
