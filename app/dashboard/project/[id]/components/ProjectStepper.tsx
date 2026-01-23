"use client";

import { useMemo } from "react";

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

  return (
    <div className="w-full mb-6 p-6 bg-default-50 dark:bg-default-900 rounded-lg shadow-sm">
      {/* Step indicators */}
      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-default-200 dark:bg-default-700 -z-10" />

        {/* Progress line filled */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-300 -z-10"
          style={{
            width: `${(getStepIndex(currentStep) / (steps.length - 1)) * 100}%`,
          }}
        />

        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isActive = step.id === currentStep;
          const isPast = getStepIndex(step.id) < getStepIndex(currentStep);
          const isCompleted = status === "completed";
          const isRunning = status === "running";

          return (
            <button
              key={step.id}
              onClick={() => onStepChange(step.id)}
              className={`flex flex-row gap-6 items-center relative z-10 transition-all duration-200 ${
                isActive ? "scale-105" : "hover:scale-102"
              }`}
            >
              {/* Step circle */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/30"
                    : isCompleted || isPast
                      ? "bg-primary text-primary-foreground"
                      : "bg-default-100 dark:bg-default-800 text-default-500"
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="h-5 w-5"
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
                ) : isRunning ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  index + 1
                )}
              </div>

              {/* Step label */}
              <div className="mt-0 text-center">
                <p
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-primary"
                      : isCompleted || isPast
                        ? "text-default-700 dark:text-default-300"
                        : "text-default-400"
                  }`}
                >
                  {step.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
