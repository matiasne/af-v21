import { RAGFile, RAGCorpus } from "../entities/RAGFile";

export interface RAGSearchResult {
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
}
