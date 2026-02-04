"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
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
import { useAuth } from "@/infrastructure/context/AuthContext";

interface MigrationPlannerCardProps {
  projectId: string;
}

export function MigrationPlannerCard({
  projectId,
}: MigrationPlannerCardProps) {
  const { user } = useAuth();
  const [status, setStatus] = useState<MigrationPlannerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = migrationPlannerRepository.subscribeToLatestStatus(
      user.uid,
      projectId,
      (updatedStatus) => {
        setStatus(updatedStatus);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading Migration Planner status:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, projectId]);

  const isRunning = status?.action === "running" || status?.action === "start" || status?.action === "resume";
  const isCompleted = status?.action === "completed";
  const isError = status?.action === "error";
  const isStopped = status?.action === "stop" || status?.action === "server_stop";

  // Parse progress from description if available (e.g., "Processing 9_2_vsam_data_structures.md (41/41)")
  const progressMatch = status?.description?.match(/\((\d+)\/(\d+)\)/);
  const currentFile = progressMatch ? parseInt(progressMatch[1], 10) : 0;
  const totalFiles = progressMatch ? parseInt(progressMatch[2], 10) : 0;
  const progressPercent = totalFiles > 0 ? (currentFile / totalFiles) * 100 : 0;

  // Format timestamp
  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString();
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
            <h3 className="text-lg font-semibold">Migration Planner</h3>
            <p className="text-xs text-default-500">Execution Plan Generator</p>
          </div>
        </div>
        {status && (
          <Chip
            color={getMigrationPlannerActionColor(status.action)}
            variant="flat"
            size="sm"
          >
            {getMigrationPlannerActionLabel(status.action)}
          </Chip>
        )}
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner color="warning" />
          </div>
        ) : !status ? (
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
              Migration planner not started yet.
            </p>
            <p className="text-xs text-default-400">
              Start the planner to generate execution tasks from FDD documents.
            </p>
          </div>
        ) : (
          <>
            {/* Status Overview */}
            <div className="space-y-3">
              <div className={`rounded-xl p-4 ${
                isCompleted
                  ? "bg-success-50 dark:bg-success-900/20"
                  : isError
                    ? "bg-amber-50 dark:bg-zinc-800/80 border border-amber-200 dark:border-zinc-700"
                    : isStopped
                      ? "bg-warning-50 dark:bg-warning-900/20"
                      : "bg-primary-50 dark:bg-primary-900/20"
              }`}>
                {/* Progress indicator for running state */}
                {isRunning && totalFiles > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-default-600">Processing FDD files</span>
                      <span className="text-default-500">{currentFile}/{totalFiles}</span>
                    </div>
                    <Progress
                      value={progressPercent}
                      color="primary"
                      size="sm"
                      className="max-w-full"
                    />
                  </div>
                )}

                {/* Current description */}
                {status.description && (
                  <p className="text-sm text-default-700 dark:text-default-300 mb-3">
                    {status.description}
                  </p>
                )}

                {/* Error message */}
                {isError && status.error && (
                  <div className="bg-amber-100 dark:bg-zinc-700/50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-amber-700 dark:text-zinc-300">
                      {status.error}
                    </p>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-2xl font-bold ${
                      isCompleted
                        ? "text-success-700 dark:text-success-300"
                        : isError
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-primary-700 dark:text-primary-300"
                    }`}>
                      {status.tasksGenerated}
                    </p>
                    <p className="text-xs text-default-500">Tasks Generated</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-600 dark:text-default-400">
                      {status.currentStep || "-"}
                    </p>
                    <p className="text-xs text-default-500">Current Step</p>
                  </div>
                </div>
              </div>

              {/* Last updated */}
              {status.updatedAt && (
                <p className="text-xs text-default-400 text-right">
                  Last updated: {formatTime(status.updatedAt)}
                </p>
              )}

              {/* Log file link */}
              {status.logFile && (
                <div className="flex items-center gap-2 text-xs text-default-500">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <span className="truncate">{status.logFile}</span>
                </div>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
