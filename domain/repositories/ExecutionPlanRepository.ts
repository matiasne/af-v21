import { Epic, Phase, ExecutionPlanTask, TaskStatus } from "../entities/ExecutionPlan";

export interface ExecutionPlanRepository {
  getEpics(
    userId: string,
    projectId: string
  ): Promise<Epic[]>;

  getPhases(
    userId: string,
    projectId: string
  ): Promise<Phase[]>;

  getTasks(
    userId: string,
    projectId: string
  ): Promise<ExecutionPlanTask[]>;

  subscribeEpics(
    userId: string,
    projectId: string,
    onUpdate: (epics: Epic[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  subscribePhases(
    userId: string,
    projectId: string,
    onUpdate: (phases: Phase[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  subscribeTasks(
    userId: string,
    projectId: string,
    onUpdate: (tasks: ExecutionPlanTask[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  updateTaskStatus(
    userId: string,
    projectId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<void>;

  updateMultipleTasksStatus(
    userId: string,
    projectId: string,
    taskIds: string[],
    status: TaskStatus
  ): Promise<void>;
}
