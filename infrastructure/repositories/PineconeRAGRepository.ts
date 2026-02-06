import {
  RAGRepository,
  RAGSearchResult,
} from "@/domain/repositories/RAGRepository";
import { RAGFile, RAGCorpus } from "@/domain/entities/RAGFile";
import { Pinecone } from "@pinecone-database/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Simple in-memory cache for document metadata
// In production, you might want to use a proper cache like Redis
const documentMetadataCache = new Map<string, RAGFile[]>();

export class PineconeRAGRepository implements RAGRepository {
  private pinecone: Pinecone;
  private genAI: GoogleGenerativeAI;
  private embeddingModel: string = "text-embedding-004";

  constructor() {
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!pineconeApiKey) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required for embeddings");
    }

    this.pinecone = new Pinecone({
      apiKey: pineconeApiKey,
    });

    this.genAI = new GoogleGenerativeAI(geminiApiKey);
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({ model: this.embeddingModel });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  private getIndexName(corpusDisplayName: string): string {
    // Pinecone index names must be lowercase and can contain alphanumeric characters and hyphens
    return corpusDisplayName.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  }

  private getNamespace(corpusDisplayName: string): string {
    // Use namespace to separate different corpora within the same index
    return corpusDisplayName;
  }

  async searchFiles(
    query: string,
    storeName: string,
  ): Promise<RAGSearchResult[]> {
    try {
      console.log(`[Pinecone RAG] Searching for: "${query}" in store: ${storeName}`);

      // Extract corpus display name from store name (format: corpora/xxx or just the display name)
      const corpusDisplayName = storeName.startsWith("corpora/")
        ? storeName.split("/")[1]
        : storeName;

      const indexName = this.getIndexName(corpusDisplayName);
      const namespace = this.getNamespace(corpusDisplayName);

      // Get embedding for the query
      const queryEmbedding = await this.getEmbedding(query);

      // Get the index
      const index = this.pinecone.index(indexName);

      // Query Pinecone
      const queryResponse = await index.namespace(namespace).query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true,
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        console.log("[Pinecone RAG] No matches found");
        return [];
      }

      console.log(`[Pinecone RAG] Found ${queryResponse.matches.length} matches`);

      return queryResponse.matches.map((match) => ({
        content: (match.metadata?.content as string) || "",
        relevanceScore: match.score || 0,
      }));
    } catch (error) {
      console.error("[Pinecone RAG] Error searching files:", error);
      return [];
    }
  }

  async getCorpus(corpusName: string): Promise<RAGCorpus | null> {
    try {
      // Extract display name from corpus name
      const displayName = corpusName.startsWith("corpora/")
        ? corpusName.split("/")[1]
        : corpusName;

      const indexName = this.getIndexName(displayName);

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

      const indexName = this.getIndexName(displayName);
      const namespace = this.getNamespace(displayName);

      // Get the index
      const index = this.pinecone.index(indexName);

      // List all vectors in the namespace
      // Pinecone doesn't have a direct list operation, so we'll use a workaround
      // Query with a zero vector to get all documents (this is a limitation)
      // In production, you might want to store document metadata in a separate database

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

      const indexName = this.getIndexName(corpusDisplayName);
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

      const indexName = this.getIndexName(corpusDisplayName);

      // Check if index exists
      const indexes = await this.pinecone.listIndexes();
      const existingIndex = indexes.indexes?.find((idx) => idx.name === indexName);

      if (existingIndex) {
        console.log(`[Pinecone RAG] Found existing index: ${indexName}`);
        return {
          name: `corpora/${corpusDisplayName}`,
          displayName: corpusDisplayName,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        };
      }

      // Create new index
      console.log(`[Pinecone RAG] Creating new index: ${indexName}`);

      // Get embedding dimension from the model (text-embedding-004 uses 768 dimensions)
      const embeddingDimension = 768;

      await this.pinecone.createIndex({
        name: indexName,
        dimension: embeddingDimension,
        metric: "cosine",
        spec: {
          serverless: {
            cloud: "aws",
            region: process.env.PINECONE_ENVIRONMENT || "us-east-1",
          },
        },
      });

      // Wait for index to be ready
      console.log("[Pinecone RAG] Waiting for index to be ready...");
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 60; // Wait up to 60 seconds

      while (!isReady && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const indexDescription = await this.pinecone.describeIndex(indexName);
        isReady = indexDescription.status?.ready === true;
        attempts++;
      }

      if (!isReady) {
        console.warn("[Pinecone RAG] Index creation timed out, but continuing...");
      }

      console.log(`[Pinecone RAG] Created index: ${indexName}`);

      return {
        name: `corpora/${corpusDisplayName}`,
        displayName: corpusDisplayName,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      };
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
        `[Pinecone RAG] Uploading document "${displayName}" to corpus: ${corpusDisplayName}`,
      );

      const indexName = this.getIndexName(corpusDisplayName);
      const namespace = this.getNamespace(corpusDisplayName);

      // Get embedding for the content
      const embedding = await this.getEmbedding(content);

      // Get the index
      const index = this.pinecone.index(indexName);

      // Upsert the vector (this will update if exists, insert if not)
      await index.namespace(namespace).upsert({
        records: [
          {
            id: displayName,
            values: embedding,
            metadata: {
              content: content,
              displayName: displayName,
              type: "task",
              createdAt: new Date().toISOString(),
            },
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
      console.log("[Pinecone RAG] Listing all indexes as corpora");

      const indexes = await this.pinecone.listIndexes();

      if (!indexes.indexes || indexes.indexes.length === 0) {
        return [];
      }

      return indexes.indexes.map((idx) => ({
        name: `corpora/${idx.name}`,
        displayName: idx.name,
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

      console.log(`[Pinecone RAG] Deleting corpus (index): ${displayName}`);

      const indexName = this.getIndexName(displayName);

      await this.pinecone.deleteIndex(indexName);

      // Clear cache
      documentMetadataCache.delete(`docs_${displayName}`);

      console.log("[Pinecone RAG] Corpus deleted successfully");
      return true;
    } catch (error) {
      console.error("[Pinecone RAG] Error deleting corpus:", error);
      return false;
    }
  }
}

export const ragRepository = new PineconeRAGRepository();
