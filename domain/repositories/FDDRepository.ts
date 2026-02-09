import { FDDTableOfContents } from "../entities/FDD";

export interface FDDRepository {
  getTableOfContents(
    projectId: string,
    migrationId: string
  ): Promise<FDDTableOfContents | null>;

  subscribeTableOfContents(
    projectId: string,
    migrationId: string,
    onUpdate: (toc: FDDTableOfContents | null) => void,
    onError?: (error: Error) => void
  ): () => void;
}
