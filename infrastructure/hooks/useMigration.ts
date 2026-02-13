"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";

import { FirebaseMigrationRepository } from "../repositories/FirebaseMigrationRepository";

import {
  MigrationAction,
  ProcessResult,
  StepResult,
  StepAgentConfig,
  createMigrationAction,
} from "@/domain/entities/MigrationAction";
import {
  StepStatus,
  PROCESSING_STEPS,
  ConfigChatMessage,
} from "@/domain/entities/Project";
import { TechStackAnalysis } from "@/domain/entities/TechStackAnalysis";

const migrationRepository = new FirebaseMigrationRepository();

export interface UseMigrationReturn {
  // State
  migration: MigrationAction | null;
  allMigrations: MigrationAction[];
  processResult: ProcessResult | null;
  stepResults: StepResult[];
  techStackAnalysis: TechStackAnalysis | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;

  // Computed properties
  currentStep: StepStatus | null;
  isProcessing: boolean;
  isCompleted: boolean;
  isError: boolean;
  progress: number;
  completedStepsCount: number;
  totalStepsCount: number;
  hasMigrations: boolean;

  // Actions
  createNewMigration: (
    config?: Partial<MigrationAction>,
  ) => Promise<string | null>;
  updateMigration: (data: Partial<MigrationAction>) => Promise<void>;
  startMigration: () => Promise<void>;
  stopMigration: () => Promise<void>;
  resumeMigration: () => Promise<void>;
  deleteMigration: () => Promise<void>;
  selectMigration: (migrationId: string) => void;
  refreshMigrations: () => Promise<void>;

  // Configuration actions
  setDefaultAgent: (agent: StepAgentConfig) => Promise<void>;
  setStepAgent: (step: StepStatus, agent: StepAgentConfig) => Promise<void>;
  removeStepAgent: (step: StepStatus) => Promise<void>;
  setIgnoreSteps: (steps: StepStatus[]) => Promise<void>;
  setStartFrom: (step: StepStatus | undefined) => Promise<void>;
  setExecuteOnly: (step: StepStatus | undefined) => Promise<void>;
  rerunStep: (step: StepStatus) => Promise<void>;

  // Config chat messages
  getConfigChatMessages: () => Promise<ConfigChatMessage[]>;
  addConfigChatMessage: (
    message: Omit<ConfigChatMessage, "timestamp">,
  ) => Promise<string | null>;
  clearConfigChatMessages: () => Promise<void>;

  // Subscriptions
  unsubscribe: () => void;
}

export function useMigration(projectId: string): UseMigrationReturn {
  const [migration, setMigration] = useState<MigrationAction | null>(null);
  const [allMigrations, setAllMigrations] = useState<MigrationAction[]>([]);
  const [processResult, setProcessResult] = useState<ProcessResult | null>(
    null,
  );
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [techStackAnalysis, setTechStackAnalysis] =
    useState<TechStackAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs for unsubscribe functions to avoid circular dependency issues
  const unsubscribeMigrationRef = useRef<(() => void) | null>(null);
  const unsubscribeProcessRef = useRef<(() => void) | null>(null);
  const unsubscribeStepsRef = useRef<(() => void) | null>(null);
  const unsubscribeTechStackRef = useRef<(() => void) | null>(null);
  const initializationDone = useRef(false);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      unsubscribeMigrationRef.current?.();
      unsubscribeProcessRef.current?.();
      unsubscribeStepsRef.current?.();
      unsubscribeTechStackRef.current?.();
    };
  }, []);

  // Subscribe to migration updates
  const subscribeTo = useCallback(
    (migrationId: string) => {
      if (!projectId) return;

      // Unsubscribe from previous subscriptions
      unsubscribeMigrationRef.current?.();
      unsubscribeProcessRef.current?.();
      unsubscribeStepsRef.current?.();

      setLoading(true);

      // Subscribe to migration document
      console.log(
        "[useMigration] Setting up subscription for migration:",
        migrationId,
      );

      const unsub = migrationRepository.subscribeMigration(
        projectId,
        migrationId,
        (updatedMigration) => {
          setMigration(updatedMigration);

          // Also update this migration in allMigrations to keep tabs in sync
          if (updatedMigration) {
            setAllMigrations((prev) =>
              prev.map((m) =>
                m.id === updatedMigration.id ? updatedMigration : m,
              ),
            );
          }

          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        },
      );

      unsubscribeMigrationRef.current = unsub;
    },
    [projectId],
  );

  // Subscribe to process result and step results when migration changes
  useEffect(() => {
    if (!projectId || !migration?.id) return;

    let unsubProcessLocal: (() => void) | null = null;
    let unsubStepsLocal: (() => void) | null = null;
    let unsubTechStackLocal: (() => void) | null = null;

    // Get latest process result and subscribe
    const fetchAndSubscribe = async () => {
      const latest = await migrationRepository.getLatestProcessResult(
        projectId,
        migration.id,
      );

      if (latest) {
        setProcessResult(latest);

        // Subscribe to process result updates
        unsubProcessLocal = migrationRepository.subscribeProcessResult(
          projectId,
          migration.id,
          latest.id,
          (result) => {
            setProcessResult(result);
          },
          (err) => {
            console.error("Error subscribing to process result:", err);
          },
        );
        unsubscribeProcessRef.current = unsubProcessLocal;
      }

      // Subscribe to step results (directly under migration, not under processResults)
      // This should happen regardless of whether there's a process result
      unsubStepsLocal = migrationRepository.subscribeStepResults(
        projectId,
        migration.id,
        (results) => {
          setStepResults(results);
        },
        (err) => {
          console.error("Error subscribing to step results:", err);
        },
      );
      unsubscribeStepsRef.current = unsubStepsLocal;

      // Subscribe to tech stack analysis
      unsubTechStackLocal = migrationRepository.subscribeTechStackAnalysis(
        projectId,
        migration.id,
        (analysis) => {
          setTechStackAnalysis(analysis);
        },
        (err) => {
          console.error("Error subscribing to tech stack analysis:", err);
        },
      );
      unsubscribeTechStackRef.current = unsubTechStackLocal;
    };

    fetchAndSubscribe();

    // Cleanup subscriptions when migration changes or component unmounts
    return () => {
      unsubProcessLocal?.();
      unsubStepsLocal?.();
      unsubTechStackLocal?.();
    };
  }, [projectId, migration?.id]);

  // Fetch all migrations
  const fetchAllMigrations = useCallback(async () => {
    if (!projectId) return [];

    try {
      const migrations = await migrationRepository.getMigrations(projectId);

      setAllMigrations(migrations);

      return migrations;
    } catch (err) {
      console.error("Error fetching migrations:", err);

      return [];
    }
  }, [projectId]);

  // Auto-initialize: Check for existing migration on mount
  useEffect(() => {
    const initExistingMigration = async () => {
      if (!projectId || initializationDone.current) return;

      initializationDone.current = true;
      setInitializing(true);

      try {
        // Check if there's an existing migration for this project
        const existingMigrations = await fetchAllMigrations();

        if (existingMigrations.length > 0) {
          // Subscribe to the most recent migration
          const latestMigration = existingMigrations[0];

          subscribeTo(latestMigration.id);
        }
      } catch (err) {
        console.error("Error checking for existing migrations:", err);
      } finally {
        setInitializing(false);
      }
    };

    initExistingMigration();
  }, [projectId, subscribeTo, fetchAllMigrations]);

  // Select a specific migration
  const selectMigration = useCallback(
    (migrationId: string) => {
      subscribeTo(migrationId);
    },
    [subscribeTo],
  );

  // Refresh migrations list
  const refreshMigrations = useCallback(async () => {
    await fetchAllMigrations();
  }, [fetchAllMigrations]);

  const unsubscribe = useCallback(() => {
    unsubscribeMigrationRef.current?.();
    unsubscribeProcessRef.current?.();
    unsubscribeStepsRef.current?.();
    setMigration(null);
    setProcessResult(null);
    setStepResults([]);
  }, []);

  // Computed properties
  const currentStep = useMemo(
    () => migration?.currentStep ?? null,
    [migration],
  );

  const isProcessing = useMemo(() => {
    return migration?.action === "running" || migration?.action === "resume";
  }, [migration?.action]);

  const isCompleted = useMemo(() => currentStep === "completed", [currentStep]);

  const isError = useMemo(
    () => migration?.action === "error",
    [migration?.action],
  );

  const totalStepsCount = PROCESSING_STEPS.length;

  const completedStepsCount = useMemo(() => {
    if (!processResult) return 0;

    return processResult.stepsCompleted.length;
  }, [processResult]);

  const progress = useMemo(() => {
    if (!currentStep) return 0;

    // Ordered list of processing steps
    const orderedSteps: StepStatus[] = [
      "clone",
      "clear_conversation",
      "tech_stack_analysis",
      "inventory",
      "files_business_analysis",
      "files_functional_analysis",
      "upload_to_rag",
      "modules_detection",
      "generate_fdd_toc",
      "enrich_fdd_toc",
      "sanitize_fdd_toc",
      "generate_legacy_fdd",
    ];

    // Find the index of current step
    const currentIndex = orderedSteps.indexOf(currentStep);

    // If current step is not in the list (e.g., configuration, queue, error), return 0
    if (currentIndex === -1) {
      if (currentStep === "completed") return 100;

      return 0;
    }

    // Calculate progress as percentage based on current step position
    // currentIndex + 1 because we're at that step (not completed yet)
    return Math.round((currentIndex / orderedSteps.length) * 100);
  }, [currentStep]);

  // Actions
  const createNewMigration = useCallback(
    async (config?: Partial<MigrationAction>): Promise<string | null> => {
      if (!projectId) return null;

      try {
        setLoading(true);
        setError(null);

        const migrationData = createMigrationAction(config);
        const migrationId = await migrationRepository.createMigration(
          projectId,
          migrationData,
        );

        // Refresh migrations list and subscribe to the new migration
        await fetchAllMigrations();
        subscribeTo(migrationId);

        return migrationId;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create migration";

        setError(errorMessage);

        return null;
      } finally {
        setLoading(false);
      }
    },
    [projectId, subscribeTo, fetchAllMigrations],
  );

  const updateMigration = useCallback(
    async (data: Partial<MigrationAction>): Promise<void> => {
      if (!projectId || !migration?.id) {
        console.log("[useMigration] updateMigration skipped - missing data:", {
          hasProjectId: !!projectId,
          hasMigrationId: !!migration?.id,
        });

        return;
      }

      console.log("[useMigration] updateMigration called:", {
        migrationId: migration.id,
        data,
      });

      try {
        setError(null);
        await migrationRepository.updateMigration(
          projectId,
          migration.id,
          data,
        );
        console.log("[useMigration] updateMigration completed successfully");
      } catch (err) {
        console.error("[useMigration] updateMigration error:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update migration";

        setError(errorMessage);
      }
    },
    [projectId, migration?.id],
  );

  const startMigration = useCallback(async (): Promise<void> => {
    await updateMigration({
      action: "start",
      description: "Migration started",
    });
  }, [updateMigration]);

  const stopMigration = useCallback(async (): Promise<void> => {
    await updateMigration({
      action: "stop",
      description: "Migration stopped",
    });
  }, [updateMigration]);

  const resumeMigration = useCallback(async (): Promise<void> => {
    await updateMigration({
      action: "resume",
      description: "Migration resumed",
    });
  }, [updateMigration]);

  const deleteMigration = useCallback(async (): Promise<void> => {
    await updateMigration({
      action: "delete",
      description: "Migration deleted",
    });
  }, [updateMigration]);

  // Configuration actions
  const setDefaultAgent = useCallback(
    async (agent: StepAgentConfig): Promise<void> => {
      await updateMigration({ defaultAgent: agent });
    },
    [updateMigration],
  );

  const setStepAgent = useCallback(
    async (step: StepStatus, agent: StepAgentConfig): Promise<void> => {
      const newStepAgents = { ...migration?.stepAgents, [step]: agent };

      await updateMigration({ stepAgents: newStepAgents });
    },
    [updateMigration, migration?.stepAgents],
  );

  const removeStepAgent = useCallback(
    async (step: StepStatus): Promise<void> => {
      const newStepAgents = { ...migration?.stepAgents };

      delete newStepAgents[step];
      await updateMigration({ stepAgents: newStepAgents });
    },
    [updateMigration, migration?.stepAgents],
  );

  const setIgnoreSteps = useCallback(
    async (steps: StepStatus[]): Promise<void> => {
      await updateMigration({ ignoreSteps: steps });
    },
    [updateMigration],
  );

  const setStartFrom = useCallback(
    async (step: StepStatus | undefined): Promise<void> => {
      await updateMigration({ startFrom: step });
    },
    [updateMigration],
  );

  const setExecuteOnly = useCallback(
    async (step: StepStatus | undefined): Promise<void> => {
      await updateMigration({ executeOnly: step });
    },
    [updateMigration],
  );

  const rerunStep = useCallback(
    async (step: StepStatus): Promise<void> => {
      await updateMigration({
        executeOnly: step,
        action: "start",
        description: `Re-running step: ${step}`,
      });
    },
    [updateMigration],
  );

  // Config chat messages
  const getConfigChatMessages = useCallback(async (): Promise<
    ConfigChatMessage[]
  > => {
    if (!projectId || !migration?.id) return [];

    try {
      return await migrationRepository.getConfigChatMessages(
        projectId,
        migration.id,
      );
    } catch (err) {
      console.error("Error getting config chat messages:", err);

      return [];
    }
  }, [projectId, migration?.id]);

  const addConfigChatMessage = useCallback(
    async (
      message: Omit<ConfigChatMessage, "timestamp">,
    ): Promise<string | null> => {
      if (!projectId || !migration?.id) return null;

      try {
        return await migrationRepository.addConfigChatMessage(
          projectId,
          migration.id,
          message,
        );
      } catch (err) {
        console.error("Error adding config chat message:", err);

        return null;
      }
    },
    [projectId, migration?.id],
  );

  const clearConfigChatMessages = useCallback(async (): Promise<void> => {
    if (!projectId || !migration?.id) return;

    try {
      await migrationRepository.clearConfigChatMessages(
        projectId,
        migration.id,
      );
    } catch (err) {
      console.error("Error clearing config chat messages:", err);
    }
  }, [projectId, migration?.id]);

  return {
    // State
    migration,
    allMigrations,
    processResult,
    stepResults,
    techStackAnalysis,
    loading,
    initializing,
    error,

    // Computed properties
    currentStep,
    isProcessing,
    isCompleted,
    isError,
    progress,
    completedStepsCount,
    totalStepsCount,
    hasMigrations: allMigrations.length > 0,

    // Actions
    createNewMigration,
    updateMigration,
    startMigration,
    stopMigration,
    resumeMigration,
    deleteMigration,
    selectMigration,
    refreshMigrations,

    // Configuration actions
    setDefaultAgent,
    setStepAgent,
    removeStepAgent,
    setIgnoreSteps,
    setStartFrom,
    setExecuteOnly,
    rerunStep,

    // Config chat messages
    getConfigChatMessages,
    addConfigChatMessage,
    clearConfigChatMessages,

    // Subscriptions
    unsubscribe,
  };
}
