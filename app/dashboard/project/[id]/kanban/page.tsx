"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";
import {
  ExecutionPlanTask,
  TaskCategory,
  CleanArchitectureArea,
  TaskStatus,
} from "@/domain/entities/ExecutionPlan";
import { executionPlanRepository } from "@/infrastructure/repositories/FirebaseExecutionPlanRepository";
import { KanbanBoard, TaskList } from "../components";
import NewTaskModal from "../components/NewTaskModal";

type ViewMode = "kanban" | "list";

const CATEGORY_OPTIONS: { id: TaskCategory | "all"; label: string }[] = [
  { id: "all", label: "All Categories" },
  { id: "backend", label: "Backend" },
  { id: "frontend", label: "Frontend" },
  { id: "database", label: "Database" },
  { id: "integration", label: "Integration" },
  { id: "api", label: "API" },
];

const ARCHITECTURE_AREA_OPTIONS: {
  id: CleanArchitectureArea | "all";
  label: string;
}[] = [
  { id: "all", label: "All Layers" },
  { id: "domain", label: "Domain" },
  { id: "application", label: "Application" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "presentation", label: "Presentation" },
];

const CLAUDE_MODELS = [
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 (Recommended)" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { id: "claude-opus-4", label: "Claude Opus 4" },
  { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
];

export default function KanbanPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading, updateExecutorModel, subscribeToExecutorModule, startBoilerplate, restartExecutorModule } = useProjects();
  const {
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    setPageTitle,
    projectOwnerId,
  } = useProjectChat();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ExecutionPlanTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isBoilerplateModalOpen, setIsBoilerplateModalOpen] = useState(false);
  const [isStartingBoilerplate, setIsStartingBoilerplate] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [executorModuleData, setExecutorModuleData] = useState<{ boilerplateDone?: boolean; action?: string; error?: string } | null>(null);
  const [isRetryingExecutor, setIsRetryingExecutor] = useState(false);
  const [isForceResuming, setIsForceResuming] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<
    TaskCategory | "all"
  >("all");
  const [selectedArchitectureArea, setSelectedArchitectureArea] = useState<
    CleanArchitectureArea | "all"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const projectId = params.id as string;

  const {
    migration,
    loading: migrationLoading,
  } = useMigration(projectId, projectOwnerId);

  const [selectedModel, setSelectedModel] = useState<string>(
    project?.executorModel || "claude-sonnet-4-5"
  );

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Find the project
  useEffect(() => {
    if (projects.length > 0 && projectId) {
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      } else {
        router.push("/dashboard");
      }
    }
  }, [projects, projectId, router]);

  // Sync project context with layout
  useEffect(() => {
    if (project) {
      setProjectContext({
        name: project.name,
        description: project.description,
        status: project.status?.step || "unknown",
        githubUrl: project.githubUrl,
      });
      setCurrentProjectId(project.id || null);
    }
  }, [project, setProjectContext, setCurrentProjectId]);

  // Set configuration mode to false for kanban page
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Set page title for navbar
  useEffect(() => {
    setPageTitle("Task Board");
    return () => setPageTitle(null);
  }, [setPageTitle]);

  // Sync selected model when project changes
  useEffect(() => {
    if (project?.executorModel) {
      setSelectedModel(project.executorModel);
    }
  }, [project?.executorModel]);

  // Handle model change
  const handleModelChange = async (model: string) => {
    console.log("[KanbanPage] handleModelChange called:", model);
    setSelectedModel(model);
    if (updateExecutorModel && projectId) {
      console.log("[KanbanPage] Calling updateExecutorModel");
      await updateExecutorModel(projectId, model);
      console.log("[KanbanPage] updateExecutorModel completed");
    } else {
      console.log("[KanbanPage] updateExecutorModel is not available or no projectId");
    }
  };

  // Subscribe to execution plan tasks
  useEffect(() => {
    if (!user?.uid || !projectId) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);

    const unsubscribe = executionPlanRepository.subscribeTasks(
      user.uid,
      projectId,
      (updatedTasks) => {
        setTasks(updatedTasks);
        setTasksLoading(false);
      },
      (error) => {
        console.error("Error subscribing to execution plan tasks:", error);
        setTasksLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, projectId]);

  // Subscribe to executor module for boilerplate check
  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = subscribeToExecutorModule(projectId, (data) => {
      setExecutorModuleData(data);
      // Show modal if boilerplateDone is not set or is false (but not during restart, running, or error states)
      if (!data?.boilerplateDone && data?.action !== "running" && data?.action !== "start" && data?.action !== "restart" && data?.action !== "error") {
        setIsBoilerplateModalOpen(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [projectId, subscribeToExecutorModule]);

  // Check if project is restarting
  const isProjectRestarting = executorModuleData?.action === "restart";

  // Check if executor module has an error
  const isExecutorError = executorModuleData?.action === "error";

  // Handle retry executor module
  const handleRetryExecutor = async () => {
    setIsRetryingExecutor(true);
    try {
      await startBoilerplate(projectId);
    } catch (error) {
      console.error("Error retrying executor module:", error);
    } finally {
      setIsRetryingExecutor(false);
    }
  };

  // Handle download tasks as JSON
  const handleDownloadTasks = () => {
    const dataStr = JSON.stringify(tasks, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tasks-${project?.name || projectId}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle starting boilerplate
  const handleStartBoilerplate = async () => {
    setIsStartingBoilerplate(true);
    try {
      await startBoilerplate(projectId);
      setIsBoilerplateModalOpen(false);
    } catch (error) {
      console.error("Error starting boilerplate:", error);
    } finally {
      setIsStartingBoilerplate(false);
    }
  };

  // Handle restart all
  const handleRestartAll = async () => {
    setIsRestarting(true);
    try {
      await restartExecutorModule(projectId);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error("Error restarting executor module:", error);
    } finally {
      setIsRestarting(false);
    }
  };

  // Handle force resume
  const handleForceResume = async () => {
    setIsForceResuming(true);
    try {
      await startBoilerplate(projectId);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error("Error forcing resume:", error);
    } finally {
      setIsForceResuming(false);
    }
  };

  // Handle create new task
  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    category: TaskCategory;
    priority: "high" | "medium" | "low";
    cleanArchitectureArea: CleanArchitectureArea;
    acceptanceCriteria: string[];
  }) => {
    if (!user?.uid || !projectId) return;

    try {
      await executionPlanRepository.createTask(user.uid, projectId, taskData);
    } catch (error) {
      console.error("Error creating task:", error);
      throw error;
    }
  };

  // Fuzzy search function
  const fuzzyMatch = (text: string, query: string): boolean => {
    if (!query) return true;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    // Check for direct substring match first
    if (lowerText.includes(lowerQuery)) return true;

    // Fuzzy matching: check if all characters in query appear in order
    let queryIndex = 0;
    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === lowerQuery.length;
  };

  // Filter tasks by selected category, architecture area, and search query
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesCategory =
        selectedCategory === "all" || task.category === selectedCategory;
      const matchesArea =
        selectedArchitectureArea === "all" ||
        task.cleanArchitectureArea === selectedArchitectureArea;
      const matchesSearch =
        !searchQuery ||
        fuzzyMatch(task.title, searchQuery) ||
        fuzzyMatch(task.description || "", searchQuery);
      return matchesCategory && matchesArea && matchesSearch;
    });
  }, [tasks, selectedCategory, selectedArchitectureArea, searchQuery]);

  if (authLoading || projectsLoading || migrationLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!user || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Executor Module Error Banner */}
      {isExecutorError && (
        <div className="mb-4 p-4 bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-danger mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-danger-700 dark:text-danger-400">
                Migration Executor Error
              </h3>
              {executorModuleData?.error && (
                <p className="text-sm text-danger-600 dark:text-danger-300 mt-1 whitespace-pre-wrap">
                  {executorModuleData.error}
                </p>
              )}
            </div>
            <Button
              color="danger"
              variant="flat"
              size="sm"
              onPress={handleRetryExecutor}
              isLoading={isRetryingExecutor}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* View Toggle and Configuration */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-default-600">View:</span>
          <Button
            size="sm"
            color={viewMode === "kanban" ? "primary" : "default"}
            variant={viewMode === "kanban" ? "solid" : "flat"}
            onPress={() => setViewMode("kanban")}
            startContent={
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
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
            }
          >
            Kanban
          </Button>
          <Button
            size="sm"
            color={viewMode === "list" ? "primary" : "default"}
            variant={viewMode === "list" ? "solid" : "flat"}
            onPress={() => setViewMode("list")}
            startContent={
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
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            }
          >
            List
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Download Tasks Button */}
          <Button
            size="sm"
            color="default"
            variant="flat"
            onPress={handleDownloadTasks}
            isDisabled={tasks.length === 0}
            startContent={
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            }
          >
            Export Tasks
          </Button>

          {/* Configuration Button */}
          <Button
            size="sm"
            color="default"
            variant="flat"
            onPress={() => setIsConfigModalOpen(true)}
            startContent={
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
            }
          >
            Configuration
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="max-w-xs"
          isClearable
          onClear={() => setSearchQuery("")}
          startContent={
            <svg
              className="w-4 h-4 text-default-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
        />
        <Select
          label="Filter by Category"
          selectedKeys={new Set([selectedCategory])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as TaskCategory | "all";
            if (selected) {
              setSelectedCategory(selected);
            }
          }}
          className="max-w-xs"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.id} textValue={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </Select>
        <Select
          label="Filter by Architecture Layer"
          selectedKeys={new Set([selectedArchitectureArea])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as
              | CleanArchitectureArea
              | "all";
            if (selected) {
              setSelectedArchitectureArea(selected);
            }
          }}
          className="max-w-xs"
        >
          {ARCHITECTURE_AREA_OPTIONS.map((option) => (
            <SelectItem key={option.id} textValue={option.label}>
              {option.label}
            </SelectItem>
          ))}
        </Select>
        {/* Clear all filters button */}
        {(searchQuery || selectedCategory !== "all" || selectedArchitectureArea !== "all") && (
          <Button
            size="sm"
            color="default"
            variant="flat"
            onPress={() => {
              setSearchQuery("");
              setSelectedCategory("all");
              setSelectedArchitectureArea("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Task Count */}
      <div className="mb-4 text-sm text-default-500">
        {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} found
        {searchQuery && (
          <span> matching &quot;{searchQuery}&quot;</span>
        )}
        {(selectedCategory !== "all" || selectedArchitectureArea !== "all") && (
          <span>
            {selectedCategory !== "all" && (
              <>
                {" "}
                in{" "}
                {CATEGORY_OPTIONS.find((c) => c.id === selectedCategory)?.label}
              </>
            )}
            {selectedArchitectureArea !== "all" && (
              <>
                {" "}
                (
                {
                  ARCHITECTURE_AREA_OPTIONS.find(
                    (a) => a.id === selectedArchitectureArea,
                  )?.label
                }{" "}
                layer)
              </>
            )}
          </span>
        )}
      </div>

      {/* Tasks View */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner color="primary" />
        </div>
      ) : !migration ? (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No migration selected</p>
          <Button
            color="primary"
            variant="flat"
            onPress={() =>
              router.push(`/dashboard/project/${projectId}/migration`)
            }
          >
            Go to Migration
          </Button>
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tasks={filteredTasks}
          onMoveTask={async (taskId: string, status: TaskStatus) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateTaskStatus(
                  user.uid,
                  projectId,
                  taskId,
                  status
                );
              } catch (error) {
                console.error("Error updating task status:", error);
              }
            }
          }}
          onMoveAllBacklogToTodo={async (taskIds: string[]) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateMultipleTasksStatus(
                  user.uid,
                  projectId,
                  taskIds,
                  "todo"
                );
              } catch (error) {
                console.error("Error moving tasks to todo:", error);
              }
            }
          }}
          onMoveAllTodoToBacklog={async (taskIds: string[]) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateMultipleTasksStatus(
                  user.uid,
                  projectId,
                  taskIds,
                  "backlog"
                );
              } catch (error) {
                console.error("Error moving tasks to backlog:", error);
              }
            }
          }}
          onCreateTask={() => setIsNewTaskModalOpen(true)}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          onUpdateTaskStatus={async (taskId: string, status: TaskStatus) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateTaskStatus(
                  user.uid,
                  projectId,
                  taskId,
                  status
                );
              } catch (error) {
                console.error("Error updating task status:", error);
              }
            }
          }}
        />
      )}

      {/* Configuration Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        size="md"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Task Board Configuration</h2>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Claude Model for Task Execution
                </label>
                <Select
                  label="Select Model"
                  selectedKeys={new Set([selectedModel])}
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) {
                      handleModelChange(selected);
                    }
                  }}
                  className="w-full"
                >
                  {CLAUDE_MODELS.map((model) => (
                    <SelectItem key={model.id} textValue={model.label}>
                      {model.label}
                    </SelectItem>
                  ))}
                </Select>
                <p className="text-xs text-default-500 mt-2">
                  This model will be used for executing tasks in the migration executor module.
                </p>
              </div>

              <div className="border-t border-default-200 pt-4">
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Actions
                </label>
                <div className="flex flex-col gap-3">
                  <div>
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={handleForceResume}
                      isLoading={isForceResuming}
                      className="w-full"
                    >
                      Force Resume
                    </Button>
                    <p className="text-xs text-default-500 mt-1">
                      Force the executor module to resume processing tasks.
                    </p>
                  </div>
                  <div>
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={handleRestartAll}
                      isLoading={isRestarting}
                      className="w-full"
                    >
                      Restart All
                    </Button>
                    <p className="text-xs text-default-500 mt-1">
                      This will reset the boilerplate process and set the executor module to restart.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              onPress={() => setIsConfigModalOpen(false)}
            >
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Boilerplate Modal */}
      <Modal
        isOpen={isBoilerplateModalOpen}
        onClose={() => setIsBoilerplateModalOpen(false)}
        size="lg"
        isDismissable={false}
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Start Boilerplate Setup</h2>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <p className="text-default-700">
                Before executing tasks, we need to set up the boilerplate for your new application using the defined tech stack.
              </p>

              {project?.analysis?.newTechStack && project.analysis.newTechStack.length > 0 && (
                <div className="bg-default-100 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-default-700 mb-3">Target Tech Stack:</h3>
                  <div className="flex flex-wrap gap-2">
                    {project.analysis.newTechStack.map((tech) => (
                      <span key={tech} className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm text-default-500">
                Do you want to start the Boilerplate process now?
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setIsBoilerplateModalOpen(false)}
            >
              Later
            </Button>
            <Button
              color="primary"
              onPress={handleStartBoilerplate}
              isLoading={isStartingBoilerplate}
            >
              Start Boilerplate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Restart In Progress Modal */}
      <Modal
        isOpen={isProjectRestarting}
        size="md"
        isDismissable={false}
        hideCloseButton
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Project Restarting</h2>
          </ModalHeader>
          <ModalBody>
            <div className="flex flex-col items-center gap-4 py-4">
              <Spinner size="lg" color="primary" />
              <p className="text-default-700 text-center">
                The project is being restarted. Please wait while the system resets the boilerplate and executor module.
              </p>
              <p className="text-sm text-default-500 text-center">
                This may take a few moments. You will be able to continue once the restart is complete.
              </p>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* New Task Modal */}
      <NewTaskModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
        onSubmit={handleCreateTask}
      />
    </div>
  );
}
