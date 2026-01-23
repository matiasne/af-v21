import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  onSnapshot,
  limit,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/config";
import {
  MigrationAction,
  ProcessResult,
  StepResult,
  StepAgentConfig,
} from "@/domain/entities/MigrationAction";
import { MigrationRepository } from "@/domain/repositories/MigrationRepository";
import { StepStatus, ConfigChatMessage } from "@/domain/entities/Project";
import { TechStackAnalysis, TechItem } from "@/domain/entities/TechStackAnalysis";

export class FirebaseMigrationRepository implements MigrationRepository {
  private getMigrationsCollection(userId: string, projectId: string) {
    return collection(db, "users", userId, "projects", projectId, "code-analysis-module");
  }

  private getMigrationDoc(userId: string, projectId: string, migrationId: string) {
    return doc(db, "users", userId, "projects", projectId, "code-analysis-module", migrationId);
  }

  // Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/processResults
  private getProcessResultsCollection(userId: string, projectId: string, migrationId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "processResults"
    );
  }

  // Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/processResults/{processId}
  private getProcessResultDoc(
    userId: string,
    projectId: string,
    migrationId: string,
    processId: string
  ) {
    return doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "processResults",
      processId
    );
  }

  // Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/step_results
  private getStepResultsCollection(
    userId: string,
    projectId: string,
    migrationId: string
  ) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "step_results"
    );
  }

  // Convert Firestore data to MigrationAction
  private toMigrationAction(id: string, data: Record<string, unknown>): MigrationAction {
    const stepAgents: Record<string, StepAgentConfig> = {};
    const stepAgentsData = data.stepAgents as Record<string, Record<string, unknown>> | undefined;

    if (stepAgentsData) {
      for (const [step, config] of Object.entries(stepAgentsData)) {
        stepAgents[step] = {
          provider: (config.provider as "claude" | "openrouter") || "claude",
          model: config.model as string | undefined,
        };
      }
    }

    let defaultAgent: StepAgentConfig | undefined;
    const defaultAgentData = data.defaultAgent as Record<string, unknown> | undefined;
    if (defaultAgentData) {
      defaultAgent = {
        provider: (defaultAgentData.provider as "claude" | "openrouter") || "claude",
        model: defaultAgentData.model as string | undefined,
      };
    }

    return {
      id,
      name: data.name as string | undefined,
      currentStep: (data.currentStep as StepStatus) || "queue",
      updatedAt: (data.updatedAt as number) || Date.now(),
      description: data.description as string | undefined,
      action: data.action as "start" | "stop" | "resume" | "running" | undefined,
      startFrom: data.startFrom as StepStatus | undefined,
      executeOnly: data.executeOnly as StepStatus | undefined,
      ignoreSteps: (data.ignoreSteps as StepStatus[]) || [],
      ragFunctionalAndBusinessStoreName: data.ragFunctionalandBussinessStoreName as string | undefined,
      sddRagStoreName: data.sddRagStoreName as string | undefined,
      stepAgents,
      defaultAgent,
      processorHost: data.processorHost as string | undefined,
      githubUrl: data.githubUrl as string | undefined,
    };
  }

  // Helper to remove undefined values from an object (Firestore doesn't accept undefined)
  private removeUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
    const result = {} as T;
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        (result as Record<string, unknown>)[key] = value;
      }
    }
    return result;
  }

  // Convert MigrationAction to Firestore data
  private toFirestoreData(migration: Partial<MigrationAction>): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (migration.name !== undefined) {
      data.name = migration.name;
    }
    if (migration.currentStep !== undefined) {
      data.currentStep = migration.currentStep;
    }
    if (migration.updatedAt !== undefined) {
      data.updatedAt = migration.updatedAt;
    }
    if (migration.description !== undefined) {
      data.description = migration.description;
    }
    if (migration.action !== undefined) {
      data.action = migration.action;
    }
    if (migration.startFrom !== undefined) {
      data.startFrom = migration.startFrom;
    }
    if (migration.executeOnly !== undefined) {
      data.executeOnly = migration.executeOnly;
    }
    if (migration.ignoreSteps !== undefined) {
      data.ignoreSteps = migration.ignoreSteps;
    }
    if (migration.ragFunctionalAndBusinessStoreName !== undefined) {
      data.ragFunctionalandBussinessStoreName = migration.ragFunctionalAndBusinessStoreName;
    }
    if (migration.sddRagStoreName !== undefined) {
      data.sddRagStoreName = migration.sddRagStoreName;
    }
    if (migration.stepAgents !== undefined) {
      // Clean undefined values from each step agent config
      const cleanedStepAgents: Record<string, Record<string, unknown>> = {};
      for (const [step, config] of Object.entries(migration.stepAgents)) {
        cleanedStepAgents[step] = this.removeUndefinedValues(config as unknown as Record<string, unknown>);
      }
      data.stepAgents = cleanedStepAgents;
    }
    if (migration.defaultAgent !== undefined) {
      // Clean undefined values from default agent config
      data.defaultAgent = this.removeUndefinedValues(migration.defaultAgent as unknown as Record<string, unknown>);
    }
    if (migration.processorHost !== undefined) {
      data.processorHost = migration.processorHost;
    }
    if (migration.githubUrl !== undefined) {
      data.githubUrl = migration.githubUrl;
    }

    return data;
  }

  // Convert Firestore data to ProcessResult
  private toProcessResult(id: string, data: Record<string, unknown>): ProcessResult {
    return {
      id,
      startDate: (data.startDate as number) || Date.now(),
      finishDate: data.finishDate as number | undefined,
      status: (data.status as "in_progress" | "completed" | "error") || "in_progress",
      currentStep: data.currentStep as StepStatus | undefined,
      stepsCompleted: (data.stepsCompleted as string[]) || [],
      outputs: (data.outputs as Record<string, unknown>) || {},
      ragStoreName: data.ragStoreName as string | undefined,
      error: data.error as string | undefined,
      errorDetails: data.errorDetails as string | undefined,
    };
  }

  // Convert Firestore data to StepResult
  private toStepResult(id: string, data: Record<string, unknown>): StepResult {
    return {
      id,
      step: (data.step as StepStatus) || "queue",
      startDate: (data.startDate as number) || Date.now(),
      finishDate: data.finishDate as number | undefined,
      duration: data.duration as number | undefined,
      status: (data.status as "in_progress" | "completed" | "error") || "in_progress",
      metadata: data.metadata as Record<string, unknown> | undefined,
      error: data.error as string | undefined,
      errorDetails: data.errorDetails as string | undefined,
    };
  }

  // Migration Actions
  async getMigrations(userId: string, projectId: string): Promise<MigrationAction[]> {
    const q = query(
      this.getMigrationsCollection(userId, projectId),
      orderBy("updatedAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toMigrationAction(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  async getMigration(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<MigrationAction | null> {
    const docRef = this.getMigrationDoc(userId, projectId, migrationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.toMigrationAction(docSnap.id, docSnap.data() as Record<string, unknown>);
  }

  async createMigration(
    userId: string,
    projectId: string,
    migration: Omit<MigrationAction, "id">
  ): Promise<string> {
    const docRef = await addDoc(
      this.getMigrationsCollection(userId, projectId),
      this.toFirestoreData(migration)
    );

    return docRef.id;
  }

  async updateMigration(
    userId: string,
    projectId: string,
    migrationId: string,
    data: Partial<MigrationAction>
  ): Promise<void> {
    const docRef = this.getMigrationDoc(userId, projectId, migrationId);

    await updateDoc(docRef, {
      ...this.toFirestoreData(data),
      updatedAt: Date.now(),
    });
  }

  async deleteMigration(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void> {
    const docRef = this.getMigrationDoc(userId, projectId, migrationId);
    await deleteDoc(docRef);
  }

  // Real-time subscription for migration
  subscribeMigration(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (migration: MigrationAction | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = this.getMigrationDoc(userId, projectId, migrationId);

    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(this.toMigrationAction(docSnap.id, docSnap.data() as Record<string, unknown>));
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error("Error subscribing to migration:", error);
        onError?.(error);
      }
    );
  }

  // Process Results
  async getProcessResults(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<ProcessResult[]> {
    const q = query(
      this.getProcessResultsCollection(userId, projectId, migrationId),
      orderBy("startDate", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toProcessResult(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  async getLatestProcessResult(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<ProcessResult | null> {
    const q = query(
      this.getProcessResultsCollection(userId, projectId, migrationId),
      orderBy("startDate", "desc"),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return this.toProcessResult(doc.id, doc.data() as Record<string, unknown>);
  }

  // Real-time subscription for process result
  subscribeProcessResult(
    userId: string,
    projectId: string,
    migrationId: string,
    processId: string,
    onUpdate: (result: ProcessResult | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = this.getProcessResultDoc(userId, projectId, migrationId, processId);

    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(this.toProcessResult(docSnap.id, docSnap.data() as Record<string, unknown>));
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error("Error subscribing to process result:", error);
        onError?.(error);
      }
    );
  }

  // Step Results
  async getStepResults(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<StepResult[]> {
    const q = query(
      this.getStepResultsCollection(userId, projectId, migrationId),
      orderBy("startDate", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toStepResult(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  // Real-time subscription for step results
  subscribeStepResults(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (results: StepResult[]) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const q = query(
      this.getStepResultsCollection(userId, projectId, migrationId),
      orderBy("startDate", "asc")
    );

    return onSnapshot(
      q,
      (querySnapshot) => {
        const results = querySnapshot.docs.map((doc) =>
          this.toStepResult(doc.id, doc.data() as Record<string, unknown>)
        );
        onUpdate(results);
      },
      (error) => {
        console.error("Error subscribing to step results:", error);
        onError?.(error);
      }
    );
  }

  // Tech Stack Analysis - Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/tech_stack/analysis
  private getTechStackAnalysisDoc(
    userId: string,
    projectId: string,
    migrationId: string
  ) {
    return doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "tech_stack",
      "analysis"
    );
  }

  private toTechStackAnalysis(data: Record<string, unknown>): TechStackAnalysis {
    const toTechItems = (items: unknown[]): TechItem[] => {
      if (!items || !Array.isArray(items)) return [];
      return items.map((item) => {
        const itemData = item as Record<string, unknown>;
        return {
          name: (itemData.name as string) || "",
          extensions: (itemData.extensions as string[]) || [],
        };
      });
    };

    return {
      languages: toTechItems(data.languages as unknown[]),
      frameworks: toTechItems(data.frameworks as unknown[]),
      databases: toTechItems(data.databases as unknown[]),
      buildTools: toTechItems(data.buildTools as unknown[]),
      packageManagers: toTechItems(data.packageManagers as unknown[]),
      testingFrameworks: toTechItems(data.testingFrameworks as unknown[]),
      tools: toTechItems(data.tools as unknown[]),
      summary: (data.summary as string) || "",
    };
  }

  // Get tech stack analysis
  async getTechStackAnalysis(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<TechStackAnalysis | null> {
    const docRef = this.getTechStackAnalysisDoc(userId, projectId, migrationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return this.toTechStackAnalysis(docSnap.data() as Record<string, unknown>);
    }
    return null;
  }

  // Real-time subscription for tech stack analysis
  subscribeTechStackAnalysis(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (analysis: TechStackAnalysis | null) => void,
    onError?: (error: Error) => void
  ): Unsubscribe {
    const docRef = this.getTechStackAnalysisDoc(userId, projectId, migrationId);

    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(this.toTechStackAnalysis(docSnap.data() as Record<string, unknown>));
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error("Error subscribing to tech stack analysis:", error);
        onError?.(error);
      }
    );
  }

  // Config Chat Messages - Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/configChatMessages
  private getConfigChatMessagesCollection(
    userId: string,
    projectId: string,
    migrationId: string
  ) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "configChatMessages"
    );
  }

  async getConfigChatMessages(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<ConfigChatMessage[]> {
    const q = query(
      this.getConfigChatMessagesCollection(userId, projectId, migrationId),
      orderBy("timestamp", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as ConfigChatMessage);
  }

  async addConfigChatMessage(
    userId: string,
    projectId: string,
    migrationId: string,
    message: Omit<ConfigChatMessage, "timestamp">
  ): Promise<string> {
    const docRef = await addDoc(
      this.getConfigChatMessagesCollection(userId, projectId, migrationId),
      {
        ...message,
        timestamp: Date.now(),
      }
    );

    return docRef.id;
  }

  async clearConfigChatMessages(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void> {
    const querySnapshot = await getDocs(
      this.getConfigChatMessagesCollection(userId, projectId, migrationId)
    );

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }
}
