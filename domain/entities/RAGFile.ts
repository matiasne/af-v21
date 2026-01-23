export interface RAGFile {
  name: string; // Full resource name (e.g., corpora/xxx/documents/yyy)
  displayName: string;
  createTime?: string;
  updateTime?: string;
  customMetadata?: Record<string, string>;
}

export interface RAGCorpus {
  name: string; // Full resource name (e.g., corpora/xxx)
  displayName: string;
  createTime?: string;
  updateTime?: string;
}
