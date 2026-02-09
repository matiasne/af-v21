"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
  Epic,
} from "@/domain/entities/ExecutionPlan";
// Note: TaskCategory and CleanArchitectureArea are still needed for handleCreateTask
import { executionPlanRepository } from "@/infrastructure/repositories/FirebaseExecutionPlanRepository";
import { processorRepository } from "@/infrastructure/repositories/FirebaseProcessorRepository";
import { ProcessorInfo } from "@/domain/entities/ProcessorInfo";
import { RAGCorpus, RAGFile } from "@/domain/entities/RAGFile";

// RAG API helper functions
async function ragGetOrCreateCorpus(corpusDisplayName: string): Promise<RAGCorpus | null> {
  try {
    const response = await fetch("/api/rag/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getOrCreateCorpus", corpusDisplayName }),
    });
    if (!response.ok) {
      console.error("[RAG API] getOrCreateCorpus failed:", await response.text());
      return null;
    }
    const data = await response.json();
    return data.corpus;
  } catch (error) {
    console.error("[RAG API] Error in getOrCreateCorpus:", error);
    return null;
  }
}

interface TaskMetadataForRAG {
  title: string;
  description: string;
  category: string;
  priority: string;
  cleanArchitectureArea: string;
  epicId?: string;
}

async function ragUploadDocument(
  corpusName: string,
  displayName: string,
  content: string,
  projectId?: string,
  taskMetadata?: TaskMetadataForRAG
): Promise<RAGFile | null> {
  try {
    const response = await fetch("/api/rag/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadDocument",
        corpusName,
        displayName,
        content,
        projectId,
        taskMetadata,
      }),
    });
    if (!response.ok) {
      console.error("[RAG API] uploadDocument failed:", await response.text());
      return null;
    }
    const data = await response.json();
    return data.document;
  } catch (error) {
    console.error("[RAG API] Error in uploadDocument:", error);
    return null;
  }
}

async function ragDeleteDocument(corpusName: string, displayName: string): Promise<boolean> {
  try {
    const response = await fetch(
      `/api/rag/files?corpusName=${encodeURIComponent(corpusName)}&displayName=${encodeURIComponent(displayName)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      console.error("[RAG API] deleteDocument failed:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[RAG API] Error in deleteDocument:", error);
    return false;
  }
}

async function ragUpdateTask(
  corpusName: string,
  taskId: string,
  projectId: string,
  updates: {
    title?: string;
    description?: string;
    dependencies?: string[];
    category?: string;
    priority?: string;
    cleanArchitectureArea?: string;
  }
): Promise<boolean> {
  try {
    const response = await fetch("/api/rag/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateTask",
        corpusName,
        taskId,
        projectId,
        updates,
      }),
    });
    if (!response.ok) {
      console.error("[RAG API] updateTask failed:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[RAG API] Error in updateTask:", error);
    return false;
  }
}
import {
  KanbanBoard,
  TaskList,
  TechStackEditModal,
  NewEpicModal,
} from "../components";
import NewTaskModal from "../components/NewTaskModal";

type ViewMode = "kanban" | "list";

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
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    updateExecutorModel,
    subscribeToExecutorModule,
    startBoilerplate,
    restartExecutorModule,
    updateProject,
    inviteUserToProject,
    removeUserFromProject,
  } = useProjects();
  const {
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    projectOwnerId,
    configChatHistory,
    setConfigChatHistory,
    isConfigChatLoading,
    setIsConfigChatLoading,
    currentTechStack,
    setCurrentTechStack: setNewTechStack,
    suggestions,
    setSuggestions,
    handleConfigChatHistoryChange,
  } = useProjectChat();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ExecutionPlanTask[]>([]);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isBoilerplateModalOpen, setIsBoilerplateModalOpen] = useState(false);
  const [isStartingBoilerplate, setIsStartingBoilerplate] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [executorModuleData, setExecutorModuleData] = useState<{
    boilerplateDone?: boolean;
    action?: string;
    error?: string;
  } | null>(null);
  const [isRetryingExecutor, setIsRetryingExecutor] = useState(false);
  const [isForceResuming, setIsForceResuming] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isNewEpicModalOpen, setIsNewEpicModalOpen] = useState(false);
  const [isTechStackModalOpen, setIsTechStackModalOpen] = useState(false);

  // Filter states
  const [selectedEpic, setSelectedEpic] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Invitation states
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const projectId = params.id as string;

  const { migration, loading: migrationLoading } = useMigration(projectId);

  const [selectedModel, setSelectedModel] = useState<string>(
    project?.executorModel || "claude-sonnet-4-5",
  );

  // Processor state
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);
  const [selectedProcessorHost, setSelectedProcessorHost] = useState<string>(
    project?.processorHost || "",
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

  // Sync selected model when project changes
  useEffect(() => {
    if (project?.executorModel) {
      setSelectedModel(project.executorModel);
    }
  }, [project?.executorModel]);

  // Sync selected processor host when project changes
  useEffect(() => {
    if (project?.processorHost) {
      setSelectedProcessorHost(project.processorHost);
    }
  }, [project?.processorHost]);

  // Subscribe to processors
  useEffect(() => {
    const unsubscribe = processorRepository.subscribeProcessors(
      (updatedProcessors) => {
        setProcessors(updatedProcessors);
      },
      (error) => {
        console.error("Error fetching processors:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  // Handle model change
  const handleModelChange = async (model: string) => {
    console.log("[KanbanPage] handleModelChange called:", model);
    setSelectedModel(model);
    if (updateExecutorModel && projectId) {
      console.log("[KanbanPage] Calling updateExecutorModel");
      await updateExecutorModel(projectId, model);
      console.log("[KanbanPage] updateExecutorModel completed");
    } else {
      console.log(
        "[KanbanPage] updateExecutorModel is not available or no projectId",
      );
    }
  };

  // Handle processor host change
  const handleProcessorHostChange = async (host: string) => {
    if (!host || !projectId) return;
    setSelectedProcessorHost(host);
    try {
      await updateProject(projectId, { processorHost: host });
    } catch (error) {
      console.error("Error updating processor host:", error);
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

  // Subscribe to epics
  useEffect(() => {
    if (!user?.uid || !projectId) {
      setEpics([]);
      return;
    }

    const unsubscribe = executionPlanRepository.subscribeEpics(
      user.uid,
      projectId,
      (updatedEpics) => {
        setEpics(updatedEpics);
      },
      (error) => {
        console.error("Error subscribing to epics:", error);
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
    });

    return () => {
      unsubscribe();
    };
  }, [projectId, subscribeToExecutorModule]);

  // Check if project is restarting
  const isProjectRestarting = executorModuleData?.action === "restart";

  // Check if project has no tech stack configured
  const hasNoTechStack =
    !project?.analysis?.newTechStack ||
    project.analysis.newTechStack.length === 0;

  // Check if boilerplate needs to be started (not done and not running)
  const needsBoilerplate =
    !executorModuleData?.boilerplateDone &&
    executorModuleData?.action !== "running" &&
    executorModuleData?.action !== "start" &&
    executorModuleData?.action !== "restart";

  // Check if boilerplate is currently being created
  const isBoilerplateRunning =
    !executorModuleData?.boilerplateDone &&
    (executorModuleData?.action === "running" ||
      executorModuleData?.action === "start");

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

  // Handle invite user
  const handleInviteUser = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    const result = await inviteUserToProject(projectId, inviteEmail.trim());

    if (result.success) {
      setInviteSuccess(true);
      setInviteEmail("");
      // Reset success message after 3 seconds
      setTimeout(() => setInviteSuccess(false), 3000);
    } else {
      setInviteError(result.error || "Failed to invite user");
    }

    setIsInviting(false);
  };

  // Handle remove user
  const handleRemoveUser = async (userIdToRemove: string) => {
    setRemovingUserId(userIdToRemove);

    const result = await removeUserFromProject(projectId, userIdToRemove);

    if (!result.success) {
      setInviteError(result.error || "Failed to remove user");
    }

    setRemovingUserId(null);
  };

  // Tech stack edit handlers
  const handleSendMessage = useCallback(
    async (message: string) => {
      const userMessage = { role: "user" as const, content: message };
      const newHistory = [...configChatHistory, userMessage];

      setConfigChatHistory(newHistory);
      handleConfigChatHistoryChange(newHistory);
      setIsConfigChatLoading(true);

      try {
        const response = await fetch("/api/chat/define-tech-stack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: newHistory,
            userId: user?.uid,
            projectId,
            projectContext: project
              ? {
                  name: project.name,
                  description: project.description,
                  status: project.status?.step || "configuration",
                  githubUrl: project.githubUrl,
                }
              : null,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get response");
        }

        const data = await response.json();
        const assistantMessage = data.message;

        const updatedHistory = [...newHistory, assistantMessage];
        setConfigChatHistory(updatedHistory);
        handleConfigChatHistoryChange(updatedHistory);

        if (data.techStack) {
          setNewTechStack(data.techStack);
          if (projectId) {
            updateProject(projectId, {
              analysis: {
                ...project?.analysis,
                summary: project?.analysis?.summary || "",
                newTechStack: data.techStack,
              },
            });
          }
        }

        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (error) {
        console.error("Chat error:", error);
        const errorMessage = {
          role: "assistant" as const,
          content: "Sorry, I encountered an error. Please try again.",
        };
        const errorHistory = [...newHistory, errorMessage];
        setConfigChatHistory(errorHistory);
        handleConfigChatHistoryChange(errorHistory);
      } finally {
        setIsConfigChatLoading(false);
      }
    },
    [
      configChatHistory,
      setConfigChatHistory,
      handleConfigChatHistoryChange,
      setIsConfigChatLoading,
      user?.uid,
      projectId,
      project,
      setNewTechStack,
      updateProject,
      setSuggestions,
    ],
  );

  const handleRemoveTech = useCallback(
    (tech: string) => {
      const updatedStack = currentTechStack.filter((t) => t !== tech);
      setNewTechStack(updatedStack);
      if (projectId) {
        updateProject(projectId, {
          analysis: {
            ...project?.analysis,
            summary: project?.analysis?.summary || "",
            newTechStack: updatedStack,
          },
        });
      }
    },
    [
      currentTechStack,
      projectId,
      updateProject,
      project?.analysis,
      setNewTechStack,
    ],
  );

  const handleClearAllTech = useCallback(() => {
    setNewTechStack([]);
    setSuggestions([]);
    if (projectId) {
      updateProject(projectId, {
        analysis: {
          ...project?.analysis,
          summary: project?.analysis?.summary || "",
          newTechStack: [],
        },
      });
    }
  }, [
    projectId,
    updateProject,
    project?.analysis,
    setNewTechStack,
    setSuggestions,
  ]);

  const handleSaveTechStack = useCallback(() => {
    if (projectId && currentTechStack.length > 0) {
      updateProject(projectId, {
        analysis: {
          ...project?.analysis,
          summary: project?.analysis?.summary || "",
          newTechStack: currentTechStack,
        },
      });
    }
    setIsTechStackModalOpen(false);
  }, [projectId, updateProject, project?.analysis, currentTechStack]);

  // Handle create new task
  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    category: TaskCategory;
    priority: "high" | "medium" | "low";
    cleanArchitectureArea: CleanArchitectureArea;
    acceptanceCriteria: string[];
  }): Promise<string> => {
    if (!user?.uid || !projectId)
      throw new Error("User or project not available");

    try {
      const taskId = await executionPlanRepository.createTask(
        user.uid,
        projectId,
        taskData,
      );

      // Store task in RAG for semantic search
      const ragStoreName = project?.taskRAGStore || `${projectId}-tasks-rag`;
      try {
        // Get or create the corpus
        const corpus = await ragGetOrCreateCorpus(ragStoreName);
        if (corpus) {
          // Format task content for RAG
          const taskContent = [
            `Task: ${taskData.title}`,
            `Description: ${taskData.description}`,
            `Category: ${taskData.category}`,
            `Priority: ${taskData.priority}`,
            `Architecture Layer: ${taskData.cleanArchitectureArea}`,
            taskData.acceptanceCriteria.length > 0
              ? `Acceptance Criteria:\n${taskData.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          // Pass projectId and taskMetadata to store in Neo4j as well
          await ragUploadDocument(
            corpus.name,
            `task-${taskId}`,
            taskContent,
            projectId,
            {
              title: taskData.title,
              description: taskData.description,
              category: taskData.category,
              priority: taskData.priority,
              cleanArchitectureArea: taskData.cleanArchitectureArea,
            }
          );
        }
      } catch (ragError) {
        console.error("Error storing task in RAG:", ragError);
        // Don't throw - task was created successfully in Firestore
      }

      return taskId;
    } catch (error) {
      console.error("Error creating task:", error);
      throw error;
    }
  };

  // Handle create new epic
  const handleCreateEpic = async (epicData: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    taskIds: string[];
  }) => {
    if (!user?.uid || !projectId) return;

    try {
      const epicId = await executionPlanRepository.createEpic(
        user.uid,
        projectId,
        {
          title: epicData.title,
          description: epicData.description,
          priority: epicData.priority,
        },
      );

      // Assign selected tasks to the new epic
      if (epicData.taskIds.length > 0) {
        await executionPlanRepository.assignTasksToEpic(
          user.uid,
          projectId,
          epicId,
          epicData.taskIds,
        );
      }
    } catch (error) {
      console.error("Error creating epic:", error);
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
    for (
      let i = 0;
      i < lowerText.length && queryIndex < lowerQuery.length;
      i++
    ) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === lowerQuery.length;
  };

  // Filter tasks by selected epic and search query
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesEpic =
        selectedEpic === "all" ||
        (selectedEpic === "unassigned"
          ? !task.epicId || task.epicId === ""
          : task.epicId === selectedEpic);
      const matchesSearch =
        !searchQuery ||
        fuzzyMatch(task.title, searchQuery) ||
        fuzzyMatch(task.description || "", searchQuery);
      return matchesEpic && matchesSearch;
    });
  }, [tasks, selectedEpic, searchQuery]);

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
    <div className="container mx-auto max-w-7xl px-4 py-4">
      {/* Page Title */}
      <div className="flex flex-row gap-2 mb-2 justify-between">
        <div className="flex flex-row gap-2">
          <p className="text-sm text-default-500">Task Board</p>
        </div>

        <div className="flex gap-2">
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

      {/* No Tech Stack Banner */}
      {hasNoTechStack && !isExecutorError && (
        <div className="mb-4 p-4 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-900 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-warning mt-0.5 flex-shrink-0"
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
              <h3 className="text-sm font-semibold text-warning-700 dark:text-warning-400">
                Tech Stack Not Configured
              </h3>
              <p className="text-sm text-warning-600 dark:text-warning-300 mt-1">
                Please configure the target tech stack before starting the
                process.
              </p>
            </div>
            <Button
              color="warning"
              variant="flat"
              size="sm"
              onPress={() => setIsTechStackModalOpen(true)}
            >
              Configure Tech Stack
            </Button>
          </div>
        </div>
      )}

      {/* Boilerplate Running Banner */}
      {isBoilerplateRunning && !isExecutorError && (
        <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-950/20 border border-primary-200 dark:border-primary-900 rounded-lg">
          <div className="flex items-center gap-3">
            <Spinner size="sm" color="primary" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                Creating Boilerplate
              </h3>
              <p className="text-sm text-primary-600 dark:text-primary-300 mt-1">
                Please wait while the boilerplate is being created. Task
                movement is temporarily disabled.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Needs Boilerplate Banner */}
      {needsBoilerplate && !hasNoTechStack && !isExecutorError && (
        <div className="mb-4 p-4 bg-secondary-50 dark:bg-secondary-950/20 border border-secondary-200 dark:border-secondary-900 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-secondary-700 dark:text-secondary-400">
                Boilerplate Setup Required
              </h3>
              <p className="text-sm text-secondary-600 dark:text-secondary-300 mt-1">
                Start the boilerplate setup to begin task execution.
              </p>
            </div>
            <Button
              color="secondary"
              variant="flat"
              size="sm"
              onPress={handleStartBoilerplate}
              isLoading={isStartingBoilerplate}
            >
              Start Boilerplate
            </Button>
          </div>
        </div>
      )}

      {/* View Toggle and Configuration */}
      <div className="mb-4 flex items-center justify-between">
        {/* Left side: New Task, Configuration */}
        <div className="flex items-center gap-2">
          {/* New Epic Button */}
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            onPress={() => setIsNewEpicModalOpen(true)}
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            }
          >
            New Epic
          </Button>

          {/* Grooming Session Button */}
          <Button
            size="sm"
            color="secondary"
            variant="flat"
            onPress={() =>
              router.push(`/dashboard/project/${projectId}/grooming`)
            }
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            }
          >
            Start Grooming
          </Button>

          {/* New Task Button */}
          <Button
            size="sm"
            color="primary"
            variant="solid"
            onPress={() => setIsNewTaskModalOpen(true)}
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            }
          >
            New Task
          </Button>
        </div>

        {/* Right side: View Tabs and Export */}
        <div className="flex items-center gap-3">
          {/* View Tabs */}
          <div className="flex rounded-lg bg-default-100 p-1">
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "kanban"
                  ? "bg-white dark:bg-default-200 text-foreground shadow-sm"
                  : "text-default-500 hover:text-foreground"
              }`}
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
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-white dark:bg-default-200 text-foreground shadow-sm"
                  : "text-default-500 hover:text-foreground"
              }`}
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
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
              List
            </button>
          </div>

          {/* Export Tasks Button */}
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
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="w-40"
          size="sm"
          isClearable
          onClear={() => setSearchQuery("")}
          startContent={
            <svg
              className="w-3 h-3 text-default-400"
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
          placeholder="Epic"
          selectedKeys={new Set([selectedEpic])}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string;
            if (selected) {
              setSelectedEpic(selected);
            }
          }}
          className="w-40"
          size="sm"
        >
          {[
            { id: "all", title: "All Epics" },
            { id: "unassigned", title: "Unassigned" },
            ...epics,
          ].map((option) => (
            <SelectItem key={option.id} textValue={option.title}>
              {option.title}
            </SelectItem>
          ))}
        </Select>
        {/* Clear all filters button */}
        {(searchQuery || selectedEpic !== "all") && (
          <Button
            size="sm"
            color="default"
            variant="flat"
            onPress={() => {
              setSearchQuery("");
              setSelectedEpic("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Task Count */}
      <div className="mb-4 text-sm text-default-500">
        {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""} found
        {searchQuery && <span> matching &quot;{searchQuery}&quot;</span>}
        {selectedEpic !== "all" && (
          <span>
            {" "}
            in epic &quot;
            {selectedEpic === "unassigned"
              ? "Unassigned"
              : epics.find((e) => e.id === selectedEpic)?.title}
            &quot;
          </span>
        )}
      </div>

      {/* Tasks View */}
      {tasksLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner color="primary" />
        </div>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          tasks={filteredTasks}
          epics={epics}
          onMoveTask={async (taskId: string, status: TaskStatus) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateTaskStatus(
                  user.uid,
                  projectId,
                  taskId,
                  status,
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
                  "todo",
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
                  "backlog",
                );
              } catch (error) {
                console.error("Error moving tasks to backlog:", error);
              }
            }
          }}
          onUpdateTaskEpic={async (taskId: string, epicId: string) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.assignTasksToEpic(
                  user.uid,
                  projectId,
                  epicId,
                  [taskId],
                );
              } catch (error) {
                console.error("Error updating task epic:", error);
              }
            }
          }}
          onDeleteTask={async (taskId: string) => {
            if (user?.uid && projectId) {
              try {
                // Delete from Firestore
                await executionPlanRepository.deleteTask(
                  user.uid,
                  projectId,
                  taskId,
                );

                // Also delete from RAG if storage name is available
                if (migration?.ragFunctionalAndBusinessStoreName) {
                  try {
                    await ragDeleteDocument(
                      migration.ragFunctionalAndBusinessStoreName,
                      `task-${taskId}`,
                    );
                  } catch (ragError) {
                    console.error("Error deleting task from RAG:", ragError);
                    // Don't throw - task is already deleted from Firestore
                  }
                }
              } catch (error) {
                console.error("Error deleting task:", error);
              }
            }
          }}
          onMoveToBacklog={async (taskId: string) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateTaskStatus(
                  user.uid,
                  projectId,
                  taskId,
                  "backlog",
                );
              } catch (error) {
                console.error("Error moving task to backlog:", error);
              }
            }
          }}
          onUpdateTask={async (taskId: string, updates: { title?: string; description?: string; dependencies?: string[] }) => {
            if (user?.uid && projectId) {
              try {
                // Update in Firestore
                await executionPlanRepository.updateTask(
                  user.uid,
                  projectId,
                  taskId,
                  updates,
                );

                // Also update in RAG (Pinecone + Neo4j) if storage name is available
                const ragStoreName = project?.taskRAGStore || migration?.ragFunctionalAndBusinessStoreName;
                if (ragStoreName) {
                  // Find the current task to get existing metadata
                  const currentTask = tasks.find(t => t.id === taskId);
                  await ragUpdateTask(
                    ragStoreName,
                    `task-${taskId}`,
                    projectId,
                    {
                      title: updates.title,
                      description: updates.description,
                      dependencies: updates.dependencies,
                      category: currentTask?.category,
                      priority: currentTask?.priority,
                      cleanArchitectureArea: currentTask?.cleanArchitectureArea,
                    }
                  );
                }
              } catch (error) {
                console.error("Error updating task:", error);
              }
            }
          }}
        />
      ) : (
        <TaskList
          tasks={filteredTasks}
          epics={epics}
          onUpdateTaskEpic={async (taskId: string, epicId: string) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.assignTasksToEpic(
                  user.uid,
                  projectId,
                  epicId,
                  [taskId],
                );
              } catch (error) {
                console.error("Error updating task epic:", error);
              }
            }
          }}
          onReorderTasks={async (taskOrders) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateTasksOrder(
                  user.uid,
                  projectId,
                  taskOrders,
                );
              } catch (error) {
                console.error("Error reordering tasks:", error);
              }
            }
          }}
          onDeleteTask={async (taskId: string) => {
            if (user?.uid && projectId) {
              try {
                // Delete from Firestore
                await executionPlanRepository.deleteTask(
                  user.uid,
                  projectId,
                  taskId,
                );

                // Also delete from RAG if storage name is available
                if (migration?.ragFunctionalAndBusinessStoreName) {
                  try {
                    await ragDeleteDocument(
                      migration.ragFunctionalAndBusinessStoreName,
                      `task-${taskId}`,
                    );
                  } catch (ragError) {
                    console.error("Error deleting task from RAG:", ragError);
                    // Don't throw - task is already deleted from Firestore
                  }
                }
              } catch (error) {
                console.error("Error deleting task:", error);
              }
            }
          }}
          onMoveToBacklog={async (taskId: string) => {
            if (user?.uid && projectId) {
              try {
                await executionPlanRepository.updateTaskStatus(
                  user.uid,
                  projectId,
                  taskId,
                  "backlog",
                );
              } catch (error) {
                console.error("Error moving task to backlog:", error);
              }
            }
          }}
          onDeleteEpic={async (epicId: string, deleteTasksToo: boolean) => {
            if (user?.uid && projectId) {
              try {
                // If deleting tasks too and RAG storage is available, delete tasks from RAG first
                if (
                  deleteTasksToo &&
                  migration?.ragFunctionalAndBusinessStoreName
                ) {
                  const epicTasks = tasks.filter(
                    (task) => task.epicId === epicId,
                  );
                  for (const task of epicTasks) {
                    try {
                      await ragDeleteDocument(
                        migration.ragFunctionalAndBusinessStoreName,
                        `task-${task.id}`,
                      );
                    } catch (ragError) {
                      console.error(
                        `Error deleting task ${task.id} from RAG:`,
                        ragError,
                      );
                    }
                  }
                }

                await executionPlanRepository.deleteEpic(
                  user.uid,
                  projectId,
                  epicId,
                  deleteTasksToo,
                );
              } catch (error) {
                console.error("Error deleting epic:", error);
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
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Task Board Configuration</h2>
          </ModalHeader>
          <ModalBody className="max-h-[60vh] md:max-h-[70vh]">
            <div className="flex flex-col gap-4">
              {/* Processor Host Selection */}
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Processor Host
                </label>
                <Select
                  label="Select Processor"
                  placeholder="Select a processor"
                  selectedKeys={
                    selectedProcessorHost
                      ? new Set([selectedProcessorHost])
                      : new Set()
                  }
                  onSelectionChange={(keys) => {
                    const selected = Array.from(keys)[0] as string;
                    if (selected) {
                      handleProcessorHostChange(selected);
                    }
                  }}
                  className="w-full"
                  description={
                    processors.filter((p) => p.status === "running").length ===
                    0
                      ? "No processors available. Make sure a processor is running."
                      : "Select the processor server that will handle task execution"
                  }
                >
                  {processors
                    .filter((p) => p.status === "running")
                    .map((processor) => (
                      <SelectItem
                        key={processor.hostname}
                        textValue={processor.hostname}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {processor.hostname}
                          </span>
                          <span className="text-xs text-default-400">
                            {processor.ipAddress} - PID: {processor.pid}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </Select>
              </div>

              {/* Claude Model Selection */}
              <div className="border-t border-default-200 pt-4">
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
                  This model will be used for executing tasks in the migration
                  executor module.
                </p>
              </div>

              {/* Theme Selection */}
              <div className="border-t border-default-200 pt-4">
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Appearance
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={theme === "light" ? "solid" : "flat"}
                    color={theme === "light" ? "primary" : "default"}
                    onPress={() => setTheme("light")}
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
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    }
                  >
                    Light
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === "dark" ? "solid" : "flat"}
                    color={theme === "dark" ? "primary" : "default"}
                    onPress={() => setTheme("dark")}
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
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    }
                  >
                    Dark
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === "system" ? "solid" : "flat"}
                    color={theme === "system" ? "primary" : "default"}
                    onPress={() => setTheme("system")}
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
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    }
                  >
                    System
                  </Button>
                </div>
                <p className="text-xs text-default-500 mt-2">
                  Choose your preferred color theme for the application.
                </p>
              </div>

              {/* Invite Users */}
              <div className="border-t border-default-200 pt-4">
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Invite Users
                </label>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onValueChange={setInviteEmail}
                      className="flex-1"
                      size="sm"
                      isDisabled={isInviting}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleInviteUser();
                        }
                      }}
                    />
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={handleInviteUser}
                      isLoading={isInviting}
                      isDisabled={!inviteEmail.trim()}
                      size="sm"
                    >
                      Invite
                    </Button>
                  </div>
                  {inviteError && (
                    <p className="text-xs text-danger">{inviteError}</p>
                  )}
                  {inviteSuccess && (
                    <p className="text-xs text-success">
                      User invited successfully!
                    </p>
                  )}
                  <p className="text-xs text-default-500">
                    Invite users by their email address. They will receive
                    access to this project.
                  </p>

                  {/* Show current shared users */}
                  {project?.sharedWith && project.sharedWith.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-default-600 mb-2">
                        Shared with:
                      </p>
                      <div className="flex flex-col gap-1">
                        {project.sharedWith.map((share) => (
                          <div
                            key={share.userId}
                            className="flex items-center justify-between text-xs bg-default-100 rounded px-2 py-1"
                          >
                            <span className="text-default-700">
                              {share.email}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-default-400 capitalize">
                                {share.role}
                              </span>
                              <Button
                                size="sm"
                                variant="light"
                                color="danger"
                                isIconOnly
                                className="min-w-6 w-6 h-6"
                                onPress={() => handleRemoveUser(share.userId)}
                                isLoading={removingUserId === share.userId}
                                title="Remove user"
                              >
                                <svg
                                  className="w-3 h-3"
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
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
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
                      This will reset the boilerplate process and set the
                      executor module to restart.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={() => setIsConfigModalOpen(false)}>
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
                Before executing tasks, we need to set up the boilerplate for
                your new application using the defined tech stack.
              </p>

              {project?.analysis?.newTechStack &&
                project.analysis.newTechStack.length > 0 && (
                  <div className="bg-default-100 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-default-700 mb-3">
                      Target Tech Stack:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {project.analysis.newTechStack.map((tech) => (
                        <span
                          key={tech}
                          className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded"
                        >
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
                The project is being restarted. Please wait while the system
                resets the boilerplate and executor module.
              </p>
              <p className="text-sm text-default-500 text-center">
                This may take a few moments. You will be able to continue once
                the restart is complete.
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
        projectContext={
          project
            ? {
                name: project.name,
                description: project.description,
                techStack: project.analysis?.newTechStack,
              }
            : undefined
        }
      />

      {/* Tech Stack Configuration Modal */}
      <TechStackEditModal
        isOpen={isTechStackModalOpen}
        onOpenChange={setIsTechStackModalOpen}
        techStack={currentTechStack}
        messages={configChatHistory}
        isLoading={isConfigChatLoading}
        suggestions={suggestions}
        onSendMessage={handleSendMessage}
        onRemoveTech={handleRemoveTech}
        onClearAll={handleClearAllTech}
        onSave={handleSaveTechStack}
      />

      {/* New Epic Modal */}
      <NewEpicModal
        isOpen={isNewEpicModalOpen}
        onClose={() => setIsNewEpicModalOpen(false)}
        onSubmit={handleCreateEpic}
        tasks={tasks}
      />
    </div>
  );
}
