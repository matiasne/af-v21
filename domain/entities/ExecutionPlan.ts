export interface Epic {
  id: string;
  title: string;
  description: string;
  number: number;
  priority: "high" | "medium" | "low";
  relatedRequirements: string[];
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  number: number;
}

export type TaskStatus = "backlog" | "todo" | "in_progress" | "completed";
export type TaskCategory =
  | "backend"
  | "frontend"
  | "database"
  | "integration"
  | "api";
export type CleanArchitectureArea =
  | "domain"
  | "application"
  | "infrastructure"
  | "presentation";

export interface ExecutionPlanTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  category: TaskCategory;
  cleanArchitectureArea: CleanArchitectureArea;
  dependencies: string[];
  sourceDocument: string;
  status: TaskStatus;
  completionSummary?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  priority: "high" | "medium" | "low";
  epicId: string;
  phaseId: string;
  effortEstimate: string;
  deliverables: string[];
  skillsRequired: string[];
  relatedRequirements: string[];
  order?: number;
}

export interface ExecutionPlan {
  epics: Epic[];
  phases: Phase[];
  tasks: ExecutionPlanTask[];
}
