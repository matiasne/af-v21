import { MigrationAction, ProcessResult, StepResult } from "../entities/MigrationAction";
import { ConfigChatMessage } from "../entities/Project";

export interface MigrationRepository {
  // Migration Actions
  getMigrations(userId: string, projectId: string): Promise<MigrationAction[]>;
  getMigration(userId: string, projectId: string, migrationId: string): Promise<MigrationAction | null>;
  createMigration(userId: string, projectId: string, migration: Omit<MigrationAction, "id">): Promise<string>;
  updateMigration(userId: string, projectId: string, migrationId: string, data: Partial<MigrationAction>): Promise<void>;
  deleteMigration(userId: string, projectId: string, migrationId: string): Promise<void>;

  // Real-time subscription
  subscribeMigration(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (migration: MigrationAction | null) => void,
    onError?: (error: Error) => void
  ): () => void;

  // Process Results
  getProcessResults(userId: string, projectId: string, migrationId: string): Promise<ProcessResult[]>;
  getLatestProcessResult(userId: string, projectId: string, migrationId: string): Promise<ProcessResult | null>;

  // Real-time subscription for process results
  subscribeProcessResult(
    userId: string,
    projectId: string,
    migrationId: string,
    processId: string,
    onUpdate: (result: ProcessResult | null) => void,
    onError?: (error: Error) => void
  ): () => void;

  // Step Results (directly under migration, not under processResults)
  getStepResults(userId: string, projectId: string, migrationId: string): Promise<StepResult[]>;

  // Real-time subscription for step results
  subscribeStepResults(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (results: StepResult[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  // Config chat messages (for tech stack configuration)
  getConfigChatMessages(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<ConfigChatMessage[]>;
  addConfigChatMessage(
    userId: string,
    projectId: string,
    migrationId: string,
    message: Omit<ConfigChatMessage, "timestamp">
  ): Promise<string>;
  clearConfigChatMessages(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void>;
}
