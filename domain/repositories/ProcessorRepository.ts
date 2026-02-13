import { ProcessorInfo } from "../entities/ProcessorInfo";

export interface ProcessorRepository {
  getProcessors(): Promise<ProcessorInfo[]>;
  getRunningProcessors(): Promise<ProcessorInfo[]>;
  subscribeProcessors(
    onUpdate: (processors: ProcessorInfo[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
}
