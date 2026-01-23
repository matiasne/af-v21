import { AnalyzedFile, BusinessAnalysis, FunctionalAnalysis } from "../entities/FileAnalysis";

export interface FileAnalysisRepository {
  // Get all files for a migration
  getFiles(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<AnalyzedFile[]>;

  // Subscribe to files list
  subscribeFiles(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (files: AnalyzedFile[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  // Get specific file with analyses
  getFileWithAnalyses(
    userId: string,
    projectId: string,
    migrationId: string,
    fileId: string
  ): Promise<{
    file: AnalyzedFile;
    businessAnalysis?: BusinessAnalysis;
    functionalAnalysis?: FunctionalAnalysis;
  } | null>;

  // Skip a file from FDD enrichment
  skipFile(
    userId: string,
    projectId: string,
    migrationId: string,
    fileId: string
  ): Promise<void>;

  // Add a comment to a file
  addComment(
    userId: string,
    projectId: string,
    migrationId: string,
    fileId: string,
    comment: string
  ): Promise<string>;

  // Get comments for a file
  getComments(
    userId: string,
    projectId: string,
    migrationId: string,
    fileId: string
  ): Promise<Array<{ id: string; comment: string; createdAt: number }>>;

  // Subscribe to comments for a file
  subscribeComments(
    userId: string,
    projectId: string,
    migrationId: string,
    fileId: string,
    onUpdate: (comments: Array<{ id: string; comment: string; createdAt: number }>) => void,
    onError?: (error: Error) => void
  ): () => void;

  // Delete a comment
  deleteComment(
    userId: string,
    projectId: string,
    migrationId: string,
    fileId: string,
    commentId: string
  ): Promise<void>;
}
