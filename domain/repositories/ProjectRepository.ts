import { Project, ConfigChatMessage } from "../entities/Project";

export interface ProjectRepository {
  getProjects(userId: string): Promise<Project[]>;
  getProject(userId: string, projectId: string): Promise<Project | null>;
  createProject(
    userId: string,
    project: Omit<Project, "id" | "createdAt" | "updatedAt" | "status">
  ): Promise<string>;
  updateProject(
    userId: string,
    projectId: string,
    data: Partial<Project>
  ): Promise<void>;
  deleteProject(userId: string, projectId: string): Promise<void>;

  // Config chat messages subcollection (for tech stack configuration)
  getConfigChatMessages(
    userId: string,
    projectId: string
  ): Promise<ConfigChatMessage[]>;
  addConfigChatMessage(
    userId: string,
    projectId: string,
    message: Omit<ConfigChatMessage, "timestamp">
  ): Promise<string>;
  clearConfigChatMessages(userId: string, projectId: string): Promise<void>;

  // General chat messages subcollection (for FloatingInput)
  getGeneralChatMessages(
    userId: string,
    projectId: string
  ): Promise<ConfigChatMessage[]>;
  addGeneralChatMessage(
    userId: string,
    projectId: string,
    message: Omit<ConfigChatMessage, "timestamp">
  ): Promise<string>;

  getLegacyFilesCount(userId: string, projectId: string): Promise<number>;

  // Executor Model
  updateExecutorModel(
    userId: string,
    projectId: string,
    executorModel: string
  ): Promise<void>;

  // Code Analysis Module
  startCodeAnalysis(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void>;

  stopCodeAnalysis(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void>;

  resumeCodeAnalysis(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void>;
}
