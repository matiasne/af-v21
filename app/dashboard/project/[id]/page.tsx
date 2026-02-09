"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { useDisclosure } from "@heroui/modal";
import { collection, query, onSnapshot } from "firebase/firestore";

import {
  UITypeSelectionModal,
  NewTechStackCard,
  TechStackEditModal,
  CodeAnalysisAndFDDCard,
  MigrationPlannerAndKanbanCard,
  ProjectConfigModal,
  ProjectStepper,
  DocumentUploadCard,
  type ProjectStep,
} from "./components";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { db } from "@/infrastructure/firebase/config";
import {
  Project,
  UIType,
  getStepLabel,
  PROCESSING_STEPS,
} from "@/domain/entities/Project";

export default function ProjectDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    subscribeToProject,
    updateProject,
    deleteProject,
    startCodeAnalysis,
    stopCodeAnalysis,
    resumeCodeAnalysis,
  } = useProjects();

  // Use project chat context for shared state with layout
  const {
    configChatHistory,
    setConfigChatHistory,
    isConfigChatLoading,
    setIsConfigChatLoading,
    handleConfigChatHistoryChange,
    currentTechStack,
    setCurrentTechStack: setNewTechStack,
    suggestions,
    setSuggestions,
    setIsTechStackComplete,
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    setMigrationConfigChatFunctions,
    projectContext,
    setPageTitle,
    setBackUrl,
  } = useProjectChat();

  // Tech Stack Edit modal
  const {
    isOpen: isTechStackModalOpen,
    onOpen: onTechStackModalOpen,
    onOpenChange: onTechStackModalOpenChange,
  } = useDisclosure();

  // Project Config modal
  const {
    isOpen: isConfigModalOpen,
    onOpen: onConfigModalOpen,
    onOpenChange: onConfigModalOpenChange,
  } = useDisclosure();

  const [project, setProject] = useState<Project | null>(null);
  const [isUpdatingUIType, setIsUpdatingUIType] = useState(false);
  const [codeAnalysisStatus, setCodeAnalysisStatus] = useState<
    string | undefined
  >(undefined);
  const [codeAnalysisError, setCodeAnalysisError] = useState<
    string | undefined
  >(undefined);
  const [codeAnalysisErrorDetails, setCodeAnalysisErrorDetails] = useState<
    string | undefined
  >(undefined);
  const [codeAnalysisCurrentStep, setCodeAnalysisCurrentStep] = useState<
    string | undefined
  >(undefined);

  // Project name/description editing state
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Stepper state - sync with URL
  const stepFromUrl = searchParams.get("step") as ProjectStep | null;
  const validSteps: ProjectStep[] = [
    "configuration",
    "code_analysis",
    "migration_planner",
  ];
  const initialStep =
    stepFromUrl && validSteps.includes(stepFromUrl)
      ? stepFromUrl
      : "configuration";
  const [activeStep, setActiveStepState] = useState<ProjectStep>(initialStep);

  // Handler to update both state and URL
  const setActiveStep = useCallback(
    (step: ProjectStep) => {
      setActiveStepState(step);
      const newParams = new URLSearchParams(searchParams.toString());

      newParams.set("step", step);
      router.push(`?${newParams.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Sync state with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const stepParam = searchParams.get("step") as ProjectStep | null;

    if (
      stepParam &&
      validSteps.includes(stepParam) &&
      stepParam !== activeStep
    ) {
      setActiveStepState(stepParam);
    }
  }, [searchParams, activeStep]);

  const projectId = params.id as string;

  // Migration hook for migration UI type
  const {
    migration,
    stepResults,
    loading: migrationLoading,
    currentStep: migrationCurrentStep,
    isProcessing: migrationIsProcessing,
    isCompleted: migrationIsCompleted,
    isError: migrationIsError,
    progress: migrationProgress,
    updateMigration,
    hasMigrations,
    createNewMigration,
    initializing: migrationInitializing,
    getConfigChatMessages,
    addConfigChatMessage,
    clearConfigChatMessages,
  } = useMigration(projectId);

  // Create memoized migration config chat functions
  const migrationConfigChatFunctions = useMemo(() => {
    if (!migration?.id) return null;

    return {
      getConfigChatMessages,
      addConfigChatMessage,
    };
  }, [migration?.id, getConfigChatMessages, addConfigChatMessage]);

  // Set migration config chat functions when available
  useEffect(() => {
    setMigrationConfigChatFunctions(migrationConfigChatFunctions);

    return () => setMigrationConfigChatFunctions(null);
  }, [migrationConfigChatFunctions, setMigrationConfigChatFunctions]);

  // Create migration if one doesn't exist (needed for config chat storage)
  useEffect(() => {
    const ensureMigrationExists = async () => {
      if (!user?.uid || !projectId || migrationInitializing) return;

      if (!hasMigrations) {
        await createNewMigration();
      }
    };

    ensureMigrationExists();
  }, [
    user?.uid,
    projectId,
    hasMigrations,
    migrationInitializing,
    createNewMigration,
  ]);

  const migrationIsStopped = migration?.action === "stop";
  const migrationIsPaused = migration?.action === "server_stop";

  // Check if UIType selection modal should be shown
  const showUITypeModal = project && !project.uiType;

  const handleUITypeSelect = async (uiType: UIType) => {
    if (!projectId) return;

    setIsUpdatingUIType(true);
    try {
      await updateProject(projectId, { uiType });
    } catch (error) {
      console.error("Error updating UIType:", error);
    } finally {
      setIsUpdatingUIType(false);
    }
  };

  // Derive project state from project data
  const currentStep = project?.status?.step || "configuration";
  const isConfiguration = currentStep === "configuration";
  const isQueue = currentStep === "queue";
  const isProcessing = PROCESSING_STEPS.includes(currentStep);
  const isCompleted = currentStep === "completed";
  const isError = currentStep === "error";

  const projectState = {
    step: currentStep,
    label: getStepLabel(currentStep),
    colorClasses: isCompleted
      ? "bg-success-100 text-success-700"
      : isError
        ? "bg-danger-100 text-danger-700"
        : isProcessing
          ? "bg-primary-100 text-primary-700"
          : "bg-default-100 text-default-600",
    isConfiguration,
    isQueue,
    isProcessing,
    isCompleted,
    isError,
  };

  // Tech stack edit handlers
  const handleSendMessage = useCallback(
    async (message: string) => {
      const userMessage = { role: "user" as const, content: message };

      // Build new history from current state
      const newHistory = [...configChatHistory, userMessage];

      // Update state immediately so the message shows in the UI
      setConfigChatHistory(newHistory);
      // Also persist to Firebase
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
            projectContext,
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

        // Update tech stack if returned
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

        if (data.isComplete !== undefined) {
          setIsTechStackComplete(data.isComplete);
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
      projectContext,
      setNewTechStack,
      updateProject,
      project?.analysis,
      setSuggestions,
      setIsTechStackComplete,
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

  const handleClearAllTech = useCallback(async () => {
    setNewTechStack([]);
    setSuggestions([]);
    setIsTechStackComplete(false);
    // Clear chat history in state
    setConfigChatHistory([]);
    // Clear chat messages from Firebase
    await clearConfigChatMessages();
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
    setIsTechStackComplete,
    setConfigChatHistory,
    clearConfigChatMessages,
  ]);

  const handleSaveTechStack = useCallback(async () => {
    if (projectId && currentTechStack.length > 0) {
      await updateProject(projectId, {
        analysis: {
          ...project?.analysis,
          summary: project?.analysis?.summary || "",
          newTechStack: currentTechStack,
        },
      });
    }
  }, [projectId, updateProject, project?.analysis, currentTechStack]);

  // Start code analysis handler
  const handleStartAnalysis = useCallback(async () => {
    if (!projectId || !migration?.id) {
      console.error("Missing projectId or migrationId");

      return;
    }

    try {
      await startCodeAnalysis(projectId, migration.id);
    } catch (error) {
      console.error("Error starting code analysis:", error);
    }
  }, [projectId, migration?.id, startCodeAnalysis]);

  // Stop analysis handler with confirmation
  const handleStopAnalysis = useCallback(async () => {
    if (!projectId || !migration?.id) {
      console.error("Missing projectId or migrationId");

      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to stop the analysis? This action cannot be undone and you may need to restart the process from the beginning.",
    );

    if (!confirmed) return;

    try {
      await stopCodeAnalysis(projectId, migration.id);
    } catch (error) {
      console.error("Error stopping code analysis:", error);
    }
  }, [projectId, migration?.id, stopCodeAnalysis]);

  // Resume analysis handler
  const handleResumeAnalysis = useCallback(async () => {
    console.log("[page] handleResumeAnalysis called:", {
      projectId,
      migrationId: migration?.id,
    });
    if (!projectId || !migration?.id) {
      console.error("Missing projectId or migrationId");

      return;
    }

    try {
      console.log("[page] Calling resumeCodeAnalysis");
      const result = await resumeCodeAnalysis(projectId, migration.id);

      console.log("[page] resumeCodeAnalysis result:", result);
    } catch (error) {
      console.error("Error resuming code analysis:", error);
    }
  }, [projectId, migration?.id, resumeCodeAnalysis]);

  // Update migration config handler
  const handleUpdateMigrationConfig = useCallback(
    async (data: {
      processorHost?: string;
      defaultAgent?: any;
      stepAgents?: Record<string, any>;
    }) => {
      if (!projectId) return;
      await updateMigration(data);
    },
    [projectId, updateMigration],
  );

  // Delete project handler
  const handleDeleteProject = useCallback(async () => {
    if (!projectId) return;
    const success = await deleteProject(projectId);

    if (success) {
      router.push("/dashboard");
    }
  }, [projectId, deleteProject, router]);

  // Project editing handlers
  const handleStartEditProject = useCallback(() => {
    setEditedName(project?.name || "");
    setEditedDescription(project?.description || "");
    setIsEditingProject(true);
  }, [project?.name, project?.description]);

  const handleCancelEditProject = useCallback(() => {
    setIsEditingProject(false);
    setEditedName("");
    setEditedDescription("");
  }, []);

  const handleSaveProject = useCallback(async () => {
    if (!projectId || !editedName.trim()) return;

    setIsSavingProject(true);
    try {
      await updateProject(projectId, {
        name: editedName.trim(),
        description: editedDescription.trim() || undefined,
      });
      setIsEditingProject(false);
    } catch (error) {
      console.error("Error updating project:", error);
    } finally {
      setIsSavingProject(false);
    }
  }, [projectId, editedName, editedDescription, updateProject]);

  // Sync project context with layout
  useEffect(() => {
    if (project) {
      setProjectContext({
        name: project.name,
        description: project.description,
        status: projectState.step,
        githubUrl: project.githubUrl,
      });
      setCurrentProjectId(project.id || null);
    }
  }, [project, projectState.step, setProjectContext, setCurrentProjectId]);

  // Sync configuration mode with layout
  useEffect(() => {
    setIsConfiguration(projectState.isConfiguration);
  }, [projectState.isConfiguration, setIsConfiguration]);

  // Set page title for navbar (shows project name)
  useEffect(() => {
    if (project?.name) {
      setPageTitle(project.name);
    }

    return () => setPageTitle(null);
  }, [project?.name, setPageTitle]);

  // Set back URL to dashboard
  useEffect(() => {
    setBackUrl("/dashboard");

    return () => setBackUrl(null);
  }, [setBackUrl]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Initial load - find project from projects array or fetch from any owner (for shared projects)
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !user) return;

      // Find project in the loaded projects array
      const foundProject = projects.find((p) => p.id === projectId);

      if (foundProject) {
        setProject(foundProject);
        if (foundProject.analysis?.newTechStack) {
          setNewTechStack(foundProject.analysis.newTechStack);
        }
      } else if (!projectsLoading) {
        // Project not found
        router.push("/dashboard");
      }
    };

    loadProject();
  }, [projects, projectId, projectsLoading, user, router, setNewTechStack]);

  // Real-time subscription for project updates
  useEffect(() => {
    if (!projectId || !user) return;

    const unsubscribe = subscribeToProject(projectId, (updatedProject) => {
      if (updatedProject) {
        setProject(updatedProject);
        if (updatedProject.analysis?.newTechStack) {
          setNewTechStack(updatedProject.analysis.newTechStack);
        }
      } else {
        router.push("/dashboard");
      }
    });

    return () => unsubscribe();
  }, [projectId, user, subscribeToProject, router, setNewTechStack]);

  // Real-time subscription for code-analysis-module action
  useEffect(() => {
    if (!projectId) return;

    const codeAnalysisCol = collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
    );
    const q = query(codeAnalysisCol);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();

        setCodeAnalysisStatus(data.action);
        setCodeAnalysisError(data.error);
        setCodeAnalysisErrorDetails(data.errorDetails);
        setCodeAnalysisCurrentStep(data.currentStep);
      } else {
        setCodeAnalysisStatus(undefined);
        setCodeAnalysisError(undefined);
        setCodeAnalysisErrorDetails(undefined);
        setCodeAnalysisCurrentStep(undefined);
      }
    });

    return () => unsubscribe();
  }, [projectId]);

  if (authLoading || projectsLoading) {
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
    <>
      <UITypeSelectionModal
        isLoading={isUpdatingUIType}
        isOpen={!!showUITypeModal}
        onSelect={handleUITypeSelect}
      />

      <div className="container mx-auto max-w-6xl px-4 py-2">
        {/* Project Header with Configuration and Share Buttons */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 mr-4">
            {isEditingProject ? (
              <div className="space-y-3">
                <Input
                  classNames={{
                    input: "text-xl font-bold",
                  }}
                  placeholder="Project name"
                  size="lg"
                  value={editedName}
                  variant="bordered"
                  onValueChange={setEditedName}
                />
                <Textarea
                  maxRows={4}
                  minRows={2}
                  placeholder="Project description (optional)"
                  size="sm"
                  value={editedDescription}
                  variant="bordered"
                  onValueChange={setEditedDescription}
                />
                <div className="flex gap-2">
                  <Button
                    color="primary"
                    isDisabled={!editedName.trim()}
                    isLoading={isSavingProject}
                    size="sm"
                    onPress={handleSaveProject}
                  >
                    Save
                  </Button>
                  <Button
                    isDisabled={isSavingProject}
                    size="sm"
                    variant="flat"
                    onPress={handleCancelEditProject}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="group flex items-start gap-2">
                <div>
                  <h1 className="text-2xl font-bold">{project.name}</h1>
                  {project.description ? (
                    <p className="text-sm text-default-500 mt-1">
                      {project.description}
                    </p>
                  ) : (
                    <p className="text-sm text-default-400 mt-1 italic">
                      No description
                    </p>
                  )}
                </div>
                <Button
                  isIconOnly
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  size="sm"
                  variant="light"
                  onPress={handleStartEditProject}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="pb-24 space-y-6">
          {/* Migration UI Type */}
          {project.uiType === "migration" && (
            <>
              {/* Project Stepper */}
              <ProjectStepper
                currentStep={activeStep}
                isCodeAnalysisComplete={codeAnalysisStatus === "completed"}
                isCodeAnalysisRunning={
                  codeAnalysisStatus === "running" ||
                  codeAnalysisStatus === "start" ||
                  migrationIsProcessing
                }
                isConfigurationComplete={
                  !!migration?.githubUrl &&
                  !!project.analysis?.newTechStack &&
                  project.analysis.newTechStack.length > 0
                }
                onStepChange={setActiveStep}
              />

              {/* Step 1: Configuration */}
              {activeStep === "configuration" && (
                <div className="space-y-6">
                  {/* Base GitHub Repository */}
                  <Card>
                    <CardHeader>
                      <h3 className="text-lg font-semibold">
                        Base GitHub Repository (Legacy)
                      </h3>
                    </CardHeader>
                    <CardBody>
                      <Input
                        description={
                          migrationIsProcessing || migrationIsCompleted
                            ? "Cannot change GitHub URL after analysis has started"
                            : "Enter the GitHub repository URL for this migration"
                        }
                        isDisabled={
                          migrationLoading ||
                          migrationIsProcessing ||
                          migrationIsCompleted
                        }
                        label="GitHub URL"
                        placeholder="https://github.com/username/repository"
                        value={migration?.githubUrl || ""}
                        onValueChange={(value) =>
                          updateMigration({ githubUrl: value })
                        }
                      />
                    </CardBody>
                  </Card>

                  {/* New Tech Stack */}
                  <NewTechStackCard
                    canSelect={true}
                    isDisabled={migrationIsProcessing || migrationIsCompleted}
                    newTechStack={project.analysis?.newTechStack}
                    onEdit={onTechStackModalOpen}
                    onSelect={onTechStackModalOpen}
                  />

                  {/* Navigation Buttons */}
                  <div className="flex justify-between">
                    <Button
                      color="default"
                      startContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      variant="flat"
                      onPress={onConfigModalOpen}
                    >
                      Advanced Configuration
                    </Button>
                    <Button
                      color="primary"
                      endContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      onPress={() => setActiveStep("code_analysis")}
                    >
                      Next: Code Analysis
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Code Analysis */}
              {activeStep === "code_analysis" && (
                <div className="space-y-6">
                  <CodeAnalysisAndFDDCard
                    codeAnalysisCurrentStep={codeAnalysisCurrentStep}
                    codeAnalysisError={codeAnalysisError}
                    codeAnalysisErrorDetails={codeAnalysisErrorDetails}
                    codeAnalysisStatus={codeAnalysisStatus}
                    currentStep={migrationCurrentStep}
                    githubUrl={migration?.githubUrl}
                    isCompleted={migrationIsCompleted}
                    isError={migrationIsError}
                    isLoading={migrationLoading}
                    isPaused={migrationIsPaused}
                    isProcessing={migrationIsProcessing}
                    isStopped={migrationIsStopped}
                    migration={migration}
                    migrationId={migration?.id}
                    newTechStack={project.analysis?.newTechStack}
                    progress={migrationProgress}
                    projectId={projectId}
                    stepResults={stepResults}
                    onNavigateToFDD={() =>
                      router.push(`/dashboard/project/${projectId}/fdd`)
                    }
                    onNavigateToFilesAnalysis={() =>
                      router.push(
                        `/dashboard/project/${projectId}/files-analysis`,
                      )
                    }
                    onNavigateToMigration={() =>
                      router.push(`/dashboard/project/${projectId}/migration`)
                    }
                    onResumeAnalysis={handleResumeAnalysis}
                    onStartAnalysis={handleStartAnalysis}
                    onStopAnalysis={handleStopAnalysis}
                  />

                  {/* Navigation Buttons */}
                  <div className="flex justify-between">
                    <Button
                      startContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      variant="flat"
                      onPress={() => setActiveStep("configuration")}
                    >
                      Back: Configuration
                    </Button>
                    <Button
                      color="primary"
                      endContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      onPress={() => setActiveStep("migration_planner")}
                    >
                      Next: Migration Planner
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Migration Planner */}
              {activeStep === "migration_planner" && (
                <div className="space-y-6">
                  <MigrationPlannerAndKanbanCard
                    codeAnalysisStatus={codeAnalysisStatus}
                    projectId={projectId}
                    onNavigateToFDD={() =>
                      router.push(`/dashboard/project/${projectId}/fdd`)
                    }
                    onNavigateToKanban={() =>
                      router.push(`/dashboard/project/${projectId}/kanban`)
                    }
                  />

                  {/* Back Button */}
                  <div className="flex justify-start">
                    <Button
                      startContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      variant="flat"
                      onPress={() => setActiveStep("code_analysis")}
                    >
                      Back: Code Analysis
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Start from Documentation UI Type */}
          {project.uiType === "start_from_doc" && (
            <>
              {/* Project Stepper - 2 steps for start_from_doc */}
              <ProjectStepper
                currentStep={
                  activeStep === "code_analysis"
                    ? "migration_planner"
                    : activeStep
                }
                isConfigurationComplete={
                  !!project.analysis?.newTechStack &&
                  project.analysis.newTechStack.length > 0
                }
                uiType="start_from_doc"
                onStepChange={setActiveStep}
              />

              {/* Step 1: Configuration */}
              {activeStep === "configuration" && (
                <div className="space-y-6">
                  {/* Document Upload */}
                  <DocumentUploadCard projectId={projectId} />

                  {/* New Tech Stack */}
                  <NewTechStackCard
                    canSelect={true}
                    newTechStack={project.analysis?.newTechStack}
                    onEdit={onTechStackModalOpen}
                    onSelect={onTechStackModalOpen}
                  />

                  {/* Navigation Buttons */}
                  <div className="flex justify-between">
                    <Button
                      color="default"
                      startContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      variant="flat"
                      onPress={onConfigModalOpen}
                    >
                      Advanced Configuration
                    </Button>
                    <Button
                      color="primary"
                      endContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      onPress={() => setActiveStep("migration_planner")}
                    >
                      Next: Planner
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Planner */}
              {activeStep === "migration_planner" && (
                <div className="space-y-6">
                  <MigrationPlannerAndKanbanCard
                    projectId={projectId}
                    onNavigateToFDD={() =>
                      router.push(`/dashboard/project/${projectId}/fdd`)
                    }
                    onNavigateToKanban={() =>
                      router.push(`/dashboard/project/${projectId}/kanban`)
                    }
                  />

                  {/* Back Button */}
                  <div className="flex justify-start">
                    <Button
                      startContent={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      }
                      variant="flat"
                      onPress={() => setActiveStep("configuration")}
                    >
                      Back: Configuration
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tech Stack Edit Modal */}
      <TechStackEditModal
        isLoading={isConfigChatLoading}
        isOpen={isTechStackModalOpen}
        messages={configChatHistory}
        suggestions={suggestions}
        techStack={currentTechStack}
        onClearAll={handleClearAllTech}
        onOpenChange={onTechStackModalOpenChange}
        onRemoveTech={handleRemoveTech}
        onSave={handleSaveTechStack}
        onSendMessage={handleSendMessage}
      />

      {/* Project Configuration Modal */}
      <ProjectConfigModal
        isOpen={isConfigModalOpen}
        migration={migration}
        projectName={project.name}
        uiType={project.uiType}
        onDeleteProject={handleDeleteProject}
        onOpenChange={onConfigModalOpenChange}
        onUpdateMigrationConfig={handleUpdateMigrationConfig}
        onUpdateProject={async (data) => {
          await updateProject(projectId, data);
        }}
      />
    </>
  );
}
