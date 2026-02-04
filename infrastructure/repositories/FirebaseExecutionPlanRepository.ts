import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  doc,
  updateDoc,
  writeBatch,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

import { db } from "../firebase/config";
import {
  Epic,
  Phase,
  ExecutionPlanTask,
  TaskStatus,
  TaskCategory,
  CleanArchitectureArea,
} from "@/domain/entities/ExecutionPlan";
import { ExecutionPlanRepository } from "@/domain/repositories/ExecutionPlanRepository";

export class FirebaseExecutionPlanRepository implements ExecutionPlanRepository {
  // Path: users/{userId}/projects/{projectId}/execution_plan/document/epics
  private getEpicsCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "execution_plan",
      "document",
      "epics"
    );
  }

  // Path: users/{userId}/projects/{projectId}/execution_plan/document/phases
  private getPhasesCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "execution_plan",
      "document",
      "phases"
    );
  }

  // Path: users/{userId}/projects/{projectId}/execution_plan (tasks directly in collection)
  private getTasksCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "execution_plan"
    );
  }

  private toEpic(id: string, data: Record<string, unknown>): Epic {
    return {
      id: (data.id as string) || id,
      title: (data.title as string) || "",
      description: (data.description as string) || "",
      number: (data.number as number) || 0,
      priority: (data.priority as "high" | "medium" | "low") || "medium",
      relatedRequirements: (data.relatedRequirements as string[]) || [],
    };
  }

  private toPhase(id: string, data: Record<string, unknown>): Phase {
    return {
      id: (data.id as string) || id,
      title: (data.title as string) || "",
      description: (data.description as string) || "",
      number: (data.number as number) || 0,
    };
  }

  private toExecutionPlanTask(id: string, data: Record<string, unknown>): ExecutionPlanTask {
    return {
      id: (data.id as string) || id,
      title: (data.title as string) || "",
      description: (data.description as string) || "",
      acceptanceCriteria: (data.acceptanceCriteria as string[]) || [],
      category: (data.category as TaskCategory) || "other",
      cleanArchitectureArea: (data.cleanArchitectureArea as CleanArchitectureArea) || "domain",
      dependencies: (data.dependencies as string[]) || [],
      sourceDocument: (data.sourceDocument as string) || "",
      status: (data.status as TaskStatus) || "backlog",
      completionSummary: (data.completionSummary as string) || (data.completion_summary as string) || undefined,
      error: (data.error as string) || undefined,
      createdAt: (data.createdAt as number) || Date.now(),
      updatedAt: (data.updatedAt as number) || Date.now(),
      priority: (data.priority as "high" | "medium" | "low") || "medium",
      epicId: (data.epicId as string) || (data.epic_id as string) || "",
      phaseId: (data.phaseId as string) || (data.phase_id as string) || "",
      effortEstimate: (data.effortEstimate as string) || (data.effort_estimate as string) || "",
      deliverables: (data.deliverables as string[]) || [],
      skillsRequired: (data.skillsRequired as string[]) || (data.skills_required as string[]) || [],
      relatedRequirements: (data.relatedRequirements as string[]) || (data.related_requirements as string[]) || [],
      order: (data.order as number) ?? undefined,
    };
  }

  async getEpics(
    userId: string,
    projectId: string
  ): Promise<Epic[]> {
    const q = query(this.getEpicsCollection(userId, projectId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toEpic(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  async getPhases(
    userId: string,
    projectId: string
  ): Promise<Phase[]> {
    const q = query(
      this.getPhasesCollection(userId, projectId),
      orderBy("number", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toPhase(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  async getTasks(
    userId: string,
    projectId: string
  ): Promise<ExecutionPlanTask[]> {
    const q = query(this.getTasksCollection(userId, projectId));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toExecutionPlanTask(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  subscribeEpics(
    userId: string,
    projectId: string,
    onUpdate: (epics: Epic[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(this.getEpicsCollection(userId, projectId));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const epics = querySnapshot.docs.map((doc) =>
          this.toEpic(doc.id, doc.data() as Record<string, unknown>)
        );
        onUpdate(epics);
      },
      (error) => {
        console.error("Error subscribing to epics:", error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }

  subscribePhases(
    userId: string,
    projectId: string,
    onUpdate: (phases: Phase[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(
      this.getPhasesCollection(userId, projectId),
      orderBy("number", "asc")
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const phases = querySnapshot.docs.map((doc) =>
          this.toPhase(doc.id, doc.data() as Record<string, unknown>)
        );
        onUpdate(phases);
      },
      (error) => {
        console.error("Error subscribing to phases:", error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }

  subscribeTasks(
    userId: string,
    projectId: string,
    onUpdate: (tasks: ExecutionPlanTask[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(this.getTasksCollection(userId, projectId));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const tasks = querySnapshot.docs.map((doc) =>
          this.toExecutionPlanTask(doc.id, doc.data() as Record<string, unknown>)
        );
        onUpdate(tasks);
      },
      (error) => {
        console.error("Error subscribing to execution plan tasks:", error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }

  async updateTaskStatus(
    userId: string,
    projectId: string,
    taskId: string,
    status: TaskStatus
  ): Promise<void> {
    const taskRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "execution_plan",
      taskId
    );

    await updateDoc(taskRef, {
      status,
      updatedAt: Date.now(),
    });
  }

  async updateMultipleTasksStatus(
    userId: string,
    projectId: string,
    taskIds: string[],
    status: TaskStatus
  ): Promise<void> {
    const batch = writeBatch(db);
    const updatedAt = Date.now();

    taskIds.forEach((taskId) => {
      const taskRef = doc(
        db,
        "users",
        userId,
        "projects",
        projectId,
        "execution_plan",
        taskId
      );
      batch.update(taskRef, { status, updatedAt });
    });

    await batch.commit();
  }

  async createTask(
    userId: string,
    projectId: string,
    taskData: {
      title: string;
      description: string;
      category: TaskCategory;
      priority: "high" | "medium" | "low";
      cleanArchitectureArea: CleanArchitectureArea;
      acceptanceCriteria?: string[];
    }
  ): Promise<string> {
    const colRef = this.getTasksCollection(userId, projectId);
    const now = Date.now();

    const newTask = {
      title: taskData.title,
      description: taskData.description,
      category: taskData.category,
      priority: taskData.priority,
      cleanArchitectureArea: taskData.cleanArchitectureArea,
      status: "backlog" as TaskStatus,
      acceptanceCriteria: taskData.acceptanceCriteria || [],
      dependencies: [],
      sourceDocument: "user-created",
      createdAt: now,
      updatedAt: now,
      epicId: "",
      phaseId: "",
      effortEstimate: "",
      deliverables: [],
      skillsRequired: [],
      relatedRequirements: [],
    };

    const docRef = await addDoc(colRef, newTask);
    return docRef.id;
  }

  async createEpic(
    userId: string,
    projectId: string,
    epicData: {
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
    }
  ): Promise<string> {
    const colRef = this.getEpicsCollection(userId, projectId);

    // Get current epics to determine the next number
    const existingEpics = await this.getEpics(userId, projectId);
    const maxNumber = existingEpics.reduce((max, epic) => Math.max(max, epic.number), 0);

    const newEpic = {
      title: epicData.title,
      description: epicData.description,
      priority: epicData.priority,
      number: maxNumber + 1,
      relatedRequirements: [],
    };

    const docRef = await addDoc(colRef, newEpic);
    return docRef.id;
  }

  async assignTasksToEpic(
    userId: string,
    projectId: string,
    epicId: string,
    taskIds: string[]
  ): Promise<void> {
    if (taskIds.length === 0) return;

    const batch = writeBatch(db);
    const updatedAt = Date.now();

    taskIds.forEach((taskId) => {
      const taskRef = doc(
        db,
        "users",
        userId,
        "projects",
        projectId,
        "execution_plan",
        taskId
      );
      batch.update(taskRef, { epicId, updatedAt });
    });

    await batch.commit();
  }

  async updateTasksOrder(
    userId: string,
    projectId: string,
    taskOrders: { taskId: string; order: number }[]
  ): Promise<void> {
    if (taskOrders.length === 0) return;

    const batch = writeBatch(db);
    const updatedAt = Date.now();

    taskOrders.forEach(({ taskId, order }) => {
      const taskRef = doc(
        db,
        "users",
        userId,
        "projects",
        projectId,
        "execution_plan",
        taskId
      );
      batch.update(taskRef, { order, updatedAt });
    });

    await batch.commit();
  }

  async deleteTask(
    userId: string,
    projectId: string,
    taskId: string
  ): Promise<void> {
    const taskRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "execution_plan",
      taskId
    );

    await deleteDoc(taskRef);
  }

  async deleteEpic(
    userId: string,
    projectId: string,
    epicId: string,
    deleteTasksToo: boolean = false
  ): Promise<void> {
    // First, get all tasks that belong to this epic
    const tasks = await this.getTasks(userId, projectId);
    const epicTasks = tasks.filter((task) => task.epicId === epicId);

    if (epicTasks.length > 0) {
      const batch = writeBatch(db);
      const updatedAt = Date.now();

      epicTasks.forEach((task) => {
        const taskRef = doc(
          db,
          "users",
          userId,
          "projects",
          projectId,
          "execution_plan",
          task.id
        );
        if (deleteTasksToo) {
          // Delete the task
          batch.delete(taskRef);
        } else {
          // Unassign from epic
          batch.update(taskRef, { epicId: "", updatedAt });
        }
      });

      await batch.commit();
    }

    // Then delete the epic
    const epicRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "execution_plan",
      "document",
      "epics",
      epicId
    );

    await deleteDoc(epicRef);
  }
}

export const executionPlanRepository = new FirebaseExecutionPlanRepository();
