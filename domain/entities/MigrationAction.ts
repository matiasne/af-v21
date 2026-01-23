import { StepStatus } from "./Project";

export type AgentProvider = "claude" | "openrouter";

export type MigrationActionType = "start" | "stop" | "resume" | "running" | "delete" | "deleting" | "server_stop" | "completed" | "error";

export interface StepAgentConfig {
  provider: AgentProvider;
  model?: string;
}

export interface MigrationAction {
  id: string;
  name?: string;
  currentStep: StepStatus;
  updatedAt: number;
  createdAt?: number;
  description?: string;
  action?: MigrationActionType;
  startFrom?: StepStatus;
  executeOnly?: StepStatus;
  ignoreSteps: StepStatus[];
  ragFunctionalAndBusinessStoreName?: string;
  sddRagStoreName?: string;
  stepAgents: Record<string, StepAgentConfig>;
  defaultAgent?: StepAgentConfig;
  processorHost?: string;
  githubUrl?: string;
}

export interface StepResult {
  id: string;
  step: StepStatus;
  startDate: number;
  finishDate?: number;
  duration?: number;
  status: "in_progress" | "completed" | "error";
  metadata?: Record<string, unknown>;
  error?: string;
  errorDetails?: string;
}

export interface ProcessResult {
  id: string;
  startDate: number;
  finishDate?: number;
  status: "in_progress" | "completed" | "error";
  currentStep?: StepStatus;
  stepsCompleted: string[];
  outputs: Record<string, unknown>;
  ragStoreName?: string;
  error?: string;
  errorDetails?: string;
}

// Helper function to create a new MigrationAction
export function createMigrationAction(
  overrides?: Partial<MigrationAction>
): Omit<MigrationAction, "id"> {
  const now = Date.now();
  return {
    currentStep: "configuration",
    createdAt: now,
    updatedAt: now,
    description: "Awaiting user configuration",
    ignoreSteps: [],
    stepAgents: {},
    ...overrides,
  };
}

// Available Claude models
export const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
  { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet" },
] as const;

// Available OpenRouter models
export const OPENROUTER_MODELS = [
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "google/gemini-pro-1.5", name: "Gemini Pro 1.5" },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B" },
] as const;

// Agent provider options
export const AGENT_PROVIDERS: { id: AgentProvider; name: string; description: string }[] = [
  {
    id: "claude",
    name: "Claude Code",
    description: "Use Claude Code CLI for processing"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Use OpenRouter API with various models"
  },
];
