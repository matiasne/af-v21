import { FDDTableOfContents } from "../entities/FDD";

export interface FDDRepository {
  getTableOfContents(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<FDDTableOfContents | null>;

  subscribeTableOfContents(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (toc: FDDTableOfContents | null) => void,
    onError?: (error: Error) => void
  ): () => void;
}
