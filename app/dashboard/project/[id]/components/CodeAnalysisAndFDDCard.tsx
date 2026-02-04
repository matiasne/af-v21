"use client";

import { useEffect, useState } from "react";
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
import { FDDTableOfContents } from "@/domain/entities/FDD";
import { fddRepository } from "@/infrastructure/repositories/FirebaseFDDRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

// CodeLoader Animation Component
interface CodeLine {
  indent: number;
  width: number;
  type: "keyword" | "string" | "comment" | "function" | "variable";
}

const codeLines: CodeLine[] = [
  { indent: 0, width: 60, type: "keyword" },
  { indent: 1, width: 80, type: "function" },
  { indent: 2, width: 45, type: "variable" },
  { indent: 2, width: 70, type: "string" },
  { indent: 2, width: 55, type: "variable" },
  { indent: 1, width: 30, type: "keyword" },
  { indent: 0, width: 20, type: "keyword" },
  { indent: 0, width: 0, type: "keyword" },
  { indent: 0, width: 75, type: "comment" },
  { indent: 0, width: 50, type: "function" },
  { indent: 1, width: 65, type: "string" },
  { indent: 1, width: 40, type: "variable" },
  { indent: 0, width: 25, type: "keyword" },
];

const typeColors: Record<CodeLine["type"], string> = {
  keyword: "bg-purple-400/80",
  string: "bg-violet-500/70",
  comment: "bg-purple-300/50",
  function: "bg-fuchsia-500/70",
  variable: "bg-purple-600/60",
};

function CodeLoader({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [activeLine, setActiveLine] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLine((prev) => (prev + 1) % codeLines.length);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    sm: { container: "w-48 p-3", line: "h-1.5", gap: "gap-1.5" },
    md: { container: "w-64 p-4", line: "h-2", gap: "gap-2" },
    lg: { container: "w-80 p-5", line: "h-2.5", gap: "gap-2.5" },
  };

  return (
    <div
      className={`rounded-lg bg-muted/50  backdrop-blur-sm ${sizeClasses[size].container} ${className || ""}`}
      role="status"
      aria-label="Loading"
    >
      {/* Code lines */}
      <div className={`flex flex-col ${sizeClasses[size].gap}`}>
        {codeLines.map((line, index) => {
          const isActive = index === activeLine;
          const isScanned = index < activeLine;
          const isUpcoming = index > activeLine;

          return (
            <div
              key={index}
              className="flex items-center"
              style={{ paddingLeft: `${line.indent * 12}px` }}
            >
              {line.width > 0 && (
                <div
                  className={`${sizeClasses[size].line} rounded-full transition-all duration-200 relative overflow-hidden ${typeColors[line.type]} ${
                    isActive
                      ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-muted/50"
                      : ""
                  } ${isScanned ? "opacity-30" : ""} ${isUpcoming ? "opacity-60" : ""}`}
                  style={{ width: `${line.width}%` }}
                >
                  {/* Scanning glow effect */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CodeAnalysisAndFDDCardProps {
  // Migration props
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
  onStartAnalysis: () => void;
  onStopAnalysis: () => Promise<void> | void;
  onResumeAnalysis: () => Promise<void> | void;
  isLoading?: boolean;
  // FDD props
  projectId: string;
  migrationId: string | undefined;
  onNavigateToFDD: () => void;
  onNavigateToFilesAnalysis: () => void;
  // Validation props
  githubUrl?: string;
  newTechStack?: string[];
  // Code analysis status
  codeAnalysisStatus?: string;
  codeAnalysisError?: string;
  codeAnalysisErrorDetails?: string;
  codeAnalysisCurrentStep?: string;
}

export function CodeAnalysisAndFDDCard({
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
  onStartAnalysis,
  onStopAnalysis,
  onResumeAnalysis,
  isLoading = false,
  projectId,
  migrationId,
  onNavigateToFDD,
  onNavigateToFilesAnalysis,
  githubUrl,
  newTechStack,
  codeAnalysisStatus,
  codeAnalysisError,
  codeAnalysisErrorDetails,
  codeAnalysisCurrentStep,
}: CodeAnalysisAndFDDCardProps) {
  const [isStopping, setIsStopping] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const handleStopAnalysis = async () => {
    setIsStopping(true);
    try {
      await onStopAnalysis();
    } finally {
      setIsStopping(false);
    }
  };

  const handleResumeAnalysis = async () => {
    setIsResuming(true);
    try {
      await onResumeAnalysis();
    } finally {
      setIsResuming(false);
    }
  };
  const { user } = useAuth();
  const [toc, setToc] = useState<FDDTableOfContents | null>(null);
  const [fddLoading, setFddLoading] = useState(true);

  // Migration status logic
  // Consider analysis started if migration has action OR if code-analysis-module has a status
  const hasStarted = !!migration?.action || (!!codeAnalysisStatus && codeAnalysisStatus !== "configuration");
  const completedStepsCount = stepResults.filter(
    (r) => r.status === "completed",
  ).length;
  const totalSteps = PROCESSING_STEPS.length;

  // FDD data loading
  useEffect(() => {
    if (!user?.uid || !projectId || !migrationId) {
      setFddLoading(false);
      return;
    }

    setFddLoading(true);
    const unsubscribe = fddRepository.subscribeTableOfContents(
      user.uid,
      projectId,
      migrationId,
      (updatedToc) => {
        setToc(updatedToc);
        setFddLoading(false);
      },
      (error) => {
        console.error("Error loading FDD TOC:", error);
        setFddLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, projectId, migrationId]);

  const totalSections = toc?.sections.length || 0;
  const totalSubsections =
    toc?.sections.reduce((acc, s) => acc + s.subsections.length, 0) || 0;

  // Calculate unique files count
  const uniqueFiles = toc?.sections.reduce((fileSet, section) => {
    // Add files from section
    section.fileReferences.forEach((file) => fileSet.add(file));
    // Add files from subsections
    section.subsections.forEach((subsection) => {
      subsection.fileReferences.forEach((file) => fileSet.add(file));
    });
    return fileSet;
  }, new Set<string>());
  const totalFiles = uniqueFiles?.size || 0;

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
      <Card className="w-full relative overflow-hidden">
        {/* Progress Background Decoration */}
        {hasStarted && !isLoading && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, ${
                isCompleted
                  ? "rgba(34, 197, 94, 0.08)"
                  : isError
                    ? "rgba(239, 68, 68, 0.08)"
                    : isStopped
                      ? "rgba(234, 179, 8, 0.08)"
                      : "rgba(59, 130, 246, 0.08)"
              } ${progress}%, transparent ${progress}%)`,
              zIndex: 0,
            }}
          />
        )}
        <CardHeader className="flex justify-between items-center relative z-10">
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
            <div>
              <h3 className="text-lg font-semibold">
                Code Analysis & Current Application Knowledge
              </h3>
              <p className="text-xs text-default-500">
                Migration progress and functional design
              </p>
            </div>
          </div>
          {getStatusChip()}
        </CardHeader>
        <Divider className="relative z-10" />
        <CardBody className="space-y-4 relative z-10">
          {/* Progress Section - Full Width at Top */}
          {hasStarted && !isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Overall Progress</span>
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
          )}

          <div className="grid gap-6 grid-cols-1 md:grid-cols-1">
            <div className="space-y-4 flex flex-row items-center">
              {isProcessing && <CodeLoader size="md" />}
              {fddLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner color="secondary" />
                </div>
              ) : !toc || totalSections === 0 ? (
                <></>
              ) : (
                <div className="w-full flex flex-row space-y-4 justify-center">
                  {/* FDD Overview */}
                  <div className="space-y-3">
                    <div className="flex flex-row items-center gap-2 mb-3 text-center">
                      <div className="p-1.5 rounded-lg bg-secondary-100 dark:bg-secondary-900/30">
                        <svg
                          className="h-4 w-4 text-secondary"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-md font-semibold">
                          Current Application Knowledge
                        </h4>
                      </div>
                    </div>
                    <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-secondary-600 dark:text-secondary-400 font-medium">
                          Functional Design
                        </span>
                        <span className="text-xs text-secondary-500">
                          v{toc.version}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-2xl font-bold text-secondary-700 dark:text-secondary-300">
                            {totalSections}
                          </p>
                          <p className="text-xs text-secondary-500">Sections</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-secondary-700 dark:text-secondary-300">
                            {totalSubsections}
                          </p>
                          <p className="text-xs text-secondary-500">
                            Subsections
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-secondary-700 dark:text-secondary-300">
                            {totalFiles}
                          </p>
                          <p className="text-xs text-secondary-500">Files</p>
                        </div>
                      </div>
                    </div>

                    {/* Preview of top sections */}
                    {toc.sections.slice(0, 3).map((section) => (
                      <div
                        key={section.number}
                        className="flex items-center gap-2 text-sm text-default-600 dark:text-default-400"
                      >
                        <span className="text-xs font-mono text-default-400">
                          {section.number}
                        </span>
                        <span className="truncate">{section.title}</span>
                      </div>
                    ))}
                    {toc.sections.length > 3 && (
                      <p className="text-xs text-default-400">
                        +{toc.sections.length - 3} more sections
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Code Analysis Status */}
            <div className="space-y-4 flex flex-col items-center justify-center">
              {isLoading && !isPaused ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner color="primary" />
                </div>
              ) : !hasStarted && !isPaused ? (
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
                  <p className="text-default-500 mb-4 text-sm">
                    No code analysis in progress. Start the analysis process to
                    generate documentation from your codebase.
                  </p>
                  {(!githubUrl ||
                    !newTechStack ||
                    newTechStack.length === 0) && (
                    <p className="text-xs text-warning-500 mb-3">
                      {!githubUrl && !newTechStack?.length
                        ? "Please set GitHub URL and Tech Stack before starting analysis"
                        : !githubUrl
                          ? "Please set GitHub URL before starting analysis"
                          : "Please set Tech Stack before starting analysis"}
                    </p>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-3">
                  {/* Queued Message - Status is "start" but process hasn't started yet */}
                  {codeAnalysisStatus === "start" &&
                    currentStep === "configuration" && (
                      <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-3">
                        <div className="flex items-center justify-center gap-2">
                          <svg
                            className="h-5 w-5 text-secondary-500 animate-pulse"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-secondary-600 dark:text-secondary-400">
                              Queued for Processing
                            </p>
                            <p className="text-xs text-secondary-500">
                              Analysis will start as soon as a server is
                              available
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Stopped Message */}
                  {isStopped && currentStep && (
                    <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-center gap-2">
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
                      <Button
                        color="warning"
                        variant="flat"
                        fullWidth
                        onPress={handleResumeAnalysis}
                        isLoading={isResuming}
                        startContent={
                          !isResuming && (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                              />
                            </svg>
                          )
                        }
                      >
                        Resume Analysis
                      </Button>
                    </div>
                  )}

                  {/* Paused Message */}
                  {isPaused && currentStep && (
                    <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-3">
                      <div className="flex items-center justify-center gap-2">
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
                  {(isError || codeAnalysisStatus === "error") && (
                    <div className="bg-amber-50 dark:bg-zinc-800/80 border border-amber-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="h-4 w-4 text-amber-600 dark:text-amber-400"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                            Connection interrupted
                          </p>
                          <p className="text-sm text-amber-700 dark:text-zinc-400 mt-0.5">
                            The analysis was temporarily interrupted. Your progress is safe.
                          </p>
                          {(codeAnalysisCurrentStep || codeAnalysisError || codeAnalysisErrorDetails) && (
                            <details className="mt-2">
                              <summary className="text-xs text-amber-600 dark:text-zinc-500 cursor-pointer hover:text-amber-700 dark:hover:text-zinc-300">
                                View technical details
                              </summary>
                              <div className="mt-2 text-xs bg-amber-100 dark:bg-zinc-700/50 p-3 rounded-lg space-y-1">
                                {codeAnalysisCurrentStep && (
                                  <p className="text-amber-700 dark:text-zinc-300">
                                    <span className="font-medium">Step:</span>{" "}
                                    {getStepLabel(codeAnalysisCurrentStep as StepStatus)}
                                  </p>
                                )}
                                {codeAnalysisError && (
                                  <p className="text-amber-700 dark:text-zinc-300">
                                    <span className="font-medium">Error:</span> {codeAnalysisError}
                                  </p>
                                )}
                                {codeAnalysisErrorDetails && (
                                  <pre className="text-amber-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap mt-2">
                                    {codeAnalysisErrorDetails}
                                  </pre>
                                )}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                      <Button
                        color="warning"
                        variant="flat"
                        fullWidth
                        onPress={handleResumeAnalysis}
                        isLoading={isResuming}
                        startContent={
                          !isResuming && (
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                              />
                            </svg>
                          )
                        }
                      >
                        Retry
                      </Button>
                    </div>
                  )}

                  {/* Completed Message */}
                  {isCompleted && (
                    <div className="bg-success-50 dark:bg-success-900/20 rounded-lg p-3">
                      <div className="flex items-center justify-center gap-2">
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
                          Analysis completed successfully
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Start Analysis Button - Show when no analysis has started or action is configuration */}
          {(!codeAnalysisStatus || codeAnalysisStatus === "configuration") &&
            !isLoading &&
            !isProcessing &&
            !isCompleted &&
            codeAnalysisStatus !== "error" && (
              <div className="pt-4">
                <Button
                  color="primary"
                  fullWidth
                  onPress={onStartAnalysis}
                  isDisabled={
                    !githubUrl || !newTechStack || newTechStack.length === 0
                  }
                  startContent={
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                      />
                    </svg>
                  }
                >
                  Start Analysis
                </Button>
              </div>
            )}

          {/* Action Buttons - Full Width at Bottom */}
          {hasStarted &&
            !isLoading &&
            codeAnalysisStatus !== "configuration" && (
              <div className="flex gap-2 pt-2">
                <Button
                  color="primary"
                  variant={isProcessing ? "solid" : "flat"}
                  className="flex-1"
                  onPress={onNavigateToMigration}
                >
                  {isProcessing
                    ? "View Progress Details"
                    : isCompleted
                      ? "View Results"
                      : "View Migration"}
                </Button>
                {toc && totalSections > 0 && (
                  <Button
                    color="secondary"
                    variant="flat"
                    className="flex-1"
                    onPress={onNavigateToFDD}
                  >
                    View Documents Generated
                  </Button>
                )}
                <Button
                  color="default"
                  variant="flat"
                  className="flex-1"
                  onPress={onNavigateToFilesAnalysis}
                >
                  Files Analysis
                </Button>
                {(isProcessing ||
                  (codeAnalysisStatus === "start" &&
                    currentStep === "configuration")) &&
                  !isStopped &&
                  !isCompleted &&
                  codeAnalysisStatus !== "error" && (
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={handleStopAnalysis}
                      isLoading={isStopping}
                      startContent={
                        !isStopping && (
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
                            />
                          </svg>
                        )
                      }
                    >
                      Stop
                    </Button>
                  )}
              </div>
            )}
        </CardBody>
      </Card>
    </GradientBorderWrapper>
  );
}
