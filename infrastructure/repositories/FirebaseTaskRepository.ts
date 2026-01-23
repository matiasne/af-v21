import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebase/config";
import { Task, TaskColumn } from "@/domain/entities/Task";
import { TaskRepository } from "@/domain/repositories/TaskRepository";
import { StepStatus } from "@/domain/entities/Project";

export class FirebaseTaskRepository implements TaskRepository {
  // Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/tasks
  private getTasksCollection(userId: string, projectId: string, migrationId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "tasks"
    );
  }

  private getTaskDoc(
    userId: string,
    projectId: string,
    migrationId: string,
    taskId: string
  ) {
    return doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "tasks",
      taskId
    );
  }

  private toTask(id: string, data: Record<string, unknown>): Task {
    return {
      id,
      title: (data.title as string) || "",
      description: data.description as string | undefined,
      column: data.column as TaskColumn | undefined,
      phase: (data.phase as StepStatus) || "configuration",
      epicId: data.epicId as string | undefined,
      phaseId: data.phaseId as string | undefined,
      priority: data.priority as "low" | "medium" | "high" | undefined,
      createdAt: (data.createdAt as number) || Date.now(),
      updatedAt: (data.updatedAt as number) || Date.now(),
    };
  }

  async getTasks(userId: string, projectId: string, migrationId: string): Promise<Task[]> {
    const q = query(
      this.getTasksCollection(userId, projectId, migrationId),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toTask(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  async getTasksByPhase(
    userId: string,
    projectId: string,
    migrationId: string,
    phase: StepStatus
  ): Promise<Task[]> {
    const q = query(
      this.getTasksCollection(userId, projectId, migrationId),
      where("phase", "==", phase),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toTask(doc.id, doc.data() as Record<string, unknown>)
    );
  }

  async updateTaskColumn(
    userId: string,
    projectId: string,
    migrationId: string,
    taskId: string,
    column: TaskColumn
  ): Promise<void> {
    const docRef = this.getTaskDoc(userId, projectId, migrationId, taskId);
    await updateDoc(docRef, {
      column,
      updatedAt: Date.now(),
    });
  }

  subscribeTasks(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (tasks: Task[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const q = query(
      this.getTasksCollection(userId, projectId, migrationId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const tasks = querySnapshot.docs.map((doc) =>
          this.toTask(doc.id, doc.data() as Record<string, unknown>)
        );
        onUpdate(tasks);
      },
      (error) => {
        console.error("Error subscribing to tasks:", error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }
}

export const taskRepository = new FirebaseTaskRepository();
