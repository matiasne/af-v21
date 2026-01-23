"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";

import { MigrationAction, StepResult } from "@/domain/entities/MigrationAction";
import {
  StepStatus,
  getStepLabel,
  PROCESSING_STEPS,
} from "@/domain/entities/Project";
import { GradientBorderWrapper } from "./GradientBorderWrapper";

interface MigrationStatusCardProps {
  migration: MigrationAction | null;
  stepResults: StepResult[];
  currentStep: StepStatus | null;
  isProcessing: boolean;
  isCompleted: boolean;
  isError: boolean;
  isStopped: boolean;
  isPaused: boolean;
  progress: number;
  onNavigateToMigration: () => void;
  isLoading?: boolean;
}

export function MigrationStatusCard({
  migration,
  stepResults,
  currentStep,
  isProcessing,
  isCompleted,
  isError,
  isStopped,
  isPaused,
  progress,
  onNavigateToMigration,
  isLoading = false,
}: MigrationStatusCardProps) {
  const hasStarted = !!migration?.action;
  const completedStepsCount = stepResults.filter(
    (r) => r.status === "completed",
  ).length;
  const totalSteps = PROCESSING_STEPS.length;

  // Determine the status chip
  const getStatusChip = () => {
    if (isLoading) {
      return (
        <Chip size="sm" color="default" variant="flat">
          Loading...
        </Chip>
      );
    }
    if (isCompleted) {
      return (
        <Chip size="sm" color="success" variant="flat">
          Completed
        </Chip>
      );
    }
    if (isError) {
      return (
        <Chip size="sm" color="danger" variant="flat">
          Error
        </Chip>
      );
    }
    if (isStopped) {
      return (
        <Chip size="sm" color="warning" variant="flat">
          Stopped
        </Chip>
      );
    }
    if (isPaused) {
      return (
        <Chip size="sm" color="secondary" variant="flat">
          Paused
        </Chip>
      );
    }
    if (isProcessing) {
      return (
        <Chip size="sm" color="primary" variant="flat">
          Running
        </Chip>
      );
    }
    if (!hasStarted) {
      return (
        <Chip size="sm" color="default" variant="flat">
          Not Started
        </Chip>
      );
    }
    return null;
  };

  return (
    <GradientBorderWrapper isActive={isProcessing}>
      <Card className="w-full h-full">
        <CardHeader className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold">Code Analysis</h3>
          </div>
          {getStatusChip()}
        </CardHeader>
        <Divider />
        <CardBody className="space-y-4 h-full">
          {isLoading && !isPaused ? (
            <div className="flex items-center justify-center py-8">
              <Spinner color="primary" />
            </div>
          ) : !hasStarted && !isPaused ? (
            // Not started state
            <div className="text-center py-6">
              <div className="mb-4">
                <svg
                  className="h-12 w-12 mx-auto text-default-300"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                  />
                </svg>
              </div>
              <p className="text-default-500 mb-4">
                No code analysis in progress. Start the analysis process to
                generate documentation from your codebase.
              </p>
              <Button color="primary" onPress={onNavigateToMigration}>
                Start Analysis
              </Button>
            </div>
          ) : (
            // Running, stopped, completed, or error state
            <>
              {/* Progress Section */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">Progress</span>
                  <span className="font-medium">{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  color={
                    isCompleted
                      ? "success"
                      : isError
                        ? "danger"
                        : isStopped
                          ? "warning"
                          : isPaused
                            ? "secondary"
                            : "primary"
                  }
                  size="md"
                  className="w-full"
                />
                <p className="text-xs text-default-400">
                  {completedStepsCount} of {totalSteps} steps completed
                </p>
              </div>

              {/* Current Step */}
              {currentStep && isProcessing && !isStopped && !isPaused && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" color="primary" />
                    <div>
                      <p className="text-sm font-medium text-primary-600 dark:text-primary-400">
                        {getStepLabel(currentStep)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stopped Message */}
              {isStopped && currentStep && (
                <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-warning-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-warning-600 dark:text-warning-400">
                      Stopped at: {getStepLabel(currentStep)}
                    </p>
                  </div>
                </div>
              )}

              {/* Paused Message (server_stop) */}
              {isPaused && currentStep && (
                <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-secondary-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-sm text-secondary-600 dark:text-secondary-400">
                      Server stops at: {getStepLabel(currentStep)}
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {isError && (
                <div className="bg-danger-50 dark:bg-danger-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-danger-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                      />
                    </svg>
                    <p className="text-sm text-danger-600 dark:text-danger-400">
                      An error occurred during migration
                    </p>
                  </div>
                </div>
              )}

              {/* Completed Message */}
              {isCompleted && (
                <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-5 w-5 text-success-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <p className="text-sm text-success-600 dark:text-success-400">
                      Migration completed successfully
                    </p>
                  </div>
                </div>
              )}

              {/* View Details Button */}
              <Button
                color="primary"
                variant={isProcessing ? "solid" : "flat"}
                fullWidth
                onPress={onNavigateToMigration}
              >
                {isProcessing
                  ? "View Progress"
                  : isCompleted
                    ? "View Results"
                    : "View Migration"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>
    </GradientBorderWrapper>
  );
}
