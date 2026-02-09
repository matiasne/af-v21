import { Task, TaskColumn } from "../entities/Task";
import { StepStatus } from "../entities/Project";

export interface TaskRepository {
  getTasks(projectId: string, migrationId: string): Promise<Task[]>;
  getTasksByPhase(projectId: string, migrationId: string, phase: StepStatus): Promise<Task[]>;
  updateTaskColumn(
    projectId: string,
    migrationId: string,
    taskId: string,
    column: TaskColumn
  ): Promise<void>;
  subscribeTasks(
    projectId: string,
    migrationId: string,
    onUpdate: (tasks: Task[]) => void,
    onError?: (error: Error) => void
  ): () => void;
}
