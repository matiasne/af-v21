import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebase/config";

import {
  GroomingSession,
  GroomingSessionMessage,
  SuggestedTask,
  SuggestedEpic,
} from "@/domain/entities/GroomingSession";
import { GroomingSessionRepository } from "@/domain/repositories/GroomingSessionRepository";

export class FirebaseGroomingSessionRepository
  implements GroomingSessionRepository
{
  // Path: users/{userId}/projects/{projectId}/grooming_sessions
  private getSessionsCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "grooming_sessions",
    );
  }

  // Path: users/{userId}/projects/{projectId}/grooming_sessions/{sessionId}/messages
  private getMessagesCollection(
    userId: string,
    projectId: string,
    sessionId: string,
  ) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "grooming_sessions",
      sessionId,
      "messages",
    );
  }

  private toGroomingSession(
    id: string,
    data: Record<string, unknown>,
  ): GroomingSession {
    return {
      id,
      projectId: (data.projectId as string) || "",
      userId: (data.userId as string) || "",
      title: (data.title as string) || "",
      createdAt: (data.createdAt as number) || Date.now(),
      updatedAt: (data.updatedAt as number) || Date.now(),
      status: (data.status as "active" | "completed") || "active",
      suggestedTasks: (data.suggestedTasks as SuggestedTask[]) || [],
      suggestedEpics: (data.suggestedEpics as SuggestedEpic[]) || [],
    };
  }

  private toMessage(data: Record<string, unknown>): GroomingSessionMessage {
    return {
      role: (data.role as "user" | "assistant") || "user",
      content: (data.content as string) || "",
      timestamp: (data.timestamp as number) || Date.now(),
    };
  }

  async createSession(
    userId: string,
    projectId: string,
    title: string,
  ): Promise<string> {
    const colRef = this.getSessionsCollection(userId, projectId);
    const now = Date.now();

    const newSession = {
      projectId,
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      status: "active",
      suggestedTasks: [],
      suggestedEpics: [],
    };

    const docRef = await addDoc(colRef, newSession);

    return docRef.id;
  }

  async getSession(
    userId: string,
    projectId: string,
    sessionId: string,
  ): Promise<GroomingSession | null> {
    const docRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "grooming_sessions",
      sessionId,
    );

    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.toGroomingSession(
      docSnap.id,
      docSnap.data() as Record<string, unknown>,
    );
  }

  async getSessions(
    userId: string,
    projectId: string,
  ): Promise<GroomingSession[]> {
    const q = query(
      this.getSessionsCollection(userId, projectId),
      orderBy("updatedAt", "desc"),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toGroomingSession(doc.id, doc.data() as Record<string, unknown>),
    );
  }

  async updateSession(
    userId: string,
    projectId: string,
    sessionId: string,
    data: Partial<
      Pick<
        GroomingSession,
        "title" | "status" | "pinned" | "suggestedTasks" | "suggestedEpics"
      >
    >,
  ): Promise<void> {
    const docRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "grooming_sessions",
      sessionId,
    );

    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now(),
    });
  }

  async deleteSession(
    userId: string,
    projectId: string,
    sessionId: string,
  ): Promise<void> {
    // Note: This doesn't delete the messages subcollection
    // In production, you might want to use a Cloud Function to handle cascading deletes
    const docRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "grooming_sessions",
      sessionId,
    );

    await deleteDoc(docRef);
  }

  async addMessage(
    userId: string,
    projectId: string,
    sessionId: string,
    message: Omit<GroomingSessionMessage, "timestamp">,
  ): Promise<string> {
    const colRef = this.getMessagesCollection(userId, projectId, sessionId);

    const newMessage = {
      ...message,
      timestamp: Date.now(),
    };

    const docRef = await addDoc(colRef, newMessage);

    // Also update the session's updatedAt timestamp
    await this.updateSession(userId, projectId, sessionId, {});

    return docRef.id;
  }

  async getMessages(
    userId: string,
    projectId: string,
    sessionId: string,
  ): Promise<GroomingSessionMessage[]> {
    const q = query(
      this.getMessagesCollection(userId, projectId, sessionId),
      orderBy("timestamp", "asc"),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) =>
      this.toMessage(doc.data() as Record<string, unknown>),
    );
  }

  subscribeSessions(
    userId: string,
    projectId: string,
    onUpdate: (sessions: GroomingSession[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const q = query(
      this.getSessionsCollection(userId, projectId),
      orderBy("updatedAt", "desc"),
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const sessions = querySnapshot.docs.map((doc) =>
          this.toGroomingSession(doc.id, doc.data() as Record<string, unknown>),
        );

        onUpdate(sessions);
      },
      (error) => {
        console.error("Error subscribing to grooming sessions:", error);
        if (onError) {
          onError(error);
        }
      },
    );

    return unsubscribe;
  }

  async updateSuggestedTasks(
    userId: string,
    projectId: string,
    sessionId: string,
    tasks: SuggestedTask[],
  ): Promise<void> {
    await this.updateSession(userId, projectId, sessionId, {
      suggestedTasks: tasks,
    });
  }

  async updateSuggestedEpics(
    userId: string,
    projectId: string,
    sessionId: string,
    epics: SuggestedEpic[],
  ): Promise<void> {
    await this.updateSession(userId, projectId, sessionId, {
      suggestedEpics: epics,
    });
  }
}

export const groomingSessionRepository =
  new FirebaseGroomingSessionRepository();
