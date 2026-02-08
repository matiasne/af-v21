import { NextRequest, NextResponse } from "next/server";

import { ragRepository } from "@/infrastructure/repositories/FirebaseRAGRepository";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const corpusName = searchParams.get("corpusName");
    const listCorpora = searchParams.get("listCorpora");

    // List all corpora if requested
    if (listCorpora === "true") {
      console.log("[RAG API] Listing all corpora");
      const corpora = await ragRepository.listCorpora();
      return NextResponse.json({ corpora, count: corpora.length });
    }

    // Otherwise, get specific corpus info
    if (!corpusName) {
      return NextResponse.json(
        { error: "corpusName query parameter is required (or use listCorpora=true)" },
        { status: 400 },
      );
    }

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
      { status: 500 },
    );
  }
}

// POST - Create or get corpus, or upload document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "getOrCreateCorpus") {
      const { corpusDisplayName } = body;

      if (!corpusDisplayName) {
        return NextResponse.json(
          { error: "corpusDisplayName is required" },
          { status: 400 },
        );
      }

      console.log("[RAG API] Getting or creating corpus:", corpusDisplayName);
      const corpus = await ragRepository.getOrCreateCorpus(corpusDisplayName);

      if (!corpus) {
        return NextResponse.json(
          { error: "Failed to get or create corpus" },
          { status: 500 },
        );
      }

      return NextResponse.json({ corpus });
    }

    if (action === "uploadDocument") {
      const { corpusName, displayName, content } = body;

      if (!corpusName || !displayName || !content) {
        return NextResponse.json(
          { error: "corpusName, displayName, and content are required" },
          { status: 400 },
        );
      }

      console.log(
        "[RAG API] Uploading document:",
        displayName,
        "to corpus:",
        corpusName,
      );
      const document = await ragRepository.uploadDocument(
        corpusName,
        displayName,
        content,
      );

      if (!document) {
        return NextResponse.json(
          { error: "Failed to upload document" },
          { status: 500 },
        );
      }

      return NextResponse.json({ document });
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Supported actions: getOrCreateCorpus, uploadDocument",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("RAG Files API POST error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}

// DELETE - Delete a document or corpus
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const corpusName = searchParams.get("corpusName");
    const displayName = searchParams.get("displayName");
    const deleteCorpus = searchParams.get("deleteCorpus");

    // Delete entire corpus
    if (deleteCorpus === "true" && corpusName) {
      console.log("[RAG API] Deleting corpus:", corpusName);
      const success = await ragRepository.deleteCorpus(corpusName);

      if (!success) {
        return NextResponse.json(
          { error: "Failed to delete corpus" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }

    // Delete document from corpus
    if (!corpusName || !displayName) {
      return NextResponse.json(
        { error: "corpusName and displayName query parameters are required (or use deleteCorpus=true)" },
        { status: 400 },
      );
    }

    console.log(
      "[RAG API] Deleting document:",
      displayName,
      "from corpus:",
      corpusName,
    );
    const success = await ragRepository.deleteDocumentByDisplayName(
      corpusName,
      displayName,
    );

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete document" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("RAG Files API DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 },
    );
  }
}
