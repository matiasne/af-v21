import { Task, TaskColumn } from "../entities/Task";
import { StepStatus } from "../entities/Project";

export interface TaskRepository {
  getTasks(userId: string, projectId: string, migrationId: string): Promise<Task[]>;
  getTasksByPhase(userId: string, projectId: string, migrationId: string, phase: StepStatus): Promise<Task[]>;
  updateTaskColumn(
    userId: string,
    projectId: string,
    migrationId: string,
    taskId: string,
    column: TaskColumn
  ): Promise<void>;
  subscribeTasks(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (tasks: Task[]) => void,
    onError?: (error: Error) => void
  ): () => void;
}
