"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Progress } from "@heroui/progress";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

import {
  MigrationAction,
  ProcessResult,
  StepResult,
} from "@/domain/entities/MigrationAction";
import {
  StepStatus,
  PROCESSING_STEPS,
  getStepLabel,
  getStepDescription,
  getPhaseInfo,
} from "@/domain/entities/Project";
import { TechStackAnalysis } from "@/domain/entities/TechStackAnalysis";

interface MigrationProgressCardProps {
  migration: MigrationAction | null;
  processResult: ProcessResult | null;
  stepResults: StepResult[];
  techStackAnalysis?: TechStackAnalysis | null;
  onStart?: () => Promise<void>;
  onStop?: () => Promise<void>;
  onResume?: () => Promise<void>;
  onOpenConfig?: () => void;
  isLoading?: boolean;
  canStartMigration?: boolean;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function MigrationProgressCard({
  migration,
  processResult,
  stepResults,
  techStackAnalysis,
  onStart,
  onStop,
  onResume,
  onOpenConfig,
  isLoading = false,
  canStartMigration = false,
}: MigrationProgressCardProps) {
  const currentStep = migration?.currentStep;
  const action = migration?.action;

  // Determine status based on action field
  const hasNoAction = !action;
  const isRunning = action === "running";
  const isStopped = action === "stop";
  const isServerStopped = action === "server_stop";
  const isDeleting = action === "deleting";

  // isInProcessingState: true when in a processing step (regardless of action)
  const isInProcessingState = useMemo(() => {
    if (!currentStep) return false;
    return PROCESSING_STEPS.includes(currentStep) || currentStep === "queue";
  }, [currentStep]);

  const isCompleted = currentStep === "completed";
  const isError = currentStep === "error";

  const completedSteps = useMemo(() => {
    return processResult?.stepsCompleted || [];
  }, [processResult]);

  const stepResultsMap = useMemo(() => {
    const map = new Map<string, StepResult>();
    stepResults.forEach((result) => {
      map.set(result.step, result);
    });
    return map;
  }, [stepResults]);

  // Get phase information
  const phaseInfoData = useMemo(() => {
    if (!currentStep) return [];
    return getPhaseInfo(currentStep, completedSteps);
  }, [currentStep, completedSteps]);

  const getStepStatus = (
    step: StepStatus,
  ): "completed" | "in_progress" | "pending" | "error" | "skipped" => {
    // If migration hasn't started (no action and no processing step), all steps are pending
    if (!action && (!currentStep || !PROCESSING_STEPS.includes(currentStep))) {
      return migration?.ignoreSteps?.includes(step) ? "skipped" : "pending";
    }

    // Check if skipped
    if (migration?.ignoreSteps?.includes(step)) {
      return "skipped";
    }

    // Check if current step first (takes priority)
    if (currentStep === step) {
      return "in_progress";
    }

    // Check step result from step_results collection
    const result = stepResultsMap.get(step);
    if (result) {
      if (result.status === "error") return "error";
      if (result.status === "completed") return "completed";
      if (result.status === "in_progress") return "in_progress";
    }

    // Check if completed based on step order (only if current step is past this step)
    if (currentStep) {
      const currentStepIndex = PROCESSING_STEPS.indexOf(currentStep);
      const thisStepIndex = PROCESSING_STEPS.indexOf(step);

      // If current step is past this step, it's completed
      if (thisStepIndex >= 0 && currentStepIndex > thisStepIndex) {
        return "completed";
      }
    }

    // Check if completed from process result (fallback)
    if (completedSteps.includes(step)) {
      return "completed";
    }

    return "pending";
  };

  const getStepStatusColor = (
    status: "completed" | "in_progress" | "pending" | "error" | "skipped",
  ) => {
    switch (status) {
      case "completed":
        return "success";
      case "in_progress":
        return "primary";
      case "error":
        return "danger";
      case "skipped":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusChip = () => {
    if (isCompleted) {
      return (
        <Chip color="success" variant="flat">
          Completed
        </Chip>
      );
    }
    if (isError) {
      return (
        <Chip color="danger" variant="flat">
          Error
        </Chip>
      );
    }
    if (isStopped && isInProcessingState) {
      return (
        <Chip color="warning" variant="flat">
          Stopped
        </Chip>
      );
    }
    if (isServerStopped && isInProcessingState) {
      return (
        <Chip color="danger" variant="flat">
          Server Issue
        </Chip>
      );
    }
    if (isDeleting) {
      return (
        <Chip
          color="danger"
          variant="flat"
          startContent={<Spinner size="sm" />}
        >
          Deleting
        </Chip>
      );
    }
    if (isRunning) {
      return (
        <Chip
          color="primary"
          variant="flat"
          startContent={<Spinner size="sm" />}
        >
          Running
        </Chip>
      );
    }
    if (isInProcessingState) {
      return (
        <Chip
          color="primary"
          variant="flat"
          startContent={<Spinner size="sm" />}
        >
          Processing
        </Chip>
      );
    }
    return (
      <Chip color="default" variant="flat">
        Idle
      </Chip>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            {migration?.id && (
              <span className="text-xs text-default-400 font-mono">
                ID: {migration.id}
              </span>
            )}
            {getStatusChip()}
          </div>
          <div className="flex items-center gap-3">
            {hasNoAction && onStart && (
              <Button
                size="sm"
                color="primary"
                onPress={onStart}
                isLoading={isLoading}
                isDisabled={!canStartMigration}
              >
                Start
              </Button>
            )}
            {(isError || isStopped) && !isCompleted && onResume && (
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={onResume}
                isLoading={isLoading}
              >
                Resume
              </Button>
            )}
            {isRunning && !isCompleted && !isError && onStop && (
              <Button
                size="sm"
                color="warning"
                variant="flat"
                onPress={onStop}
                isLoading={isLoading}
              >
                Stop
              </Button>
            )}
            {onOpenConfig && (
              <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={onOpenConfig}
                isDisabled={isRunning || isDeleting}
                title="Configuration"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        {/* Current Step Info */}
        {currentStep && isRunning && isInProcessingState && (
          <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Spinner size="sm" color="primary" />
              <div>
                <p className="font-medium text-primary-600 dark:text-primary-400">
                  {getStepLabel(currentStep)}
                </p>
                <p className="text-xs text-default-500">
                  {getStepDescription(currentStep)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stopped Info */}
        {currentStep && isStopped && isInProcessingState && (
          <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-warning-600 dark:text-warning-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="font-medium text-warning-600 dark:text-warning-400">
                    Stopped at: {getStepLabel(currentStep)}
                  </p>
                  <p className="text-xs text-default-500">
                    Process was stopped by user.
                  </p>
                </div>
              </div>
              {onResume && (
                <Button
                  size="sm"
                  color="primary"
                  onPress={onResume}
                  isLoading={isLoading}
                >
                  Resume
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Server Stopped Warning */}
        {currentStep && isServerStopped && isInProcessingState && (
          <div className="bg-danger-50 dark:bg-danger-900/20 rounded-lg p-4 border border-danger-200 dark:border-danger-800">
            <div className="flex items-center gap-3">
              <svg
                className="w-6 h-6 text-danger-600 dark:text-danger-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div className="flex-1">
                <p className="font-medium text-danger-600 dark:text-danger-400">
                  Server Connection Issue
                </p>
                <p className="text-sm text-default-600 mt-1">
                  The server has stopped unexpectedly. The process will continue
                  automatically as soon as the problem is resolved.
                </p>
                <p className="text-xs text-default-400 mt-2">
                  Last step: {getStepLabel(currentStep)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deleting Info */}
        {isDeleting && (
          <div className="bg-danger-50 dark:bg-danger-900/20 rounded-lg p-4 border border-danger-200 dark:border-danger-800">
            <div className="flex items-center gap-3">
              <Spinner size="md" color="danger" />
              <div className="flex-1">
                <p className="font-medium text-danger-600 dark:text-danger-400">
                  Deleting Migration
                </p>
                <p className="text-sm text-default-600 mt-1">
                  This migration is being deleted. Please wait...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Info */}
        {isError && processResult?.error && (
          <div className="bg-danger-50 dark:bg-danger-900/20 rounded-lg p-4">
            <p className="font-medium text-danger-600 dark:text-danger-400">
              Error Occurred
            </p>
            <p className="text-sm text-default-600 mt-1">
              {processResult.error}
            </p>
            {processResult.errorDetails && (
              <p className="text-xs text-default-400 mt-2 font-mono whitespace-pre-wrap">
                {processResult.errorDetails}
              </p>
            )}
          </div>
        )}

        <Divider />

        {/* Phase-based Steps Timeline */}
        <div className="space-y-6">
          {phaseInfoData
            .filter((phase) => phase.steps.length > 0)
            .map((phase, phaseIndex, filteredPhases) => {
              // Filter out setup steps that shouldn't be shown to users
              const hiddenSteps: StepStatus[] = ["clone", "clear_conversation"];
              const phaseSteps = phase.steps.filter(
                (s) => !hiddenSteps.includes(s),
              );
              const visibleCompletedSteps = phase.completedSteps.filter(
                (s) => !hiddenSteps.includes(s),
              );

              return (
                <div key={phase.phase} className="space-y-3">
                  {/* Phase Steps */}
                  <div className="space-y-2">
                    {phaseSteps.map((step: StepStatus, stepIndex: number) => {
                      const status = getStepStatus(step);
                      const stepLabel = getStepLabel(step);
                      const stepDescription = getStepDescription(step);
                      const result = stepResultsMap.get(step);
                      const statusColor = getStepStatusColor(status);

                      // Get agent config for this step
                      const stepAgent = migration?.stepAgents?.[step];
                      const defaultAgent = migration?.defaultAgent;
                      const agentConfig = stepAgent || defaultAgent;
                      const isOverride = !!stepAgent;

                      return (
                        <div key={step} className="space-y-2">
                          <div
                            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                              status === "in_progress" && isStopped
                                ? "bg-warning-50 dark:bg-warning-900/20"
                                : status === "in_progress"
                                  ? "bg-primary-50 dark:bg-primary-900/20"
                                  : status === "error"
                                    ? "bg-danger-50 dark:bg-danger-900/20"
                                    : "bg-content2"
                            }`}
                          >
                            {/* Step Number/Status Icon */}
                            <div
                              className={`
                            w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                            ${
                              status === "completed"
                                ? "bg-success text-white"
                                : status === "in_progress" && isStopped
                                  ? "bg-warning text-white"
                                  : status === "in_progress"
                                    ? "bg-primary text-white"
                                    : status === "error"
                                      ? "bg-danger text-white"
                                      : status === "skipped"
                                        ? "bg-warning text-white"
                                        : "bg-default-200 text-default-500"
                            }
                          `}
                            >
                              {status === "completed" ? (
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              ) : status === "error" ? (
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              ) : status === "in_progress" && isStopped ? (
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M10 9v6m4-6v6"
                                  />
                                </svg>
                              ) : status === "in_progress" ? (
                                <Spinner size="sm" color="white" />
                              ) : status === "skipped" ? (
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                                  />
                                </svg>
                              ) : (
                                stepIndex + 1
                              )}
                            </div>

                            {/* Step Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p
                                  className={`font-medium text-sm truncate ${
                                    status === "pending"
                                      ? "text-default-400"
                                      : ""
                                  }`}
                                >
                                  {stepLabel}
                                </p>
                                <Chip
                                  size="sm"
                                  color={
                                    status === "in_progress" && isStopped
                                      ? "warning"
                                      : statusColor
                                  }
                                  variant="flat"
                                >
                                  {status === "in_progress" && isStopped
                                    ? "Stopped"
                                    : status === "in_progress"
                                      ? "Running"
                                      : status}
                                </Chip>
                              </div>
                              <p className="text-xs text-default-400 truncate">
                                {stepDescription}
                              </p>
                              {/* Agent Info */}
                              {agentConfig && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-default-500">
                                    {agentConfig.provider === "claude"
                                      ? "Claude Code"
                                      : "OpenRouter"}
                                    {agentConfig.model &&
                                      ` • ${agentConfig.model}`}
                                  </span>
                                  <Chip
                                    size="sm"
                                    variant="bordered"
                                    color={isOverride ? "secondary" : "default"}
                                    className="h-4 text-[10px]"
                                  >
                                    {isOverride ? "Override" : "Default"}
                                  </Chip>
                                </div>
                              )}
                            </div>

                            {/* Duration/Timing */}
                            {result && (
                              <div className="text-right text-xs text-default-400 flex-shrink-0">
                                {result.duration && (
                                  <p className="font-medium">
                                    {formatDuration(result.duration)}
                                  </p>
                                )}
                                {result.finishDate ? (
                                  <p>{formatTimestamp(result.finishDate)}</p>
                                ) : result.startDate ? (
                                  <p>
                                    Started {formatTimestamp(result.startDate)}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </div>
                          {/* Tech Stack Analysis Display (for tech_stack_analysis step) */}
                          {step === "tech_stack_analysis" &&
                            result?.status === "completed" &&
                            techStackAnalysis && (
                              <div className="ml-10 p-4 rounded-lg bg-success-50 dark:bg-success-900/20 space-y-3">
                                {/* Summary */}
                                {techStackAnalysis.summary && (
                                  <p className="text-sm text-default-700 dark:text-default-300">
                                    {techStackAnalysis.summary}
                                  </p>
                                )}

                                {/* Tech Categories */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Languages */}
                                  {techStackAnalysis.languages.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Languages
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.languages.map(
                                          (item) => (
                                            <Chip
                                              key={item.name}
                                              size="sm"
                                              variant="flat"
                                              color="primary"
                                            >
                                              {item.name}
                                            </Chip>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Frameworks */}
                                  {techStackAnalysis.frameworks.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Frameworks
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.frameworks.map(
                                          (item) => (
                                            <Chip
                                              key={item.name}
                                              size="sm"
                                              variant="flat"
                                              color="secondary"
                                            >
                                              {item.name}
                                            </Chip>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Databases */}
                                  {techStackAnalysis.databases.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Databases
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.databases.map(
                                          (item) => (
                                            <Chip
                                              key={item.name}
                                              size="sm"
                                              variant="flat"
                                              color="warning"
                                            >
                                              {item.name}
                                            </Chip>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Build Tools */}
                                  {techStackAnalysis.buildTools.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Build Tools
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.buildTools.map(
                                          (item) => (
                                            <Chip
                                              key={item.name}
                                              size="sm"
                                              variant="flat"
                                              color="default"
                                            >
                                              {item.name}
                                            </Chip>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Package Managers */}
                                  {techStackAnalysis.packageManagers.length >
                                    0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Package Managers
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.packageManagers.map(
                                          (item) => (
                                            <Chip
                                              key={item.name}
                                              size="sm"
                                              variant="flat"
                                              color="default"
                                            >
                                              {item.name}
                                            </Chip>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Testing Frameworks */}
                                  {techStackAnalysis.testingFrameworks.length >
                                    0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Testing
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.testingFrameworks.map(
                                          (item) => (
                                            <Chip
                                              key={item.name}
                                              size="sm"
                                              variant="flat"
                                              color="success"
                                            >
                                              {item.name}
                                            </Chip>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Tools */}
                                  {techStackAnalysis.tools.length > 0 && (
                                    <div>
                                      <span className="text-xs font-medium text-default-500">
                                        Tools
                                      </span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {techStackAnalysis.tools.map((item) => (
                                          <Chip
                                            key={item.name}
                                            size="sm"
                                            variant="flat"
                                            color="default"
                                          >
                                            {item.name}
                                          </Chip>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          {/* Step Metadata (for completed steps - except tech_stack_analysis which has custom display) */}
                          {step !== "tech_stack_analysis" &&
                            result?.status === "completed" &&
                            result.metadata &&
                            Object.keys(result.metadata).length > 0 && (
                              <div className="ml-10 p-3 rounded-lg bg-success-50 dark:bg-success-900/20">
                                <div className="flex flex-wrap gap-3">
                                  {Object.entries(result.metadata).map(
                                    ([key, value]) => (
                                      <div key={key} className="text-xs">
                                        <span className="text-default-500">
                                          {key}:{" "}
                                        </span>
                                        <span className="font-medium text-success-600 dark:text-success-400">
                                          {typeof value === "number"
                                            ? value.toLocaleString()
                                            : typeof value === "object"
                                              ? JSON.stringify(value)
                                              : String(value)}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          {/* Step Error Details */}
                          {result?.status === "error" && result.error && (
                            <div className="ml-10 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20">
                              <p className="text-sm text-danger-600 dark:text-danger-400 font-medium">
                                {result.error}
                              </p>
                              {result.errorDetails && (
                                <p className="text-xs text-default-500 mt-1 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                                  {result.errorDetails}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Divider between phases */}
                  {phaseIndex < filteredPhases.length - 1 && (
                    <Divider className="my-4" />
                  )}
                </div>
              );
            })}
        </div>

        {/* Process Info */}
        {processResult && (
          <>
            <Divider />
            <div className="flex justify-between text-xs text-default-400">
              <span>Process ID: {processResult.id}</span>
              <span>Started: {formatTimestamp(processResult.startDate)}</span>
              {processResult.finishDate && (
                <span>
                  Finished: {formatTimestamp(processResult.finishDate)}
                </span>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
