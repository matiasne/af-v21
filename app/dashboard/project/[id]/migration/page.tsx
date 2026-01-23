"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from "@heroui/modal";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";
import {
  MigrationConfigPanel,
  MigrationProgressCard,
  TechStackEditModal,
} from "../components";

export default function MigrationPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading, updateProject } = useProjects();
  const {
    configChatHistory,
    setConfigChatHistory,
    isConfigChatLoading,
    setIsConfigChatLoading,
    handleConfigChatHistoryChange,
    currentTechStack,
    setCurrentTechStack,
    suggestions,
    setSuggestions,
    setIsTechStackComplete,
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    setPageTitle,
    setMigrationConfigChatFunctions,
    projectContext,
  } = useProjectChat();
  const [project, setProject] = useState<Project | null>(null);

  // Config modal
  const {
    isOpen: isConfigModalOpen,
    onOpen: onConfigModalOpen,
    onOpenChange: onConfigModalOpenChange,
  } = useDisclosure();

  // Tech Stack Edit modal
  const {
    isOpen: isTechStackModalOpen,
    onOpen: onTechStackModalOpen,
    onOpenChange: onTechStackModalOpenChange,
  } = useDisclosure();

  const projectId = params.id as string;

  const {
    migration,
    processResult,
    stepResults,
    techStackAnalysis,
    loading: migrationLoading,
    initializing: migrationInitializing,
    error: migrationError,
    isProcessing,
    isCompleted,
    isError,
    createNewMigration,
    updateMigration,
    startMigration,
    stopMigration,
    resumeMigration,
    deleteMigration,
    hasMigrations,
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

  // Set migration config chat functions when available (for TechStackEditModal)
  useEffect(() => {
    setMigrationConfigChatFunctions(migrationConfigChatFunctions);
    return () => setMigrationConfigChatFunctions(null);
  }, [migrationConfigChatFunctions, setMigrationConfigChatFunctions]);

  // Check if process is stopped or error (user can edit configuration when stopped/error)
  const isStopped = migration?.action === "stop";
  const isConfigDisabled = isProcessing && !isStopped;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Find the project and sync tech stack
  useEffect(() => {
    if (projects.length > 0 && projectId) {
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
        // Sync tech stack with context
        if (foundProject.analysis?.newTechStack) {
          setCurrentTechStack(foundProject.analysis.newTechStack);
        }
      } else {
        router.push("/dashboard");
      }
    }
  }, [projects, projectId, router, setCurrentTechStack]);

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

  // Set configuration mode to false for migration page
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Set page title for navbar
  useEffect(() => {
    setPageTitle("Project Analysis & Documentation");
    return () => setPageTitle(null);
  }, [setPageTitle]);

  // Create new migration if none exists after initialization
  useEffect(() => {
    const initMigration = async () => {
      if (!project?.id || !user?.uid || migrationInitializing) return;

      // Only create if no migrations exist at all (not just current selection is null)
      if (!hasMigrations) {
        await createNewMigration();
      }
    };

    initMigration();
  }, [
    project?.id,
    user?.uid,
    hasMigrations,
    migrationInitializing,
    createNewMigration,
  ]);

  const handleStopMigration = useCallback(async () => {
    await stopMigration();
  }, [stopMigration]);

  const handleResumeMigration = useCallback(async () => {
    await resumeMigration();
  }, [resumeMigration]);

  const handleDeleteMigration = useCallback(async () => {
    await deleteMigration();
  }, [deleteMigration]);

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
          setCurrentTechStack(data.techStack);
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
      setCurrentTechStack,
      updateProject,
      project?.analysis,
      setSuggestions,
      setIsTechStackComplete,
    ],
  );

  const handleRemoveTech = useCallback(
    (tech: string) => {
      const updatedStack = currentTechStack.filter((t) => t !== tech);
      setCurrentTechStack(updatedStack);
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
      setCurrentTechStack,
    ],
  );

  const handleClearAllTech = useCallback(async () => {
    setCurrentTechStack([]);
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
    setCurrentTechStack,
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

  if (authLoading || projectsLoading || migrationInitializing) {
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
    <div className="container mx-auto max-w-6xl px-4 pb-24">
      {/* Header with Status and Actions */}
      <div className="mb-6 flex items-center gap-4">
        {isProcessing && (
          <span className="rounded-full px-3 py-1 text-sm font-medium bg-primary-100 text-primary-600">
            Processing
          </span>
        )}
        {isCompleted && (
          <span className="rounded-full px-3 py-1 text-sm font-medium bg-success-100 text-success-600">
            Completed
          </span>
        )}
        {isError && (
          <span className="rounded-full px-3 py-1 text-sm font-medium bg-danger-100 text-danger-600">
            Error
          </span>
        )}
        <div className="flex-1" />
      </div>

      {/* Error Alert */}
      {migrationError && (
        <div className="mb-6 p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400">
          {migrationError}
        </div>
      )}

      {/* Migration Progress Card */}
      {migration?.action !== "deleting" && (
        <MigrationProgressCard
          migration={migration}
          processResult={processResult}
          stepResults={stepResults}
          techStackAnalysis={techStackAnalysis}
          onStart={startMigration}
          onStop={handleStopMigration}
          onResume={handleResumeMigration}
          onOpenConfig={onConfigModalOpen}
          isLoading={migrationLoading}
          canStartMigration={
            !!migration?.githubUrl?.trim() &&
            !!project?.analysis?.newTechStack &&
            project.analysis.newTechStack.length > 0 &&
            !!migration?.defaultAgent?.provider
          }
        />
      )}

      {/* Configuration Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onOpenChange={onConfigModalOpenChange}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Configuration
              </ModalHeader>
              <ModalBody className="pb-6">
                <MigrationConfigPanel
                  migration={migration}
                  onUpdateConfig={updateMigration}
                  onDelete={handleDeleteMigration}
                  isLoading={migrationLoading}
                  disabled={isConfigDisabled}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Tech Stack Edit Modal */}
      <TechStackEditModal
        isOpen={isTechStackModalOpen}
        onOpenChange={onTechStackModalOpenChange}
        techStack={currentTechStack}
        messages={configChatHistory}
        isLoading={isConfigChatLoading}
        suggestions={suggestions}
        onSendMessage={handleSendMessage}
        onRemoveTech={handleRemoveTech}
        onClearAll={handleClearAllTech}
        onSave={handleSaveTechStack}
      />

      {/* Completed Summary */}
      {isCompleted && (
        <div className="mt-8 p-6 rounded-lg bg-success-50 dark:bg-success-900/20">
          <h3 className="text-lg font-semibold text-success-600 dark:text-success-400 mb-2">
            Migration Completed Successfully!
          </h3>
          <p className="text-default-600 mb-4">
            All migration steps have been completed. You can view the generated
            documents below.
          </p>
          <div className="flex gap-4">
            <Button
              color="success"
              variant="flat"
              onPress={() => {
                // TODO: Navigate to SDD document
              }}
            >
              View SDD Document
            </Button>
            <Button
              color="success"
              variant="flat"
              onPress={() => {
                // TODO: Navigate to Requirements
              }}
            >
              View Requirements
            </Button>
            <Button
              color="success"
              variant="flat"
              onPress={() => {
                // TODO: Navigate to Execution Plan
              }}
            >
              View Execution Plan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
