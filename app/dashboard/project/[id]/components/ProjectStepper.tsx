"use client";

import { useMemo } from "react";
import { Tabs, Tab } from "@heroui/tabs";

import { UIType } from "@/domain/entities/Project";

export type ProjectStep =
  | "configuration"
  | "code_analysis"
  | "migration_planner";

interface Step {
  id: ProjectStep;
  label: string;
  description: string;
}

const MIGRATION_STEPS: Step[] = [
  {
    id: "configuration",
    label: "Configuration",
    description: "Set up repository and tech stack",
  },
  {
    id: "code_analysis",
    label: "Code Analysis",
    description: "Analyze codebase and generate documentation",
  },
  {
    id: "migration_planner",
    label: "Migration Planner",
    description: "Plan and track migration tasks",
  },
];

const START_FROM_DOC_STEPS: Step[] = [
  {
    id: "configuration",
    label: "Configuration",
    description: "Upload documents and configure tech stack",
  },
  {
    id: "migration_planner",
    label: "Planner",
    description: "Plan and track implementation tasks",
  },
];

interface ProjectStepperProps {
  currentStep: ProjectStep;
  onStepChange: (step: ProjectStep) => void;
  uiType?: UIType;
  isConfigurationComplete?: boolean;
  isCodeAnalysisComplete?: boolean;
  isCodeAnalysisRunning?: boolean;
  isMigrationPlannerRunning?: boolean;
}

export function ProjectStepper({
  currentStep,
  onStepChange,
  uiType = "migration",
  isConfigurationComplete = false,
  isCodeAnalysisComplete = false,
  isCodeAnalysisRunning = false,
  isMigrationPlannerRunning = false,
}: ProjectStepperProps) {
  const steps = useMemo(() => {
    return uiType === "start_from_doc" ? START_FROM_DOC_STEPS : MIGRATION_STEPS;
  }, [uiType]);

  const getStepStatus = (stepId: ProjectStep) => {
    if (stepId === "configuration") {
      return isConfigurationComplete ? "completed" : "pending";
    }
    if (stepId === "code_analysis") {
      if (isCodeAnalysisComplete) return "completed";
      if (isCodeAnalysisRunning) return "running";
      return "pending";
    }
    if (stepId === "migration_planner") {
      if (isMigrationPlannerRunning) return "running";
      return "pending";
    }
    return "pending";
  };

  const getStepIndex = (stepId: ProjectStep) => {
    return steps.findIndex((s) => s.id === stepId);
  };

  const renderTabTitle = (step: Step) => {
    const status = getStepStatus(step.id);
    const isCompleted = status === "completed";
    const isRunning = status === "running";

    return (
      <div className="flex items-center gap-2">
        {isCompleted && (
          <svg
            className="h-4 w-4 text-success"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        )}
        {isRunning && (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        <span>{step.label}</span>
      </div>
    );
  };

  return (
    <div className="w-full mb-6">
      <Tabs
        aria-label="Project steps"
        color="primary"
        radius="full"
        selectedKey={currentStep}
        onSelectionChange={(key) => onStepChange(key as ProjectStep)}
      >
        {steps.map((step) => (
          <Tab key={step.id} title={renderTabTitle(step)} />
        ))}
      </Tabs>
    </div>
  );
}
