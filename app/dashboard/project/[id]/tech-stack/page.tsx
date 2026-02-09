"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";

import { ConfigurationChat } from "../components";

export default function TechStackPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: projectsLoading, updateProject, subscribeToProject } =
    useProjects();

  const projectId = params.id as string;

  // Use project chat context for shared state with layout
  const {
    configChatHistory,
    setConfigChatHistory,
    isConfigChatLoading,
    setIsConfigChatLoading,
    handleConfigChatHistoryChange,
    currentTechStack: newTechStack,
    setCurrentTechStack: setNewTechStack,
    suggestions,
    setSuggestions,
    isTechStackComplete,
    setIsTechStackComplete,
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    setMigrationConfigChatFunctions,
    projectContext,
    projectOwnerId,
  } = useProjectChat();

  // Get migration for config chat
  const {
    migration,
    hasMigrations,
    initializing: migrationInitializing,
    createNewMigration,
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

      // Create migration if none exists
      if (!hasMigrations) {
        await createNewMigration();
      }
    };

    ensureMigrationExists();
  }, [user?.uid, projectId, hasMigrations, migrationInitializing, createNewMigration]);

  const [project, setProject] = useState<Project | null>(null);

  // Subscribe to real-time project updates
  useEffect(() => {
    if (!projectId) return;

    const unsubscribe = subscribeToProject(projectId, (updatedProject) => {
      setProject(updatedProject);
      // Initialize tech stack from project if available
      if (updatedProject?.analysis?.newTechStack) {
        setNewTechStack(updatedProject.analysis.newTechStack);
      }
    });

    return () => unsubscribe();
  }, [projectId, subscribeToProject, setNewTechStack]);

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

  // Set configuration mode for this page
  useEffect(() => {
    setIsConfiguration(true);
    return () => setIsConfiguration(false);
  }, [setIsConfiguration]);

  const handleSaveTechStack = useCallback(async () => {
    if (projectId && newTechStack.length > 0) {
      await updateProject(projectId, {
        analysis: {
          ...project?.analysis,
          summary: project?.analysis?.summary || "",
          newTechStack: newTechStack,
        },
        status: {
          step: "queue",
          updatedAt: Date.now(),
          description:
            "Tech stack configuration complete. Project is queued for processing.",
        },
      });
      // Navigate back to project dashboard
      router.push(`/dashboard/project/${projectId}`);
    }
  }, [projectId, updateProject, project?.analysis, newTechStack, router]);

  const handleRemoveTech = useCallback(
    (tech: string) => {
      const updatedStack = newTechStack.filter((t) => t !== tech);
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
    [newTechStack, projectId, updateProject, project?.analysis, setNewTechStack]
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
    ]
  );

  if (authLoading || projectsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="light"
          onPress={() => router.push(`/dashboard/project/${projectId}`)}
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
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
          }
        >
          Back to Project
        </Button>
        <h1 className="text-2xl font-bold">{project.name}</h1>
      </div>

      <div className="space-y-6">
        <ConfigurationChat
          messages={configChatHistory}
          isLoading={isConfigChatLoading}
          techStack={newTechStack}
          suggestions={suggestions}
          isComplete={isTechStackComplete}
          onSave={handleSaveTechStack}
          onRemoveTech={handleRemoveTech}
          onClearAll={handleClearAllTech}
          onSendMessage={handleSendMessage}
        />
      </div>
    </div>
  );
}
