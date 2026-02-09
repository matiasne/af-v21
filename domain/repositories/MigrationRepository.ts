import {
  MigrationAction,
  ProcessResult,
  StepResult,
} from "../entities/MigrationAction";
import { ConfigChatMessage } from "../entities/Project";

export interface MigrationRepository {
  // Migration Actions
  getMigrations(projectId: string): Promise<MigrationAction[]>;
  getMigration(
    projectId: string,
    migrationId: string,
  ): Promise<MigrationAction | null>;
  createMigration(
    projectId: string,
    migration: Omit<MigrationAction, "id">,
  ): Promise<string>;
  updateMigration(
    projectId: string,
    migrationId: string,
    data: Partial<MigrationAction>,
  ): Promise<void>;
  deleteMigration(projectId: string, migrationId: string): Promise<void>;

  // Real-time subscription
  subscribeMigration(
    projectId: string,
    migrationId: string,
    onUpdate: (migration: MigrationAction | null) => void,
    onError?: (error: Error) => void,
  ): () => void;

  // Process Results
  getProcessResults(
    projectId: string,
    migrationId: string,
  ): Promise<ProcessResult[]>;
  getLatestProcessResult(
    projectId: string,
    migrationId: string,
  ): Promise<ProcessResult | null>;

  // Real-time subscription for process results
  subscribeProcessResult(
    projectId: string,
    migrationId: string,
    processId: string,
    onUpdate: (result: ProcessResult | null) => void,
    onError?: (error: Error) => void,
  ): () => void;

  // Step Results (directly under migration, not under processResults)
  getStepResults(projectId: string, migrationId: string): Promise<StepResult[]>;

  // Real-time subscription for step results
  subscribeStepResults(
    projectId: string,
    migrationId: string,
    onUpdate: (results: StepResult[]) => void,
    onError?: (error: Error) => void,
  ): () => void;

  // Config chat messages (for tech stack configuration)
  getConfigChatMessages(
    projectId: string,
    migrationId: string,
  ): Promise<ConfigChatMessage[]>;
  addConfigChatMessage(
    projectId: string,
    migrationId: string,
    message: Omit<ConfigChatMessage, "timestamp">,
  ): Promise<string>;
  clearConfigChatMessages(
    projectId: string,
    migrationId: string,
  ): Promise<void>;
}
