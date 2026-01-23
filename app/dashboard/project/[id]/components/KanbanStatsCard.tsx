"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Progress } from "@heroui/progress";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";

import { ExecutionPlanTask, TaskStatus } from "@/domain/entities/ExecutionPlan";
import { executionPlanRepository } from "@/infrastructure/repositories/FirebaseExecutionPlanRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

interface KanbanStatsCardProps {
  projectId: string;
  onNavigateToKanban: () => void;
}

interface ColumnStats {
  id: TaskStatus;
  label: string;
  count: number;
  color: string;
}

export function KanbanStatsCard({
  projectId,
  onNavigateToKanban,
}: KanbanStatsCardProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ExecutionPlanTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = executionPlanRepository.subscribeTasks(
      user.uid,
      projectId,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading execution plan tasks:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.uid, projectId]);

  // Calculate statistics
  const totalTasks = tasks.length;
  const columnStats: ColumnStats[] = KANBAN_COLUMNS.map((column) => {
    const count = tasks.filter((task) => task.status === column.id).length;
    let color = "default";
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

  const completedTasks =
    columnStats.find((c) => c.id === "completed")?.count || 0;
  const progressPercentage =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  const inProgressTasks =
    columnStats.find((c) => c.id === "in_progress")?.count || 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary-100 dark:bg-secondary-900/30">
            <svg
              className="h-5 w-5 text-secondary"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Task Board</h3>
        </div>
        <span className="text-sm text-default-500">
          {totalTasks} task{totalTasks !== 1 ? "s" : ""}
        </span>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner color="primary" />
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
            <p className="text-default-500 mb-4">
              No tasks yet. Tasks will appear as the migration progresses.
            </p>
          </div>
        ) : (
          <>
            {/* Progress Overview */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-default-500">Completion</span>
                <span className="font-medium">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <Progress
                value={progressPercentage}
                color="success"
                size="md"
                className="w-full"
              />
              <p className="text-xs text-default-400">
                {completedTasks} of {totalTasks} tasks completed
              </p>
            </div>

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
                    {inProgressTasks} task{inProgressTasks !== 1 ? "s" : ""} in
                    progress
                  </p>
                </div>
              </div>
            )}

            {/* View Board Button */}
            <Button
              color="primary"
              variant="flat"
              fullWidth
              onPress={onNavigateToKanban}
            >
              View Task Board
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
