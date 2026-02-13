"use client";

import { useState, useCallback, useEffect, useMemo } from "react";

import { Project, ConfigChatMessage } from "@/domain/entities/Project";
import { FirebaseProjectRepository } from "@/infrastructure/repositories/FirebaseProjectRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

export function useProjects() {
  const projectRepository = useMemo(() => new FirebaseProjectRepository(), []);
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = useCallback(
    async (showLoading = true) => {
      if (!user) {
        setProjects([]);
        setLoading(false);

        return;
      }

      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      try {
        const ownedProjects = await projectRepository.getProjects(user.uid);

        setProjects(ownedProjects);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [user, projectRepository],
  );

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(
    async (
      data: Omit<Project, "id" | "createdAt" | "updatedAt" | "status">,
    ): Promise<string | null> => {
      if (!user) {
        return null;
      }

      setError(null);

      try {
        const id = await projectRepository.createProject(user.uid, data);

        await fetchProjects();

        return id;
      } catch (err) {
        setError(err as Error);

        return null;
      }
    },
    [user, fetchProjects, projectRepository],
  );

  const updateProject = useCallback(
    async (projectId: string, data: Partial<Project>): Promise<boolean> => {
      if (!user) return false;

      setError(null);

      try {
        await projectRepository.updateProject(user.uid, projectId, data);
        // Don't show loading spinner during background refresh after update
        await fetchProjects(false);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, fetchProjects, projectRepository],
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!user) return false;

      setError(null);

      try {
        await projectRepository.deleteProject(user.uid, projectId);
        await fetchProjects();

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, fetchProjects, projectRepository],
  );

  const getConfigChatMessages = useCallback(
    async (projectId: string): Promise<ConfigChatMessage[]> => {
      if (!user) return [];

      try {
        return await projectRepository.getConfigChatMessages(
          user.uid,
          projectId,
        );
      } catch (err) {
        setError(err as Error);

        return [];
      }
    },
    [user, projectRepository],
  );

  const addConfigChatMessage = useCallback(
    async (
      projectId: string,
      message: Omit<ConfigChatMessage, "timestamp">,
    ): Promise<string | null> => {
      if (!user) return null;

      try {
        return await projectRepository.addConfigChatMessage(
          user.uid,
          projectId,
          message,
        );
      } catch (err) {
        setError(err as Error);

        return null;
      }
    },
    [user, projectRepository],
  );

  const clearConfigChatMessages = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        await projectRepository.clearConfigChatMessages(user.uid, projectId);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, projectRepository],
  );

  const getGeneralChatMessages = useCallback(
    async (projectId: string): Promise<ConfigChatMessage[]> => {
      if (!user) return [];

      try {
        return await projectRepository.getGeneralChatMessages(
          user.uid,
          projectId,
        );
      } catch (err) {
        setError(err as Error);

        return [];
      }
    },
    [user, projectRepository],
  );

  const addGeneralChatMessage = useCallback(
    async (
      projectId: string,
      message: Omit<ConfigChatMessage, "timestamp">,
    ): Promise<string | null> => {
      if (!user) return null;

      try {
        return await projectRepository.addGeneralChatMessage(
          user.uid,
          projectId,
          message,
        );
      } catch (err) {
        setError(err as Error);

        return null;
      }
    },
    [user, projectRepository],
  );

  const getLegacyFilesCount = useCallback(
    async (projectId: string): Promise<number> => {
      if (!user) return 0;

      try {
        return await projectRepository.getLegacyFilesCount(user.uid, projectId);
      } catch (err) {
        setError(err as Error);

        return 0;
      }
    },
    [user, projectRepository],
  );

  const updateExecutorModel = useCallback(
    async (projectId: string, executorModel: string): Promise<void> => {
      console.log("[useProjects] updateExecutorModel called:", {
        hasUser: !!user,
        projectId,
        executorModel,
      });

      if (!user) {
        console.log("[useProjects] No user, skipping update");

        return;
      }

      try {
        console.log("[useProjects] Calling repository.updateExecutorModel");
        await projectRepository.updateExecutorModel(
          user.uid,
          projectId,
          executorModel,
        );
        console.log("[useProjects] updateExecutorModel completed successfully");
        // Optionally refresh projects to get the updated data
        await fetchProjects(false);
      } catch (err) {
        console.error("[useProjects] Error updating executor model:", err);
        setError(err as Error);
      }
    },
    [user, projectRepository, fetchProjects],
  );

  const subscribeToProject = useCallback(
    (projectId: string, onUpdate: (project: Project | null) => void) => {
      if (!user) return () => {};

      return projectRepository.subscribeToProject(
        user.uid,
        projectId,
        onUpdate,
      );
    },
    [user, projectRepository],
  );

  const startCodeAnalysis = useCallback(
    async (projectId: string, migrationId: string): Promise<boolean> => {
      if (!user) return false;

      setError(null);

      try {
        await projectRepository.startCodeAnalysis(projectId, migrationId);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, projectRepository],
  );

  const stopCodeAnalysis = useCallback(
    async (projectId: string, migrationId: string): Promise<boolean> => {
      if (!user) return false;

      setError(null);

      try {
        await projectRepository.stopCodeAnalysis(projectId, migrationId);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, projectRepository],
  );

  const resumeCodeAnalysis = useCallback(
    async (projectId: string, migrationId: string): Promise<boolean> => {
      console.log("[useProjects] resumeCodeAnalysis called:", {
        hasUser: !!user,
        projectId,
        migrationId,
      });
      if (!user) return false;

      setError(null);

      try {
        console.log(
          "[useProjects] Calling projectRepository.resumeCodeAnalysis",
        );
        await projectRepository.resumeCodeAnalysis(projectId, migrationId);
        console.log("[useProjects] resumeCodeAnalysis completed successfully");

        return true;
      } catch (err) {
        console.error("[useProjects] Error in resumeCodeAnalysis:", err);
        setError(err as Error);

        return false;
      }
    },
    [user, projectRepository],
  );

  const subscribeToExecutorModule = useCallback(
    (
      projectId: string,
      onUpdate: (
        data: {
          boilerplateDone?: boolean;
          action?: string;
          error?: string;
        } | null,
      ) => void,
    ) => {
      if (!user) return () => {};

      return projectRepository.subscribeToExecutorModule(
        user.uid,
        projectId,
        onUpdate,
      );
    },
    [user, projectRepository],
  );

  const startBoilerplate = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!user) return false;

      setError(null);

      try {
        await projectRepository.startBoilerplate(user.uid, projectId);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, projectRepository],
  );

  const restartExecutorModule = useCallback(
    async (projectId: string): Promise<boolean> => {
      if (!user) return false;

      setError(null);

      try {
        await projectRepository.restartExecutorModule(user.uid, projectId);

        return true;
      } catch (err) {
        setError(err as Error);

        return false;
      }
    },
    [user, projectRepository],
  );

  const inviteUserToProject = useCallback(
    async (
      projectId: string,
      inviteeEmail: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated" };

      try {
        const result = await projectRepository.inviteUserToProject(
          user.uid,
          projectId,
          inviteeEmail,
        );

        if (result.success) {
          // Refresh projects to get updated sharedWith list
          await fetchProjects(false);
        }

        return result;
      } catch (err) {
        setError(err as Error);

        return { success: false, error: "Failed to invite user" };
      }
    },
    [user, projectRepository, fetchProjects],
  );

  const removeUserFromProject = useCallback(
    async (
      projectId: string,
      userIdToRemove: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) return { success: false, error: "Not authenticated" };

      try {
        const result = await projectRepository.removeUserFromProject(
          user.uid,
          projectId,
          userIdToRemove,
        );

        if (result.success) {
          // Refresh projects to get updated sharedWith list
          await fetchProjects(false);
        }

        return result;
      } catch (err) {
        setError(err as Error);

        return { success: false, error: "Failed to remove user" };
      }
    },
    [user, projectRepository, fetchProjects],
  );

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects: fetchProjects,
    getConfigChatMessages,
    addConfigChatMessage,
    clearConfigChatMessages,
    getGeneralChatMessages,
    addGeneralChatMessage,
    getLegacyFilesCount,
    updateExecutorModel,
    subscribeToProject,
    startCodeAnalysis,
    stopCodeAnalysis,
    resumeCodeAnalysis,
    subscribeToExecutorModule,
    startBoilerplate,
    restartExecutorModule,
    inviteUserToProject,
    removeUserFromProject,
  };
}
