import {
  RAGRepository,
  RAGSearchResult,
} from "@/domain/repositories/RAGRepository";
import { RAGFile, RAGCorpus } from "@/domain/entities/RAGFile";
import { Pinecone } from "@pinecone-database/pinecone";

// Simple in-memory cache for document metadata
// In production, you might want to use a proper cache like Redis
const documentMetadataCache = new Map<string, RAGFile[]>();

// Shared index name for all projects - each project uses a different namespace
const SHARED_INDEX_NAME = "tasks";

export class PineconeRAGRepository implements RAGRepository {
  private pinecone: Pinecone;

  constructor() {
    const pineconeApiKey = process.env.PINECONE_API_KEY;

    if (!pineconeApiKey) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }

    this.pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });
  }

  private getIndexName(): string {
    // Use a single shared index for all projects
    return SHARED_INDEX_NAME;
  }

  private getNamespace(corpusDisplayName: string): string {
    // Each project gets its own namespace based on the corpus display name
    // The corpus display name is typically in format: projectId-tasks-rag
    return corpusDisplayName;
  }

  async searchFiles(
    query: string,
    storeName: string,
  ): Promise<RAGSearchResult[]> {
    try {
      console.log("[Pinecone RAG] ========== SEARCH START ==========");
      console.log("[Pinecone RAG] Query:", query);
      console.log("[Pinecone RAG] Store name:", storeName);

      // Extract corpus display name from store name (format: corpora/xxx or just the display name)
      const corpusDisplayName = storeName.startsWith("corpora/")
        ? storeName.split("/")[1]
        : storeName;

      const indexName = this.getIndexName();
      const namespace = this.getNamespace(corpusDisplayName);

      console.log("[Pinecone RAG] Index:", indexName);
      console.log("[Pinecone RAG] Namespace:", namespace);

      // Get the index - using integrated embeddings
      const index = this.pinecone.index(indexName);

      // Search using the integrated embedding model
      // The index was created with llama-text-embed-v2, so it handles embeddings automatically
      const namespaceIndex = index.namespace(namespace);

      console.log("[Pinecone RAG] Sending search request...");
      const searchResponse = await namespaceIndex.searchRecords({
        query: {
          topK: 5,
          inputs: { text: query },
        },
        fields: ["content", "displayName", "search-text"],
      });

      console.log("[Pinecone RAG] Raw response:", JSON.stringify(searchResponse, null, 2));

      if (!searchResponse.result?.hits || searchResponse.result.hits.length === 0) {
        console.log("[Pinecone RAG] No matches found");
        console.log("[Pinecone RAG] ========== SEARCH END ==========");
        return [];
      }

      console.log(`[Pinecone RAG] Found ${searchResponse.result.hits.length} matches`);

      const results = searchResponse.result.hits.map((hit, index) => {
        const fields = hit.fields as Record<string, unknown> | undefined;
        const content = (fields?.content as string) || (fields?.["search-text"] as string) || "";
        const score = hit._score || 0;
        const documentId = hit._id || "";

        console.log(`[Pinecone RAG] Match ${index + 1}:`);
        console.log(`  - ID: ${documentId}`);
        console.log(`  - Score: ${score}`);
        console.log(`  - Content preview: ${content.substring(0, 200)}...`);

        return {
          id: documentId,
          content,
          relevanceScore: score,
        };
      });

      console.log("[Pinecone RAG] ========== SEARCH END ==========");
      return results;
    } catch (error) {
      console.error("[Pinecone RAG] Error searching files:", error);
      console.log("[Pinecone RAG] ========== SEARCH END (ERROR) ==========");
      return [];
    }
  }

  async getCorpus(corpusName: string): Promise<RAGCorpus | null> {
    try {
      // Extract display name from corpus name
      const displayName = corpusName.startsWith("corpora/")
        ? corpusName.split("/")[1]
        : corpusName;

      const indexName = this.getIndexName();

      // Check if the index exists
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

      if (!indexExists) {
        console.log(`[Pinecone RAG] Index ${indexName} not found`);
        return null;
      }

      return {
        name: `corpora/${displayName}`,
        displayName: displayName,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[Pinecone RAG] Error getting corpus:", error);
      return null;
    }
  }

  async listDocuments(corpusName: string): Promise<RAGFile[]> {
    try {
      const displayName = corpusName.startsWith("corpora/")
        ? corpusName.split("/")[1]
        : corpusName;

      console.log(`[Pinecone RAG] Listing documents for corpus: ${displayName}`);

      // Check cache first
      const cacheKey = `docs_${displayName}`;
      const cachedDocs = documentMetadataCache.get(cacheKey);
      if (cachedDocs) {
        console.log(`[Pinecone RAG] Returning ${cachedDocs.length} documents from cache`);
        return cachedDocs;
      }

      const indexName = this.getIndexName();
      const namespace = this.getNamespace(displayName);

      // Get the index
      const index = this.pinecone.index(indexName);

      // Get index stats to understand the dimension
      const stats = await index.describeIndexStats();
      const namespaceStats = stats.namespaces?.[namespace];

      if (!namespaceStats || namespaceStats.recordCount === 0) {
        console.log("[Pinecone RAG] No documents found in namespace");
        return [];
      }

      // Unfortunately, Pinecone doesn't support listing all vectors directly
      // We need to maintain document metadata separately or use the list operation if available
      // For now, return empty array - documents will be tracked via cache on upload
      console.log(`[Pinecone RAG] Namespace has ${namespaceStats.recordCount} vectors`);

      return [];
    } catch (error) {
      console.error("[Pinecone RAG] Error listing documents:", error);
      return [];
    }
  }

  async deleteDocumentByDisplayName(
    corpusName: string,
    displayName: string,
  ): Promise<boolean> {
    try {
      const corpusDisplayName = corpusName.startsWith("corpora/")
        ? corpusName.split("/")[1]
        : corpusName;

      console.log(
        `[Pinecone RAG] Deleting document "${displayName}" from corpus: ${corpusDisplayName}`,
      );

      const indexName = this.getIndexName();
      const namespace = this.getNamespace(corpusDisplayName);

      // Get the index
      const index = this.pinecone.index(indexName);

      // Delete by ID (we use displayName as the vector ID)
      await index.namespace(namespace).deleteMany([displayName]);

      // Update cache
      const cacheKey = `docs_${corpusDisplayName}`;
      const cachedDocs = documentMetadataCache.get(cacheKey);
      if (cachedDocs) {
        documentMetadataCache.set(
          cacheKey,
          cachedDocs.filter((doc) => doc.displayName !== displayName)
        );
      }

      console.log("[Pinecone RAG] Document deleted successfully");
      return true;
    } catch (error) {
      console.error("[Pinecone RAG] Error deleting document:", error);
      return false;
    }
  }

  async getOrCreateCorpus(
    corpusDisplayName: string,
  ): Promise<RAGCorpus | null> {
    try {
      console.log(`[Pinecone RAG] Getting or creating corpus: ${corpusDisplayName}`);

      const indexName = this.getIndexName();

      // Check if shared index exists
      const indexes = await this.pinecone.listIndexes();
      const existingIndex = indexes.indexes?.find((idx) => idx.name === indexName);

      if (existingIndex) {
        console.log(`[Pinecone RAG] Found existing shared index: ${indexName}, using namespace: ${corpusDisplayName}`);
        return {
          name: `corpora/${corpusDisplayName}`,
          displayName: corpusDisplayName,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        };
      }

      // Index doesn't exist - it should be created via Pinecone dashboard with integrated embeddings
      console.error(`[Pinecone RAG] Index "${indexName}" not found. Please create it in Pinecone dashboard with llama-text-embed-v2 model.`);
      return null;
    } catch (error) {
      console.error("[Pinecone RAG] Error getting or creating corpus:", error);
      return null;
    }
  }

  async uploadDocument(
    corpusName: string,
    displayName: string,
    content: string,
  ): Promise<RAGFile | null> {
    try {
      const corpusDisplayName = corpusName.startsWith("corpora/")
        ? corpusName.split("/")[1]
        : corpusName;

      console.log(
        `[Pinecone RAG] Uploading document "${displayName}" to namespace: ${corpusDisplayName}`,
      );

      const indexName = this.getIndexName();
      const namespace = this.getNamespace(corpusDisplayName);

      // Get the index with namespace
      const index = this.pinecone.index(indexName);
      const namespaceIndex = index.namespace(namespace);

      // Upsert using integrated embeddings - Pinecone will generate embeddings automatically
      // The index is configured with field_mapping for "search-text"
      await namespaceIndex.upsertRecords({
        records: [
          {
            _id: displayName,
            "search-text": content,
            content: content,
            displayName: displayName,
            type: "task",
            createdAt: new Date().toISOString(),
          },
        ],
      });

      const ragFile: RAGFile = {
        name: `corpora/${corpusDisplayName}/documents/${displayName}`,
        displayName: displayName,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };

      // Update cache
      const cacheKey = `docs_${corpusDisplayName}`;
      const cachedDocs = documentMetadataCache.get(cacheKey) || [];
      const existingIndex = cachedDocs.findIndex((doc) => doc.displayName === displayName);
      if (existingIndex >= 0) {
        cachedDocs[existingIndex] = ragFile;
      } else {
        cachedDocs.push(ragFile);
      }
      documentMetadataCache.set(cacheKey, cachedDocs);

      console.log("[Pinecone RAG] Document uploaded successfully");

      return ragFile;
    } catch (error) {
      console.error("[Pinecone RAG] Error uploading document:", error);
      return null;
    }
  }

  async listCorpora(): Promise<RAGCorpus[]> {
    try {
      console.log("[Pinecone RAG] Listing all namespaces as corpora");

      const indexName = this.getIndexName();

      // Check if the shared index exists
      const indexes = await this.pinecone.listIndexes();
      const indexExists = indexes.indexes?.some((idx) => idx.name === indexName);

      if (!indexExists) {
        return [];
      }

      // Get index stats to list all namespaces
      const index = this.pinecone.index(indexName);
      const stats = await index.describeIndexStats();

      if (!stats.namespaces) {
        return [];
      }

      return Object.keys(stats.namespaces).map((namespace) => ({
        name: `corpora/${namespace}`,
        displayName: namespace,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      }));
    } catch (error) {
      console.error("[Pinecone RAG] Error listing corpora:", error);
      return [];
    }
  }

  async deleteCorpus(corpusName: string): Promise<boolean> {
    try {
      const displayName = corpusName.startsWith("corpora/")
        ? corpusName.split("/")[1]
        : corpusName;

      console.log(`[Pinecone RAG] Deleting namespace: ${displayName}`);

      const indexName = this.getIndexName();
      const namespace = this.getNamespace(displayName);

      // Delete all vectors in the namespace
      const index = this.pinecone.index(indexName);
      await index.namespace(namespace).deleteAll();

      // Clear cache
      documentMetadataCache.delete(`docs_${displayName}`);

      console.log("[Pinecone RAG] Namespace deleted successfully");
      return true;
    } catch (error) {
      console.error("[Pinecone RAG] Error deleting corpus:", error);
      return false;
    }
  }
}

export const ragRepository = new PineconeRAGRepository();
