/**
 * Migration Planner entity representing the state of execution plan generation.
 */

export interface MigrationPlannerStatus {
  id: string;
  action: MigrationPlannerAction;
  currentStep: string | null;
  description: string | null;
  error: string | null;
  logFile: string | null;
  tasksGenerated: number;
  updatedAt: number | null;
}

export type MigrationPlannerAction =
  | "pending"
  | "start"
  | "resume"
  | "stop"
  | "server_stop"
  | "running"
  | "completed"
  | "error";

export function getMigrationPlannerActionLabel(action: MigrationPlannerAction): string {
  switch (action) {
    case "pending":
      return "Pending";
    case "start":
      return "Starting";
    case "resume":
      return "Resuming";
    case "stop":
      return "Stopped";
    case "server_stop":
      return "Server Stopped";
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

export function getMigrationPlannerActionColor(action: MigrationPlannerAction): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
  switch (action) {
    case "pending":
      return "default";
    case "start":
    case "resume":
    case "running":
      return "primary";
    case "completed":
      return "success";
    case "stop":
    case "server_stop":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}
