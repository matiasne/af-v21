import { RAGFile, RAGCorpus } from "../entities/RAGFile";

export interface RAGSearchResult {
  id: string; // Document ID (e.g., task-abc123)
  content: string;
  relevanceScore: number;
}

export interface RAGRepository {
  /**
   * Search for relevant information in the RAG store
   */
  searchFiles(
    query: string,
    storeName: string
  ): Promise<RAGSearchResult[]>;

  /**
   * Get corpus details
   */
  getCorpus(corpusName: string): Promise<RAGCorpus | null>;

  /**
   * List all documents in a corpus
   */
  listDocuments(corpusName: string): Promise<RAGFile[]>;

  /**
   * Delete a document from the corpus by its display name
   */
  deleteDocumentByDisplayName(
    corpusName: string,
    displayName: string
  ): Promise<boolean>;

  /**
   * Create a new corpus if it doesn't exist, or return existing one
   */
  getOrCreateCorpus(corpusDisplayName: string): Promise<RAGCorpus | null>;

  /**
   * Upload a document to the corpus
   */
  uploadDocument(
    corpusName: string,
    displayName: string,
    content: string
  ): Promise<RAGFile | null>;
}
