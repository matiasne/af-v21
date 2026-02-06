import {
  GroomingSession,
  GroomingSessionMessage,
  SuggestedTask,
  SuggestedEpic,
} from "../entities/GroomingSession";

export interface GroomingSessionRepository {
  // Session CRUD
  createSession(
    userId: string,
    projectId: string,
    title: string
  ): Promise<string>;

  getSession(
    userId: string,
    projectId: string,
    sessionId: string
  ): Promise<GroomingSession | null>;

  getSessions(
    userId: string,
    projectId: string
  ): Promise<GroomingSession[]>;

  updateSession(
    userId: string,
    projectId: string,
    sessionId: string,
    data: Partial<Pick<GroomingSession, "title" | "status" | "suggestedTasks" | "suggestedEpics">>
  ): Promise<void>;

  deleteSession(
    userId: string,
    projectId: string,
    sessionId: string
  ): Promise<void>;

  // Messages subcollection
  addMessage(
    userId: string,
    projectId: string,
    sessionId: string,
    message: Omit<GroomingSessionMessage, "timestamp">
  ): Promise<string>;

  getMessages(
    userId: string,
    projectId: string,
    sessionId: string
  ): Promise<GroomingSessionMessage[]>;

  // Subscribe to sessions
  subscribeSessions(
    userId: string,
    projectId: string,
    onUpdate: (sessions: GroomingSession[]) => void,
    onError?: (error: Error) => void
  ): () => void;

  // Update suggested items
  updateSuggestedTasks(
    userId: string,
    projectId: string,
    sessionId: string,
    tasks: SuggestedTask[]
  ): Promise<void>;

  updateSuggestedEpics(
    userId: string,
    projectId: string,
    sessionId: string,
    epics: SuggestedEpic[]
  ): Promise<void>;
}
