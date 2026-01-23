import { StepStatus } from "./Project";

export type TaskColumn = "backlog" | "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  column?: TaskColumn;
  phase: StepStatus;
  epicId?: string;
  phaseId?: string;
  priority?: "low" | "medium" | "high";
  createdAt: number;
  updatedAt: number;
}

export const KANBAN_COLUMNS: { id: TaskColumn; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "done", label: "Done" },
];
