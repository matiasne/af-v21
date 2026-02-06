"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import { Chip } from "@heroui/chip";

import {
  Project,
  StepStatus,
  getStepLabel,
  UI_TYPE_CONFIGS,
} from "@/domain/entities/Project";
import { FirebaseMigrationRepository } from "@/infrastructure/repositories/FirebaseMigrationRepository";
import { MigrationActionType } from "@/domain/entities/MigrationAction";
import { useAuth } from "@/infrastructure/context/AuthContext";
import { GradientBorderWrapper } from "./GradientBorderWrapper";

const migrationRepository = new FirebaseMigrationRepository();

interface ProjectCardProps {
  project: Project;
  onEditClick: (project: Project) => void;
  onDeleteClick: (project: Project) => void;
  formatDate: (timestamp: number) => string;
  index?: number;
}

// Helper to normalize status for backward compatibility
const getProjectStep = (project: Project): StepStatus => {
  if (typeof project.status === "string") {
    return project.status as StepStatus;
  }
  if (project.status?.step) {
    return project.status.step;
  }
  // Old format: status.status (before renaming to step)
  const oldStatus = project.status as unknown as { status?: StepStatus };
  if (oldStatus?.status) {
    return oldStatus.status;
  }
  return "queue";
};

export function ProjectCard({
  project,
  onEditClick,
  onDeleteClick,
  formatDate,
  index = 0,
}: ProjectCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [migrationStep, setMigrationStep] = useState<StepStatus | null>(null);
  const [migrationAction, setMigrationAction] =
    useState<MigrationActionType | null>(null);
  const [loadingMigration, setLoadingMigration] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  const isMigrationProject = project.uiType === "migration";
  const projectStep = getProjectStep(project);
  const displayStep =
    isMigrationProject && migrationStep ? migrationStep : projectStep;
  const uiTypeConfig = project.uiType ? UI_TYPE_CONFIGS[project.uiType] : null;

  // Determine if migration is running (exclude completed/error states)
  const isRunning =
    (migrationAction === "running" || migrationAction === "start") &&
    displayStep !== "completed" &&
    displayStep !== "error";
  const isStopped =
    migrationAction === "stop" || migrationAction === "server_stop";

  useEffect(() => {
    if (!isMigrationProject || !user?.uid || !project.id) {
      return;
    }

    const projectId = project.id;
    const userId = user.uid;

    const fetchMigrations = async () => {
      setLoadingMigration(true);
      try {
        const migrations = await migrationRepository.getMigrations(
          userId,
          projectId
        );
        if (migrations.length > 0) {
          // Get the most recent migration
          const latestMigration = migrations[0];
          setMigrationStep(latestMigration.currentStep);
          setMigrationAction(latestMigration.action || null);
        }
      } catch (error) {
        console.error("Error fetching migrations:", error);
      } finally {
        setLoadingMigration(false);
      }
    };

    fetchMigrations();
  }, [isMigrationProject, user?.uid, project.id]);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        mounted
          ? "opacity-100 translate-y-0 scale-100"
          : "opacity-0 translate-y-8 scale-95"
      }`}
    >
      <GradientBorderWrapper isActive={isRunning}>
        <Card
        key={project.id}
        className="h-full w-full cursor-pointer"
        isPressable
        onPress={() => router.push(`/dashboard/project/${project.id}/kanban`)}
      >
        <CardHeader className="flex flex-col items-start gap-2">
          <div className="flex w-full items-start justify-between gap-2">
            <h3 className="text-lg font-semibold flex-1">{project.name}</h3>
            <div className="flex flex-col items-end gap-1">
              {isMigrationProject && (
                <Chip
                  size="sm"
                  color="secondary"
                  variant="flat"
                  startContent={
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                      />
                    </svg>
                  }
                >
                  Migration
                </Chip>
              )}
              {isMigrationProject && isRunning && (
                <Chip
                  size="sm"
                  color="success"
                  variant="dot"
                  classNames={{
                    dot: "animate-pulse",
                  }}
                >
                  Running
                </Chip>
              )}
              {isMigrationProject && isStopped && (
                <Chip size="sm" color="default" variant="dot">
                  Stopped
                </Chip>
              )}
              {isMigrationProject && migrationAction === "error" && (
                <Chip size="sm" color="danger" variant="flat">
                  Error
                </Chip>
              )}
              <Chip
                size="sm"
                color={
                  displayStep === "completed"
                    ? "success"
                    : displayStep === "error"
                      ? "danger"
                      : displayStep === "configuration"
                        ? "warning"
                        : displayStep === "queue"
                          ? "default"
                          : "primary"
                }
                variant="flat"
              >
                {loadingMigration && isMigrationProject
                  ? "Loading..."
                  : getStepLabel(displayStep)}
              </Chip>
            </div>
          </div>
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-default-400">
              Created{" "}
              {project.createdAt ? formatDate(project.createdAt) : "Unknown"}
            </p>
            {uiTypeConfig && !isMigrationProject && (
              <Chip size="sm" variant="dot" color="default">
                {uiTypeConfig.label}
              </Chip>
            )}
          </div>
        </CardHeader>
        <CardBody className="gap-2">
          <p className="text-default-500 text-sm line-clamp-3">
            {project.description || "No description"}
          </p>
          {project.githubUrl && (
            <Link
              href={project.githubUrl}
              isExternal
              size="sm"
              className="mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </Link>
          )}
        </CardBody>
        <CardFooter className="gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="flat" size="sm" onPress={() => onEditClick(project)}>
            Edit
          </Button>
          <Button
            color="danger"
            variant="flat"
            size="sm"
            onPress={() => onDeleteClick(project)}
          >
            Delete
          </Button>
        </CardFooter>
        </Card>
      </GradientBorderWrapper>
    </div>
  );
}
