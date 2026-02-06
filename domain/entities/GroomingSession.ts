import { TaskCategory, CleanArchitectureArea } from "./ExecutionPlan";

export interface GroomingSessionMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: "high" | "medium" | "low";
  cleanArchitectureArea: CleanArchitectureArea;
  acceptanceCriteria: string[];
  status: "pending" | "approved" | "rejected";
  epicId?: string;
}

export interface SuggestedEpic {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  taskIds: string[];
  status: "pending" | "approved" | "rejected";
}

export interface GroomingSession {
  id: string;
  projectId: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: "active" | "completed";
  pinned?: boolean;
  suggestedTasks: SuggestedTask[];
  suggestedEpics: SuggestedEpic[];
}
