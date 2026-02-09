import {
  RAGRepository,
  RAGSearchResult,
} from "@/domain/repositories/RAGRepository";
import { RAGFile, RAGCorpus } from "@/domain/entities/RAGFile";

export class FirebaseRAGRepository implements RAGRepository {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_FILE_SEARCH_API_KEY || "";
  }

  async searchFiles(
    query: string,
    storeName: string,
  ): Promise<RAGSearchResult[]> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${storeName}:query?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: query,
            resultsCount: 5,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("File search error:", errorText);
        return [];
      }

      const data = await response.json();

      if (!data.relevantChunks || data.relevantChunks.length === 0) {
        return [];
      }

      return data.relevantChunks.map(
        (chunk: {
          chunk?: { data?: { stringValue?: string } };
          chunkRelevanceScore?: number;
        }, index: number): RAGSearchResult => ({
          id: `gemini-chunk-${index}`,
          content: chunk.chunk?.data?.stringValue || "",
          relevanceScore: chunk.chunkRelevanceScore || 0,
        }),
      );
    } catch (error) {
      console.error("Error searching project files:", error);
      return [];
    }
  }

  async getCorpus(corpusName: string): Promise<RAGCorpus | null> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${corpusName}?key=${this.apiKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Get corpus error:", errorText);
        return null;
      }

      const data = await response.json();

      return {
        name: data.name || corpusName,
        displayName: data.displayName || "",
        createTime: data.createTime,
        updateTime: data.updateTime,
      };
    } catch (error) {
      console.error("Error getting corpus:", error);
      return null;
    }
  }

  async listDocuments(corpusName: string): Promise<RAGFile[]> {
    try {
      const allDocuments: RAGFile[] = [];
      let pageToken: string | undefined;

      console.log(
        `[RAG Repository] Listing documents for corpus: ${corpusName}`,
      );

      do {
        const url = new URL(
          `https://generativelanguage.googleapis.com/v1beta/${corpusName}/documents`,
        );
        url.searchParams.set("key", this.apiKey);
        url.searchParams.set("pageSize", "100");
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken);
        }

        console.log(
          `[RAG Repository] Fetching documents from: ${url.toString().replace(this.apiKey, "[REDACTED]")}`,
        );

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        console.log(`[RAG Repository] Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error("[RAG Repository] List documents error:", errorText);
          console.error("[RAG Repository] Response status:", response.status);
          break;
        }

        const data = await response.json();
        console.log(`[RAG Repository] Response data:`, data);

        if (data.documents && Array.isArray(data.documents)) {
          console.log(
            `[RAG Repository] Found ${data.documents.length} documents in this page`,
          );
          const documents = data.documents.map(
            (doc: {
              name?: string;
              displayName?: string;
              createTime?: string;
              updateTime?: string;
              customMetadata?: { key: string; stringValue: string }[];
            }): RAGFile => ({
              name: doc.name || "",
              displayName: doc.displayName || "",
              createTime: doc.createTime,
              updateTime: doc.updateTime,
              customMetadata: doc.customMetadata?.reduce(
                (acc: Record<string, string>, item) => {
                  acc[item.key] = item.stringValue;
                  return acc;
                },
                {},
              ),
            }),
          );
          allDocuments.push(...documents);
        } else {
          console.log("[RAG Repository] No documents found in response");
        }

        pageToken = data.nextPageToken;
      } while (pageToken);

      console.log(
        `[RAG Repository] Total documents fetched: ${allDocuments.length}`,
      );
      return allDocuments;
    } catch (error) {
      console.error("[RAG Repository] Error listing documents:", error);
      return [];
    }
  }

  async deleteDocumentByDisplayName(
    corpusName: string,
    displayName: string,
  ): Promise<boolean> {
    try {
      console.log(
        `[RAG Repository] Deleting document with displayName: ${displayName} from corpus: ${corpusName}`,
      );

      // First, list documents to find the one with matching displayName
      const documents = await this.listDocuments(corpusName);
      const documentToDelete = documents.find(
        (doc) => doc.displayName === displayName,
      );

      if (!documentToDelete) {
        console.log(
          `[RAG Repository] Document with displayName "${displayName}" not found`,
        );
        return false;
      }

      console.log(`[RAG Repository] Found document: ${documentToDelete.name}`);

      // Delete the document using its full name
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${documentToDelete.name}?key=${this.apiKey}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[RAG Repository] Delete document error:", errorText);
        return false;
      }

      console.log(`[RAG Repository] Document deleted successfully`);
      return true;
    } catch (error) {
      console.error("[RAG Repository] Error deleting document:", error);
      return false;
    }
  }

  async getOrCreateCorpus(
    corpusDisplayName: string,
  ): Promise<RAGCorpus | null> {
    try {
      console.log(
        `[RAG Repository] Getting or creating corpus: ${corpusDisplayName}`,
      );

      // First, try to list all corpora to find one with matching display name
      const listResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/corpora?key=${this.apiKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (listResponse.ok) {
        const listData = await listResponse.json();
        if (listData.corpora && Array.isArray(listData.corpora)) {
          const existingCorpus = listData.corpora.find(
            (c: { displayName?: string }) =>
              c.displayName === corpusDisplayName,
          );
          if (existingCorpus) {
            console.log(
              `[RAG Repository] Found existing corpus: ${existingCorpus.name}`,
            );
            return {
              name: existingCorpus.name,
              displayName: existingCorpus.displayName || corpusDisplayName,
              createTime: existingCorpus.createTime,
              updateTime: existingCorpus.updateTime,
            };
          }
        }
      }

      // Corpus doesn't exist, create it
      console.log(`[RAG Repository] Creating new corpus: ${corpusDisplayName}`);
      const createResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/corpora?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName: corpusDisplayName,
          }),
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("[RAG Repository] Create corpus error:", errorText);
        return null;
      }

      const createData = await createResponse.json();
      console.log(`[RAG Repository] Created corpus: ${createData.name}`);

      return {
        name: createData.name,
        displayName: createData.displayName || corpusDisplayName,
        createTime: createData.createTime,
        updateTime: createData.updateTime,
      };
    } catch (error) {
      console.error(
        "[RAG Repository] Error getting or creating corpus:",
        error,
      );
      return null;
    }
  }

  async uploadDocument(
    corpusName: string,
    displayName: string,
    content: string,
  ): Promise<RAGFile | null> {
    try {
      console.log(
        `[RAG Repository] Uploading document "${displayName}" to corpus: ${corpusName}`,
      );

      // First check if document already exists and delete it
      const existingDocs = await this.listDocuments(corpusName);
      const existingDoc = existingDocs.find(
        (doc) => doc.displayName === displayName,
      );
      if (existingDoc) {
        console.log(`[RAG Repository] Document already exists, deleting first`);
        await this.deleteDocumentByDisplayName(corpusName, displayName);
      }

      // Create the document with inline content
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${corpusName}/documents?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            displayName: displayName,
            customMetadata: [
              { key: "type", stringValue: "task" },
              { key: "createdAt", stringValue: new Date().toISOString() },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[RAG Repository] Create document error:", errorText);
        return null;
      }

      const docData = await response.json();
      console.log(`[RAG Repository] Created document: ${docData.name}`);

      // Now create a chunk with the content
      const chunkResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${docData.name}/chunks?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              stringValue: content,
            },
          }),
        },
      );

      if (!chunkResponse.ok) {
        const errorText = await chunkResponse.text();
        console.error("[RAG Repository] Create chunk error:", errorText);
        // Document was created but chunk failed - still return the document
      } else {
        console.log(`[RAG Repository] Created chunk for document`);
      }

      return {
        name: docData.name,
        displayName: docData.displayName || displayName,
        createTime: docData.createTime,
        updateTime: docData.updateTime,
      };
    } catch (error) {
      console.error("[RAG Repository] Error uploading document:", error);
      return null;
    }
  }

  async listCorpora(): Promise<RAGCorpus[]> {
    try {
      console.log("[RAG Repository] Listing all corpora");
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/corpora?key=${this.apiKey}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[RAG Repository] List corpora error:", errorText);
        return [];
      }

      const data = await response.json();
      if (!data.corpora || !Array.isArray(data.corpora)) {
        return [];
      }

      return data.corpora.map(
        (corpus: {
          name?: string;
          displayName?: string;
          createTime?: string;
          updateTime?: string;
        }): RAGCorpus => ({
          name: corpus.name || "",
          displayName: corpus.displayName || "",
          createTime: corpus.createTime,
          updateTime: corpus.updateTime,
        }),
      );
    } catch (error) {
      console.error("[RAG Repository] Error listing corpora:", error);
      return [];
    }
  }

  async deleteCorpus(corpusName: string): Promise<boolean> {
    try {
      console.log(`[RAG Repository] Deleting corpus: ${corpusName}`);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${corpusName}?key=${this.apiKey}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[RAG Repository] Delete corpus error:", errorText);
        return false;
      }

      console.log(`[RAG Repository] Corpus deleted successfully`);
      return true;
    } catch (error) {
      console.error("[RAG Repository] Error deleting corpus:", error);
      return false;
    }
  }
}

// Export the Pinecone-based repository as the default
export { ragRepository } from "./PineconeRAGRepository";

// Keep the class for backwards compatibility if needed
export const geminiRagRepository = new FirebaseRAGRepository();
