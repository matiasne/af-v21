import { SDDTableOfContents } from "../entities/SDD";

export interface SDDRepository {
  getTableOfContents(
    projectId: string
  ): Promise<SDDTableOfContents | null>;

  subscribeTableOfContents(
    projectId: string,
    onUpdate: (toc: SDDTableOfContents | null) => void,
    onError?: (error: Error) => void
  ): () => void;
}
