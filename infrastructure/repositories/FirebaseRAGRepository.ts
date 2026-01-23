import {
  RAGRepository,
  RAGSearchResult,
} from "@/domain/repositories/RAGRepository";
import { RAGFile, RAGCorpus } from "@/domain/entities/RAGFile";

export class FirebaseRAGRepository implements RAGRepository {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || "";
  }

  async searchFiles(
    query: string,
    storeName: string
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
        }
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
        }): RAGSearchResult => ({
          content: chunk.chunk?.data?.stringValue || "",
          relevanceScore: chunk.chunkRelevanceScore || 0,
        })
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
        }
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

      console.log(`[RAG Repository] Listing documents for corpus: ${corpusName}`);

      do {
        const url = new URL(
          `https://generativelanguage.googleapis.com/v1beta/${corpusName}/documents`
        );
        url.searchParams.set("key", this.apiKey);
        url.searchParams.set("pageSize", "100");
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken);
        }

        console.log(`[RAG Repository] Fetching documents from: ${url.toString().replace(this.apiKey, '[REDACTED]')}`);

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
          console.log(`[RAG Repository] Found ${data.documents.length} documents in this page`);
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
                {}
              ),
            })
          );
          allDocuments.push(...documents);
        } else {
          console.log("[RAG Repository] No documents found in response");
        }

        pageToken = data.nextPageToken;
      } while (pageToken);

      console.log(`[RAG Repository] Total documents fetched: ${allDocuments.length}`);
      return allDocuments;
    } catch (error) {
      console.error("[RAG Repository] Error listing documents:", error);
      return [];
    }
  }
}

export const ragRepository = new FirebaseRAGRepository();
