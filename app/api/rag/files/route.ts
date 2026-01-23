import { NextRequest, NextResponse } from "next/server";

import { FirebaseRAGRepository } from "@/infrastructure/repositories/FirebaseRAGRepository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const corpusName = searchParams.get("corpusName");

    if (!corpusName) {
      return NextResponse.json(
        { error: "corpusName query parameter is required" },
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

    const ragRepository = new FirebaseRAGRepository(apiKey);

    console.log("Fetching RAG data for corpus:", corpusName);

    // Fetch corpus info and documents in parallel
    const [corpus, documents] = await Promise.all([
      ragRepository.getCorpus(corpusName),
      ragRepository.listDocuments(corpusName),
    ]);

    console.log("Corpus fetched:", corpus);
    console.log("Documents count:", documents.length);
    console.log("Documents sample:", documents.slice(0, 2));

    return NextResponse.json({
      corpus,
      documents,
      count: documents.length,
    });
  } catch (error) {
    console.error("RAG Files API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch RAG files" },
      { status: 500 }
    );
  }
}
