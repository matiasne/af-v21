"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";

import {
  StepStatus,
  PROCESSING_STEPS,
  getStepLabel,
} from "@/domain/entities/Project";

interface PipelineProgressCardProps {
  currentStep: StepStatus;
  stepUpdatedAt: number;
  stepDescription?: string;
  formatDate: (timestamp: number) => string;
}

export function PipelineProgressCard({
  currentStep,
  stepUpdatedAt,
  stepDescription,
  formatDate,
}: PipelineProgressCardProps) {
  const currentStepIndex = PROCESSING_STEPS.indexOf(currentStep);

  // Show a condensed version of steps for the progress bar
  const displaySteps = PROCESSING_STEPS.filter(
    (step: StepStatus) => step !== "clone" && step !== "clear_conversation",
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="text-lg font-semibold">Pipeline Progress</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        <div className="mb-6">
          <div className="flex items-center justify-between overflow-x-auto">
            {displaySteps.map((step: StepStatus, index: number) => {
              const stepIndex = PROCESSING_STEPS.indexOf(step);
              const isCompleted = currentStepIndex > stepIndex;
              const isCurrent = step === currentStep;
              const isPending = currentStepIndex < stepIndex;

              return (
                <div key={step} className="flex flex-1 items-center min-w-0">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                        isCompleted
                          ? "bg-success text-white"
                          : isCurrent
                            ? "bg-primary-100 text-primary-700 ring-2 ring-offset-2 ring-primary"
                            : "bg-default-100 text-default-400"
                      }`}
                    >
                      {isCompleted ? (
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M5 13l4 4L19 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                          />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={`mt-1 text-center text-[10px] max-w-[60px] truncate ${
                        isCurrent
                          ? "font-semibold text-foreground"
                          : isPending
                            ? "text-default-400"
                            : "text-default-600"
                      }`}
                      title={getStepLabel(step)}
                    >
                      {getStepLabel(step)}
                    </span>
                  </div>
                  {index < displaySteps.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 min-w-[8px] ${
                        isCompleted ? "bg-success" : "bg-default-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Step Details */}
        <Divider className="my-4" />
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-default-500">Current Step</p>
            <p className="text-lg font-semibold">{getStepLabel(currentStep)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-default-500">
              Step Updated At
            </p>
            <p>{formatDate(stepUpdatedAt)}</p>
          </div>
          {stepDescription && (
            <div>
              <p className="text-sm font-medium text-default-500">
                Step Description
              </p>
              <p className="text-default-600">{stepDescription}</p>
            </div>
          )}
          {currentStepIndex >= 0 &&
            currentStepIndex < PROCESSING_STEPS.length - 1 && (
              <div>
                <p className="text-sm font-medium text-default-500">
                  Next Step
                </p>
                <p>{getStepLabel(PROCESSING_STEPS[currentStepIndex + 1])}</p>
              </div>
            )}
        </div>
      </CardBody>
    </Card>
  );
}
