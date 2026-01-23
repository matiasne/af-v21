export type StepStatus =
  | "configuration"
  | "queue"
  | "clone"
  | "clear_conversation"
  | "tech_stack_analysis"
  | "inventory"
  | "files_business_analysis"
  | "files_functional_analysis"
  | "upload_to_rag"
  | "modules_detection"
  | "generate_fdd_toc"
  | "enrich_fdd_toc"
  | "sanitize_fdd_toc"
  | "generate_legacy_fdd"
  | "completed"
  | "error";

// Step labels for display
export const STEP_LABELS: Record<StepStatus, string> = {
  configuration: "Configuration",
  queue: "Queue",
  clone: "Clone",
  clear_conversation: "Clear Conversation",
  tech_stack_analysis: "Tech Stack Analysis",
  inventory: "Inventory",
  files_business_analysis: "Business Analysis",
  files_functional_analysis: "Functional Analysis",
  upload_to_rag: "Upload to RAG",
  modules_detection: "Modules Detection",
  generate_fdd_toc: "Generate FDD TOC",
  enrich_fdd_toc: "Enrich FDD TOC",
  sanitize_fdd_toc: "Sanitize FDD TOC",
  generate_legacy_fdd: "Generate Legacy FDD",
  completed: "Completed",
  error: "Error",
};

// Step descriptions
export const STEP_DESCRIPTIONS: Record<StepStatus, string> = {
  configuration: "Configure the target tech stack for your project migration",
  queue: "Your project is waiting to be processed",
  clone: "Cloning repository and creating worktree",
  clear_conversation: "Resetting agent conversation history",
  tech_stack_analysis: "Detecting languages, frameworks, and technologies",
  inventory: "Indexing project files and structure",
  files_business_analysis: "Analyzing business logic and requirements",
  files_functional_analysis: "Analyzing technical and functional aspects",
  upload_to_rag: "Uploading analyses to Gemini File Search",
  modules_detection: "Detecting modules and features",
  generate_fdd_toc: "Generating Functional Design Document outline",
  enrich_fdd_toc: "Validating file references in FDD",
  sanitize_fdd_toc: "Removing duplicates and adding summaries",
  generate_legacy_fdd: "Generating FDD markdown documents",
  completed: "Processing completed successfully",
  error: "An error occurred during processing",
};

// Processing steps (excludes configuration and terminal states)
export const PROCESSING_STEPS: StepStatus[] = [
  "clone",
  "clear_conversation",
  "tech_stack_analysis",
  "inventory",
  "files_business_analysis",
  "files_functional_analysis",
  "upload_to_rag",
  "modules_detection",
  "generate_fdd_toc",
  "enrich_fdd_toc",
  "sanitize_fdd_toc",
  "generate_legacy_fdd",
];

// Phase types
export type StepPhase = "analysis" | "migration";

// Steps by phase
export const ANALYSIS_PHASE_STEPS: StepStatus[] = [
  "clone",
  "clear_conversation",
  "tech_stack_analysis",
  "inventory",
  "files_business_analysis",
  "files_functional_analysis",
  "upload_to_rag",
  "modules_detection",
  "generate_fdd_toc",
  "enrich_fdd_toc",
  "sanitize_fdd_toc",
  "generate_legacy_fdd",
];

export const MIGRATION_PHASE_STEPS: StepStatus[] = [];

// Phase configurations
export const PHASE_CONFIGS: Record<StepPhase, { label: string; description: string }> = {
  analysis: {
    label: "Project Analysis & Documentation",
    description: "Analyzing the legacy codebase and generating documentation",
  },
  migration: {
    label: "Migration Planning",
    description: "Generating requirements and execution plan for migration",
  },
};

// Helper function to get step label
export function getStepLabel(step: StepStatus): string {
  return STEP_LABELS[step] || step;
}

// Helper function to get step description
export function getStepDescription(step: StepStatus): string {
  return STEP_DESCRIPTIONS[step] || "";
}

// Helper function to check if step is in processing
export function isProcessingStep(step: StepStatus): boolean {
  return PROCESSING_STEPS.includes(step);
}

// Helper function to get step phase
export function getStepPhase(step: StepStatus): StepPhase | null {
  if (ANALYSIS_PHASE_STEPS.includes(step)) return "analysis";
  if (MIGRATION_PHASE_STEPS.includes(step)) return "migration";
  return null;
}

// Helper function to get steps by phase
export function getStepsByPhase(phase: StepPhase): StepStatus[] {
  return phase === "analysis" ? ANALYSIS_PHASE_STEPS : MIGRATION_PHASE_STEPS;
}

// Helper function to get phase info for progress display
export interface PhaseInfo {
  phase: StepPhase;
  label: string;
  description: string;
  steps: StepStatus[];
  completedSteps: StepStatus[];
  currentStep: StepStatus | null;
  isCompleted: boolean;
  isInProgress: boolean;
  progress: number;
}

export function getPhaseInfo(currentStep: StepStatus, completedSteps: string[]): PhaseInfo[] {
  const phases: StepPhase[] = ["analysis", "migration"];

  return phases.map((phase) => {
    const steps = getStepsByPhase(phase);
    const config = PHASE_CONFIGS[phase];
    const phaseCompletedSteps = steps.filter((s) => completedSteps.includes(s));
    const currentInPhase = steps.includes(currentStep) ? currentStep : null;
    const isCompleted = phaseCompletedSteps.length === steps.length;
    const isInProgress = currentInPhase !== null && !isCompleted;
    const progress = steps.length > 0 ? (phaseCompletedSteps.length / steps.length) * 100 : 0;

    return {
      phase,
      label: config.label,
      description: config.description,
      steps,
      completedSteps: phaseCompletedSteps,
      currentStep: currentInPhase,
      isCompleted,
      isInProgress,
      progress,
    };
  });
}

export interface ConfigChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// UI Type for project workflow
export type UIType = "migration" | "start_from_doc" | "chat_planning";

// UI Type configurations
export const UI_TYPE_CONFIGS: Record<UIType, { label: string; description: string }> = {
  migration: {
    label: "Migration",
    description: "Migrate your legacy codebase to a new tech stack with automated analysis and execution plans.",
  },
  start_from_doc: {
    label: "Start from Documentation",
    description: "Begin with existing documentation to generate requirements and implementation plans.",
  },
  chat_planning: {
    label: "Chat Planning",
    description: "Use conversational AI to plan and design your project architecture interactively.",
  },
};

export interface LegacyFile {
  id?: string;
  name: string;
  relative_path: string;
  extension: string;
  sizeInBytes: number;
  type?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectAnalysis {
  legacyTechStack?: string[];
  newTechStack?: string[];
  summary?: string;
}

export interface ProjectStatus {
  step: StepStatus;
  updatedAt: number;
  description?: string;
  startFrom?: StepStatus;
  executeOnly?: StepStatus;
  ignoreSteps?: StepStatus[];
  processId?: string;
}

export type ProjectRole = "owner" | "editor" | "viewer";

export interface ProjectShare {
  userId: string;
  email: string;
  role: ProjectRole;
  sharedAt: number;
  sharedBy: string;
}

export interface Project {
  id?: string;
  name: string;
  description: string;
  githubUrl?: string;
  uiType?: UIType;
  status?: ProjectStatus;
  analysis?: ProjectAnalysis;
  filesExtensions?: string[];
  files?: LegacyFile[];
  executorModel?: string;
  ownerId?: string;
  sharedWith?: ProjectShare[];
  createdAt?: number;
  updatedAt?: number;
}

export interface ProjectDocument {
  id: string;
  name: string;
  fileName: string;
  size: number;
  type: string;
  storageRef: string;
  uploadedAt: number;
}
