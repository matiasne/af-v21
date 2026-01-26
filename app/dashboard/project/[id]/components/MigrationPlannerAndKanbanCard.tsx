"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";

import {
  MigrationPlannerStatus,
  getMigrationPlannerActionLabel,
  getMigrationPlannerActionColor,
} from "@/domain/entities/MigrationPlanner";
import { migrationPlannerRepository } from "@/infrastructure/repositories/FirebaseMigrationPlannerRepository";
import { ExecutionPlanTask, TaskStatus } from "@/domain/entities/ExecutionPlan";
import { executionPlanRepository } from "@/infrastructure/repositories/FirebaseExecutionPlanRepository";
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
  keyword: "bg-orange-400/80",
  string: "bg-amber-500/70",
  comment: "bg-yellow-300/50",
  function: "bg-orange-500/70",
  variable: "bg-amber-600/60",
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
      className={`rounded-lg bg-muted/50 backdrop-blur-sm ${sizeClasses[size].container} ${className || ""}`}
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
                      ? "ring-2 ring-warning/50 ring-offset-1 ring-offset-muted/50"
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

const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

interface MigrationPlannerAndKanbanCardProps {
  projectId: string;
  onNavigateToKanban: () => void;
  onNavigateToFDD: () => void;
  codeAnalysisStatus?: string;
}

interface ColumnStats {
  id: TaskStatus;
  label: string;
  count: number;
  color: string;
}

export function MigrationPlannerAndKanbanCard({
  projectId,
  onNavigateToKanban,
  onNavigateToFDD,
  codeAnalysisStatus,
}: MigrationPlannerAndKanbanCardProps) {
  const { user } = useAuth();

  // Migration Planner state
  const [plannerStatus, setPlannerStatus] =
    useState<MigrationPlannerStatus | null>(null);
  const [plannerLoading, setPlannerLoading] = useState(true);
  const [isStartingPlanning, setIsStartingPlanning] = useState(false);

  // Kanban state
  const [tasks, setTasks] = useState<ExecutionPlanTask[]>([]);
  const [kanbanLoading, setKanbanLoading] = useState(true);

  // Load Migration Planner status
  useEffect(() => {
    if (!user?.uid || !projectId) {
      setPlannerLoading(false);
      return;
    }

    setPlannerLoading(true);
    const unsubscribe = migrationPlannerRepository.subscribeToLatestStatus(
      user.uid,
      projectId,
      (updatedStatus) => {
        console.log(
          "Received updated Migration Planner status:",
          updatedStatus,
        );
        setPlannerStatus(updatedStatus);
        setPlannerLoading(false);
      },
      (error) => {
        console.error("Error loading Migration Planner status:", error);
        setPlannerLoading(false);
      },
    );

    console.log("Subscribed to Migration Planner status");

    return () => unsubscribe();
  }, [user?.uid, projectId]);

  // Load Kanban tasks
  useEffect(() => {
    if (!user?.uid || !projectId) {
      setKanbanLoading(false);
      return;
    }

    setKanbanLoading(true);
    const unsubscribe = executionPlanRepository.subscribeTasks(
      user.uid,
      projectId,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setKanbanLoading(false);
      },
      (error) => {
        console.error("Error loading execution plan tasks:", error);
        setKanbanLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, projectId]);

  // Migration Planner calculations
  const isPlannerRunning =
    plannerStatus?.action === "running" ||
    plannerStatus?.action === "resume" ||
    plannerStatus?.action === "start";
  const isPlannerCompleted = plannerStatus?.action === "completed";
  const isPlannerError = plannerStatus?.action === "error";
  const isPlannerStopped =
    plannerStatus?.action === "stop" || plannerStatus?.action === "server_stop";

  // Parse progress from description if available
  const progressMatch = plannerStatus?.description?.match(/\((\d+)\/(\d+)\)/);
  const currentFile = progressMatch ? parseInt(progressMatch[1], 10) : 0;
  const totalFiles = progressMatch ? parseInt(progressMatch[2], 10) : 0;
  const plannerProgressPercent =
    totalFiles > 0 ? (currentFile / totalFiles) * 100 : 0;

  // Format timestamp
  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Kanban calculations
  const totalTasks = tasks.length;
  const columnStats: ColumnStats[] = KANBAN_COLUMNS.map((column) => {
    const count = tasks.filter((task) => task.status === column.id).length;
    let color: "default" | "warning" | "primary" | "success" = "default";
    switch (column.id) {
      case "backlog":
        color = "default";
        break;
      case "todo":
        color = "warning";
        break;
      case "in_progress":
        color = "primary";
        break;
      case "completed":
        color = "success";
        break;
    }
    return {
      id: column.id,
      label: column.label,
      count,
      color,
    };
  });

  const completedTasksRaw =
    columnStats.find((c) => c.id === "completed")?.count || 0;
  const completedTasks = Math.min(completedTasksRaw, totalTasks);
  const kanbanProgressPercentage =
    totalTasks > 0 ? Math.min((completedTasks / totalTasks) * 100, 100) : 0;
  const inProgressTasks =
    columnStats.find((c) => c.id === "in_progress")?.count || 0;

  const isLoading = plannerLoading || kanbanLoading;

  // Handler to start planning
  const handleStartPlanning = async () => {
    if (!user?.uid || !projectId) return;

    setIsStartingPlanning(true);
    try {
      await migrationPlannerRepository.startPlanning(user.uid, projectId);
    } catch (error) {
      console.error("Error starting planning:", error);
    } finally {
      setIsStartingPlanning(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning-100 dark:bg-warning-900/30">
            <svg
              className="h-5 w-5 text-warning"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              Migration Planner & Task Board
            </h3>
            <p className="text-xs text-default-500">
              Execution plan and task management
            </p>
          </div>
        </div>
        {plannerStatus && (
          <Chip
            color={getMigrationPlannerActionColor(plannerStatus.action)}
            variant="flat"
            size="sm"
          >
            {getMigrationPlannerActionLabel(plannerStatus.action)}
          </Chip>
        )}
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        {/* Overall Task Progress - Full Width at Top */}
        {totalTasks > 0 && !kanbanLoading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-default-500">Overall Task Completion</span>
              <span className="font-medium">
                {Math.round(kanbanProgressPercentage)}%
              </span>
            </div>
            <Progress
              value={kanbanProgressPercentage}
              color="success"
              size="md"
              className="w-full"
            />
            <p className="text-xs text-default-400">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </div>
        )}

        <div
          className={`grid gap-6 grid-cols-1 ${!plannerStatus || plannerStatus.action === "pending" ? "" : "md:grid-cols-2"}`}
        >
          {/* Left Side - Migration Planner */}
          <div className="space-y-4">
            {plannerLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner color="warning" />
              </div>
            ) : !plannerStatus || plannerStatus.action === "pending" ? (
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
                      d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                    />
                  </svg>
                </div>
                <p className="text-default-500 mb-2 text-sm">
                  Migration planner not started yet.
                </p>
                <p className="text-xs text-default-400">
                  Start the planner to generate execution tasks from FDD
                  documents.
                </p>
              </div>
            ) : isPlannerRunning ? (
              <div className="flex flex-col items-center justify-center py-4">
                <CodeLoader size="md" className="mb-4" />
                {totalFiles > 0 && (
                  <div className="w-full max-w-xs">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-default-600">
                        Processing FDD files
                      </span>
                      <span className="text-default-500">
                        {currentFile}/{totalFiles}
                      </span>
                    </div>
                    <Progress
                      value={plannerProgressPercent}
                      color="warning"
                      size="sm"
                      className="max-w-full"
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Status Overview */}
                <div className="space-y-3">
                  <div
                    className={`rounded-lg p-4 ${
                      isPlannerCompleted
                        ? "bg-success-50 dark:bg-success-900/20"
                        : isPlannerError
                          ? "bg-danger-50 dark:bg-danger-900/20"
                          : isPlannerStopped
                            ? "bg-warning-50 dark:bg-warning-900/20"
                            : "bg-primary-50 dark:bg-primary-900/20"
                    }`}
                  >
                    {/* Current description */}
                    {plannerStatus.description && (
                      <p className="text-sm text-default-700 dark:text-default-300 mb-3">
                        {plannerStatus.description}
                      </p>
                    )}

                    {/* Error message */}
                    {isPlannerError && plannerStatus.error && (
                      <div className="bg-danger-100 dark:bg-danger-900/30 rounded p-2 mb-3">
                        <p className="text-sm text-danger-700 dark:text-danger-300">
                          {plannerStatus.error}
                        </p>
                      </div>
                    )}

                    {/* Retry button for error state */}
                    {isPlannerError && (
                      <Button
                        color="danger"
                        variant="flat"
                        fullWidth
                        onPress={handleStartPlanning}
                        isLoading={isStartingPlanning}
                        className="mb-3"
                        startContent={
                          !isStartingPlanning && (
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
                    )}

                    {/* Stats grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p
                          className={`text-2xl font-bold ${
                            isPlannerCompleted
                              ? "text-success-700 dark:text-success-300"
                              : isPlannerError
                                ? "text-danger-700 dark:text-danger-300"
                                : "text-primary-700 dark:text-primary-300"
                          }`}
                        >
                          {plannerStatus.tasksGenerated}
                        </p>
                        <p className="text-xs text-default-500">
                          Tasks Generated
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-default-600 dark:text-default-400">
                          {plannerStatus.currentStep || "-"}
                        </p>
                        <p className="text-xs text-default-500">Current Step</p>
                      </div>
                    </div>
                  </div>

                  {/* Last updated */}
                  {plannerStatus.updatedAt && (
                    <p className="text-xs text-default-400 text-right">
                      Last updated: {formatTime(plannerStatus.updatedAt)}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right Side - Task Board (Kanban) - Hidden when pending */}
          {plannerStatus && plannerStatus.action !== "pending" && (
            <div className="space-y-4">
              {kanbanLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner color="secondary" />
                </div>
              ) : totalTasks === 0 ? (
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
                        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                      />
                    </svg>
                  </div>
                  <p className="text-default-500 mb-4 text-sm">
                    No tasks yet. Tasks will appear as the migration progresses.
                  </p>
                </div>
              ) : (
                <>
                  {/* Column Breakdown */}
                  <div className="grid grid-cols-2 gap-3">
                    {columnStats.map((column) => (
                      <div
                        key={column.id}
                        className={`p-3 rounded-lg ${
                          column.id === "completed"
                            ? "bg-success-50 dark:bg-success-900/20"
                            : column.id === "in_progress"
                              ? "bg-primary-50 dark:bg-primary-900/20"
                              : column.id === "todo"
                                ? "bg-warning-50 dark:bg-warning-900/20"
                                : "bg-default-100"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm ${
                              column.id === "completed"
                                ? "text-success-600 dark:text-success-400"
                                : column.id === "in_progress"
                                  ? "text-primary-600 dark:text-primary-400"
                                  : column.id === "todo"
                                    ? "text-warning-600 dark:text-warning-400"
                                    : "text-default-600"
                            }`}
                          >
                            {column.label}
                          </span>
                          <span
                            className={`text-lg font-bold ${
                              column.id === "completed"
                                ? "text-success-600 dark:text-success-400"
                                : column.id === "in_progress"
                                  ? "text-primary-600 dark:text-primary-400"
                                  : column.id === "todo"
                                    ? "text-warning-600 dark:text-warning-400"
                                    : "text-default-700"
                            }`}
                          >
                            {column.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Active Tasks Indicator */}
                  {inProgressTasks > 0 && (
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <p className="text-sm text-primary-600 dark:text-primary-400">
                          {inProgressTasks} task
                          {inProgressTasks !== 1 ? "s" : ""} in progress
                        </p>
                      </div>
                    </div>
                  )}

                  {/* View Board Button */}
                  <div className="flex gap-2">
                    <Button
                      color="secondary"
                      variant="flat"
                      className="flex-1"
                      onPress={onNavigateToKanban}
                    >
                      View Task Board
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer with Start Planning button */}
        {plannerStatus && plannerStatus.action === "pending" && (
          <div className="pt-4">
            <Button
              color="warning"
              fullWidth
              onPress={handleStartPlanning}
              isLoading={isStartingPlanning}
            >
              Start Planning
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
