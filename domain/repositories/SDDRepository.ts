import { SDDTableOfContents } from "../entities/SDD";

export interface SDDRepository {
  getTableOfContents(
    userId: string,
    projectId: string
  ): Promise<SDDTableOfContents | null>;

  subscribeTableOfContents(
    userId: string,
    projectId: string,
    onUpdate: (toc: SDDTableOfContents | null) => void,
    onError?: (error: Error) => void
  ): () => void;
}
