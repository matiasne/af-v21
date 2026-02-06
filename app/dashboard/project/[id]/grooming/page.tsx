"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { ScrollShadow } from "@heroui/scroll-shadow";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import { Tooltip } from "@heroui/tooltip";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";
import {
  ExecutionPlanTask,
  TaskCategory,
  CleanArchitectureArea,
} from "@/domain/entities/ExecutionPlan";
import {
  GroomingSession,
  GroomingSessionMessage,
  SuggestedTask as DomainSuggestedTask,
  SuggestedEpic as DomainSuggestedEpic,
} from "@/domain/entities/GroomingSession";
import { groomingSessionRepository } from "@/infrastructure/repositories/FirebaseGroomingSessionRepository";
import { executionPlanRepository } from "@/infrastructure/repositories/FirebaseExecutionPlanRepository";
import { RAGCorpus, RAGFile } from "@/domain/entities/RAGFile";

// RAG API helper functions
async function ragGetOrCreateCorpus(corpusDisplayName: string): Promise<RAGCorpus | null> {
  try {
    const response = await fetch("/api/rag/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "getOrCreateCorpus", corpusDisplayName }),
    });
    if (!response.ok) {
      console.error("[RAG API] getOrCreateCorpus failed:", await response.text());
      return null;
    }
    const data = await response.json();
    return data.corpus;
  } catch (error) {
    console.error("[RAG API] Error in getOrCreateCorpus:", error);
    return null;
  }
}

async function ragUploadDocument(corpusName: string, displayName: string, content: string): Promise<RAGFile | null> {
  try {
    const response = await fetch("/api/rag/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "uploadDocument", corpusName, displayName, content }),
    });
    if (!response.ok) {
      console.error("[RAG API] uploadDocument failed:", await response.text());
      return null;
    }
    const data = await response.json();
    return data.document;
  } catch (error) {
    console.error("[RAG API] Error in uploadDocument:", error);
    return null;
  }
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedTask {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: "high" | "medium" | "low";
  cleanArchitectureArea: CleanArchitectureArea;
  acceptanceCriteria: string[];
  status: "pending" | "approved" | "rejected";
  epicId?: string;
}

interface SuggestedEpic {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "approved" | "rejected";
  taskIds: string[];
}

interface UploadedDocument {
  name: string;
  content: string;
  type: string;
}

interface ExistingTask {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: "high" | "medium" | "low";
}

const CATEGORY_COLORS: Record<
  TaskCategory,
  "primary" | "secondary" | "success" | "warning" | "danger"
> = {
  backend: "primary",
  frontend: "secondary",
  database: "success",
  integration: "warning",
  api: "danger",
};

const PRIORITY_COLORS: Record<string, "danger" | "warning" | "success"> = {
  high: "danger",
  medium: "warning",
  low: "success",
};

export default function GroomingPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { setProjectContext, setCurrentProjectId, setIsConfiguration, projectOwnerId } =
    useProjectChat();

  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [existingTasks, setExistingTasks] = useState<ExistingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const { migration, loading: migrationLoading } = useMigration(
    projectId,
    projectOwnerId
  );

  const ragStoreName = migration?.ragFunctionalAndBusinessStoreName;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
  const [suggestedEpics, setSuggestedEpics] = useState<SuggestedEpic[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedEpicId, setExpandedEpicId] = useState<string | null>(null);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [approvingEpicId, setApprovingEpicId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>(
    []
  );
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"tasks" | "epics">("tasks");
  const [isTaskSelectorModalOpen, setIsTaskSelectorModalOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  // Session persistence state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string | null>(null);
  const [previousSessions, setPreviousSessions] = useState<GroomingSession[]>(
    []
  );
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] = useState(false);

  // Session management states (pin, rename, delete)
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameSessionTitle, setRenameSessionTitle] = useState("");

  // Resizable Suggestions panel state
  const [suggestionsPanelWidth, setSuggestionsPanelWidth] = useState(400);
  const [isResizingSuggestions, setIsResizingSuggestions] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Find the project
  useEffect(() => {
    if (projects.length > 0 && projectId) {
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      } else {
        router.push("/dashboard");
      }
    }
  }, [projects, projectId, router]);

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

  // Set configuration mode to false
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Subscribe to existing tasks
  useEffect(() => {
    if (!user?.uid || !projectId) {
      setExistingTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);

    const unsubscribe = executionPlanRepository.subscribeTasks(
      user.uid,
      projectId,
      (updatedTasks) => {
        setExistingTasks(
          updatedTasks.map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
          }))
        );
        setTasksLoading(false);
      },
      (error) => {
        console.error("Error subscribing to tasks:", error);
        setTasksLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, projectId]);

  const projectContext = project
    ? {
        name: project.name,
        description: project.description,
        techStack: project.analysis?.newTechStack,
      }
    : undefined;

  // Build task context string for the AI
  const buildTaskContext = (
    task: SuggestedTask | ExistingTask,
    isSuggested: boolean = false
  ) => {
    const suggestedTask = isSuggested ? (task as SuggestedTask) : null;
    const lines = [
      `Task: ${task.title}`,
      `Description: ${task.description || "No description provided"}`,
      `Category: ${task.category}`,
      `Priority: ${task.priority}`,
    ];
    if (suggestedTask?.cleanArchitectureArea) {
      lines.push(`Architecture Layer: ${suggestedTask.cleanArchitectureArea}`);
    }
    if (
      suggestedTask?.acceptanceCriteria &&
      suggestedTask.acceptanceCriteria.length > 0
    ) {
      lines.push(
        `Acceptance Criteria:\n${suggestedTask.acceptanceCriteria.map((c) => `  - ${c}`).join("\n")}`
      );
    }
    return lines.join("\n");
  };

  // Build epic context string for the AI
  const buildEpicContext = (epic: SuggestedEpic) => {
    const epicTasks = suggestedTasks.filter((t) => t.epicId === epic.id);
    const lines = [
      `Epic: ${epic.title}`,
      `Description: ${epic.description}`,
      `Priority: ${epic.priority}`,
    ];
    if (epicTasks.length > 0) {
      lines.push(
        `Related Tasks:\n${epicTasks.map((t) => `  - ${t.title}`).join("\n")}`
      );
    }
    return lines.join("\n");
  };

  // Load previous sessions when page loads
  const loadPreviousSessions = useCallback(async () => {
    if (!user?.uid || !projectId) return;
    setIsLoadingSessions(true);
    try {
      const sessions = await groomingSessionRepository.getSessions(
        user.uid,
        projectId
      );
      setPreviousSessions(sessions);
    } catch (error) {
      console.error("Error loading previous sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [user?.uid, projectId]);

  // Sort sessions: pinned first, then by updatedAt
  const sortedSessions = [...previousSessions].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  // Handle pin/unpin session
  const handlePinSession = async (sessionId: string) => {
    if (!user?.uid || !projectId) return;

    const session = previousSessions.find((s) => s.id === sessionId);
    if (!session) return;

    try {
      await groomingSessionRepository.updateSession(
        user.uid,
        projectId,
        sessionId,
        { pinned: !session.pinned }
      );
      setPreviousSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, pinned: !s.pinned } : s
        )
      );
    } catch (error) {
      console.error("Error pinning session:", error);
    }
  };

  // Handle rename session
  const handleRenameSession = async () => {
    if (!user?.uid || !projectId || !renameSessionId || !renameSessionTitle.trim()) return;

    try {
      await groomingSessionRepository.updateSession(
        user.uid,
        projectId,
        renameSessionId,
        { title: renameSessionTitle.trim() }
      );
      setPreviousSessions((prev) =>
        prev.map((s) =>
          s.id === renameSessionId ? { ...s, title: renameSessionTitle.trim() } : s
        )
      );
      setIsRenameModalOpen(false);
      setRenameSessionId(null);
      setRenameSessionTitle("");
    } catch (error) {
      console.error("Error renaming session:", error);
    }
  };

  // Handle delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!user?.uid || !projectId) return;

    try {
      await groomingSessionRepository.deleteSession(
        user.uid,
        projectId,
        sessionId
      );
      setPreviousSessions((prev) => prev.filter((s) => s.id !== sessionId));

      // If deleted session was current, clear the state
      if (currentSessionId === sessionId) {
        handleStartNewSession();
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  // Open rename modal
  const openRenameModal = (session: GroomingSession) => {
    setRenameSessionId(session.id);
    setRenameSessionTitle(session.title);
    setIsRenameModalOpen(true);
  };

  // Close rename modal
  const closeRenameModal = () => {
    setIsRenameModalOpen(false);
    setRenameSessionId(null);
    setRenameSessionTitle("");
  };

  // Handle resize start
  // Handle resize for Suggestions panel
  const handleSuggestionsResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSuggestions(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSuggestions) return;
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(280, Math.min(600, newWidth));
      setSuggestionsPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSuggestions(false);
    };

    if (isResizingSuggestions) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSuggestions]);

  // Load a specific session
  const loadSession = async (session: GroomingSession) => {
    if (!user?.uid || !projectId) return;
    setIsLoading(true);

    try {
      // Load messages from subcollection
      const sessionMessages = await groomingSessionRepository.getMessages(
        user.uid,
        projectId,
        session.id
      );

      // Convert to ChatMessage format
      const chatMessages: ChatMessage[] = sessionMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // If session has no messages, add the greeting as the first message
      if (chatMessages.length === 0) {
        const greeting: ChatMessage = {
          role: "assistant",
          content: `Hello! I'm here to help you with your grooming session${projectContext?.name ? ` for **${projectContext.name}**` : ""}. Tell me about the features, improvements, or bugs you'd like to work on, and I'll help you break them down into actionable tasks and epics.\n\nYou can also upload documents (requirements, specs, user stories) and I'll extract tasks and epics from them.\n\nWhat would you like to discuss today?`,
        };
        chatMessages.push(greeting);
      }

      // Clear existing state first
      setSuggestedTasks([]);
      setSuggestedEpics([]);
      setExpandedTaskId(null);
      setExpandedEpicId(null);

      // Set the session ID, title and messages
      setCurrentSessionId(session.id);
      setCurrentSessionTitle(session.title);
      setMessages(chatMessages);

      // Load suggested tasks and epics from the session
      if (session.suggestedTasks && session.suggestedTasks.length > 0) {
        setSuggestedTasks(
          session.suggestedTasks.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            category: t.category,
            priority: t.priority,
            cleanArchitectureArea: t.cleanArchitectureArea,
            acceptanceCriteria: t.acceptanceCriteria,
            status: t.status,
            epicId: t.epicId,
          }))
        );
      }

      if (session.suggestedEpics && session.suggestedEpics.length > 0) {
        setSuggestedEpics(
          session.suggestedEpics.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description,
            priority: e.priority,
            status: e.status,
            taskIds: e.taskIds,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new session
  const createSession = async (
    firstMessageContent: string
  ): Promise<string | null> => {
    if (!user?.uid || !projectId) return null;
    try {
      // Create a title from the first message (truncate if too long)
      const title =
        firstMessageContent.length > 50
          ? firstMessageContent.substring(0, 47) + "..."
          : firstMessageContent;

      const sessionId = await groomingSessionRepository.createSession(
        user.uid,
        projectId,
        title
      );
      setCurrentSessionId(sessionId);

      // Refresh the sessions list to include the new session
      await loadPreviousSessions();

      return sessionId;
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }
  };

  // Save a message to the current session
  const saveMessage = async (
    message: Omit<GroomingSessionMessage, "timestamp">,
    sessionId?: string | null
  ) => {
    const targetSessionId = sessionId ?? currentSessionId;
    if (!user?.uid || !projectId || !targetSessionId) return;
    try {
      await groomingSessionRepository.addMessage(
        user.uid,
        projectId,
        targetSessionId,
        message
      );
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Save suggested tasks and epics to the session
  const saveSuggestionsToSession = async (
    tasks: SuggestedTask[],
    epics: SuggestedEpic[],
    sessionId?: string | null
  ) => {
    const targetSessionId = sessionId ?? currentSessionId;
    if (!user?.uid || !projectId || !targetSessionId) return;
    try {
      // Convert to domain format
      const domainTasks: DomainSuggestedTask[] = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        priority: t.priority,
        cleanArchitectureArea: t.cleanArchitectureArea,
        acceptanceCriteria: t.acceptanceCriteria,
        status: t.status,
        epicId: t.epicId,
      }));

      const domainEpics: DomainSuggestedEpic[] = epics.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        priority: e.priority,
        status: e.status,
        taskIds: e.taskIds,
      }));

      await groomingSessionRepository.updateSession(
        user.uid,
        projectId,
        targetSessionId,
        {
          suggestedTasks: domainTasks,
          suggestedEpics: domainEpics,
        }
      );
    } catch (error) {
      console.error("Error saving suggestions:", error);
    }
  };

  // Load sessions when page loads
  useEffect(() => {
    if (user?.uid && projectId) {
      loadPreviousSessions();
    }
  }, [user?.uid, projectId, loadPreviousSessions]);

  // Send a message directly (used for discuss buttons)
  const sendMessageDirectly = async (messageContent: string) => {
    if (isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Create session if this is the first user message
    let sessionId = currentSessionId;
    if (!sessionId && user?.uid && projectId) {
      sessionId = await createSession(messageContent);
    }

    // Save user message to session
    if (sessionId) {
      await saveMessage({ role: "user", content: messageContent }, sessionId);
    }

    try {
      const documentContext =
        uploadedDocuments.length > 0
          ? uploadedDocuments
              .map((d) => `Document "${d.name}":\n${d.content}`)
              .join("\n\n---\n\n")
          : undefined;

      const response = await fetch("/api/chat/grooming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          projectContext,
          existingTasks: suggestedTasks.filter((t) => t.status !== "rejected"),
          existingEpics: suggestedEpics.filter((e) => e.status !== "rejected"),
          documentContext,
          ragStoreName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Add assistant message
      setMessages([...newMessages, data.message]);

      // Save assistant message to session
      if (sessionId) {
        await saveMessage(
          { role: "assistant", content: data.message.content },
          sessionId
        );
      }

      // Update suggested tasks
      let updatedTasks = suggestedTasks;
      if (data.suggestedTasks && data.suggestedTasks.length > 0) {
        setSuggestedTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTasks = data.suggestedTasks
            .filter((t: SuggestedTask) => !existingIds.has(t.id))
            .map((t: Omit<SuggestedTask, "status">) => ({
              ...t,
              status: "pending" as const,
            }));
          updatedTasks = [...prev, ...newTasks];
          return updatedTasks;
        });
      }

      // Update suggested epics
      let updatedEpics = suggestedEpics;
      if (data.suggestedEpics && data.suggestedEpics.length > 0) {
        setSuggestedEpics((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEpics = data.suggestedEpics
            .filter((e: SuggestedEpic) => !existingIds.has(e.id))
            .map((e: Omit<SuggestedEpic, "status">) => ({
              ...e,
              status: "pending" as const,
            }));
          updatedEpics = [...prev, ...newEpics];
          return updatedEpics;
        });
      }

      // Save suggestions to session
      if (sessionId) {
        await saveSuggestionsToSession(updatedTasks, updatedEpics, sessionId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Discuss suggested task - sends message directly
  const handleReferenceTask = (task: SuggestedTask) => {
    const taskContext = buildTaskContext(task, true);
    const messageContent = `I want to discuss this task:\n\n${taskContext}`;
    setIsTaskSelectorModalOpen(false);
    setTaskSearchQuery("");
    sendMessageDirectly(messageContent);
  };

  // Discuss epic - sends message directly
  const handleReferenceEpic = (epic: SuggestedEpic) => {
    const epicContext = buildEpicContext(epic);
    const messageContent = `I want to discuss this epic:\n\n${epicContext}`;
    setIsTaskSelectorModalOpen(false);
    setTaskSearchQuery("");
    sendMessageDirectly(messageContent);
  };

  // Discuss existing task - sends message directly
  const handleReferenceExistingTask = (task: ExistingTask) => {
    const taskContext = buildTaskContext(task, false);
    const messageContent = `I want to discuss this existing project task:\n\n${taskContext}`;
    setIsTaskSelectorModalOpen(false);
    setTaskSearchQuery("");
    sendMessageDirectly(messageContent);
  };

  // Filter tasks and epics based on search query
  const filteredExistingTasks = existingTasks.filter(
    (task) =>
      task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      (task.description &&
        task.description.toLowerCase().includes(taskSearchQuery.toLowerCase()))
  );

  const filteredSuggestedTasks = suggestedTasks
    .filter((t) => t.status !== "rejected")
    .filter(
      (task) =>
        task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(taskSearchQuery.toLowerCase())
    );

  const filteredSuggestedEpics = suggestedEpics
    .filter((e) => e.status !== "rejected")
    .filter(
      (epic) =>
        epic.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
        epic.description.toLowerCase().includes(taskSearchQuery.toLowerCase())
    );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send initial greeting when page loads (only for new sessions, not loaded ones)
  useEffect(() => {
    if (
      project &&
      messages.length === 0 &&
      !currentSessionId &&
      !isLoading &&
      !authLoading &&
      !projectsLoading
    ) {
      const greeting: ChatMessage = {
        role: "assistant",
        content: `Hello! I'm here to help you with your grooming session${projectContext?.name ? ` for **${projectContext.name}**` : ""}. Tell me about the features, improvements, or bugs you'd like to work on, and I'll help you break them down into actionable tasks and epics.\n\nYou can also upload documents (requirements, specs, user stories) and I'll extract tasks and epics from them.\n\nWhat would you like to discuss today?`,
      };
      setMessages([greeting]);
    }
  }, [
    project,
    messages.length,
    projectContext?.name,
    currentSessionId,
    isLoading,
    authLoading,
    projectsLoading,
  ]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingDocument(true);

    for (const file of Array.from(files)) {
      try {
        const content = await readFileContent(file);
        const newDoc: UploadedDocument = {
          name: file.name,
          content,
          type: file.type || getFileType(file.name),
        };

        setUploadedDocuments((prev) => [...prev, newDoc]);

        // Add a message about the uploaded document
        const uploadMessage: ChatMessage = {
          role: "user",
          content: `I've uploaded a document: "${file.name}". Please analyze it and suggest tasks and epics based on its content.`,
        };

        const newMessages = [...messages, uploadMessage];
        setMessages(newMessages);
        setIsLoading(true);

        // Send to API with document content
        const response = await fetch("/api/chat/grooming", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            projectContext,
            existingTasks: suggestedTasks.filter((t) => t.status !== "rejected"),
            existingEpics: suggestedEpics.filter((e) => e.status !== "rejected"),
            documentContent: content,
            documentName: file.name,
            ragStoreName,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to process document");
        }

        const data = await response.json();

        // Add assistant response
        setMessages((prev) => [...prev, data.message]);

        // Update suggested tasks
        if (data.suggestedTasks && data.suggestedTasks.length > 0) {
          setSuggestedTasks((prev) => {
            const existingIds = new Set(prev.map((t) => t.id));
            const newTasks = data.suggestedTasks
              .filter((t: SuggestedTask) => !existingIds.has(t.id))
              .map((t: Omit<SuggestedTask, "status">) => ({
                ...t,
                status: "pending" as const,
              }));
            return [...prev, ...newTasks];
          });
        }

        // Update suggested epics
        if (data.suggestedEpics && data.suggestedEpics.length > 0) {
          setSuggestedEpics((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newEpics = data.suggestedEpics
              .filter((e: SuggestedEpic) => !existingIds.has(e.id))
              .map((e: Omit<SuggestedEpic, "status">) => ({
                ...e,
                status: "pending" as const,
              }));
            return [...prev, ...newEpics];
          });
        }
      } catch (error) {
        console.error("Error processing file:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Sorry, I couldn't process the file "${file.name}". Please make sure it's a valid text document.`,
          },
        ]);
      }
    }

    setIsProcessingDocument(false);
    setIsLoading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  const getFileType = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "md":
        return "text/markdown";
      case "txt":
        return "text/plain";
      case "json":
        return "application/json";
      case "csv":
        return "text/csv";
      default:
        return "text/plain";
    }
  };

  const removeDocument = (name: string) => {
    setUploadedDocuments((prev) => prev.filter((d) => d.name !== name));
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue.trim();
    const userMessage: ChatMessage = { role: "user", content: messageContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    // Create session if this is the first user message
    let sessionId = currentSessionId;
    if (!sessionId && user?.uid && projectId) {
      sessionId = await createSession(messageContent);
    }

    // Save user message to session
    if (sessionId) {
      await saveMessage({ role: "user", content: messageContent }, sessionId);
    }

    try {
      // Include document contents in context if any
      const documentContext =
        uploadedDocuments.length > 0
          ? uploadedDocuments
              .map((d) => `Document "${d.name}":\n${d.content}`)
              .join("\n\n---\n\n")
          : undefined;

      const response = await fetch("/api/chat/grooming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          projectContext,
          existingTasks: suggestedTasks.filter((t) => t.status !== "rejected"),
          existingEpics: suggestedEpics.filter((e) => e.status !== "rejected"),
          documentContext,
          ragStoreName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();

      // Add assistant message
      setMessages([...newMessages, data.message]);

      // Save assistant message to session
      if (sessionId) {
        await saveMessage(
          { role: "assistant", content: data.message.content },
          sessionId
        );
      }

      // Update suggested tasks
      let updatedTasks = suggestedTasks;
      if (data.suggestedTasks && data.suggestedTasks.length > 0) {
        setSuggestedTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTasks = data.suggestedTasks
            .filter((t: SuggestedTask) => !existingIds.has(t.id))
            .map((t: Omit<SuggestedTask, "status">) => ({
              ...t,
              status: "pending" as const,
            }));
          updatedTasks = [...prev, ...newTasks];
          return updatedTasks;
        });
      }

      // Update suggested epics
      let updatedEpics = suggestedEpics;
      if (data.suggestedEpics && data.suggestedEpics.length > 0) {
        setSuggestedEpics((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newEpics = data.suggestedEpics
            .filter((e: SuggestedEpic) => !existingIds.has(e.id))
            .map((e: Omit<SuggestedEpic, "status">) => ({
              ...e,
              status: "pending" as const,
            }));
          updatedEpics = [...prev, ...newEpics];
          return updatedEpics;
        });
      }

      // Save suggestions to session
      if (sessionId) {
        await saveSuggestionsToSession(updatedTasks, updatedEpics, sessionId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle create task (approve task)
  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    category: TaskCategory;
    priority: "high" | "medium" | "low";
    cleanArchitectureArea: CleanArchitectureArea;
    acceptanceCriteria: string[];
  }): Promise<string> => {
    if (!user?.uid || !projectId)
      throw new Error("User or project not available");

    try {
      const taskId = await executionPlanRepository.createTask(
        user.uid,
        projectId,
        taskData
      );

      // Store task in RAG for semantic search
      const ragStoreNameForTasks =
        project?.taskRAGStore || `${projectId}-tasks-rag`;
      try {
        const corpus =
          await ragGetOrCreateCorpus(ragStoreNameForTasks);
        if (corpus) {
          const taskContent = [
            `Task: ${taskData.title}`,
            `Description: ${taskData.description}`,
            `Category: ${taskData.category}`,
            `Priority: ${taskData.priority}`,
            `Architecture Layer: ${taskData.cleanArchitectureArea}`,
            taskData.acceptanceCriteria.length > 0
              ? `Acceptance Criteria:\n${taskData.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          await ragUploadDocument(
            corpus.name,
            `task-${taskId}`,
            taskContent
          );
        }
      } catch (ragError) {
        console.error("Error storing task in RAG:", ragError);
      }

      return taskId;
    } catch (error) {
      console.error("Error creating task:", error);
      throw error;
    }
  };

  // Handle create epic (approve epic with tasks)
  const handleCreateEpic = async (
    epicData: {
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
    },
    taskIds: string[]
  ) => {
    if (!user?.uid || !projectId) return;

    try {
      const epicId = await executionPlanRepository.createEpic(
        user.uid,
        projectId,
        {
          title: epicData.title,
          description: epicData.description,
          priority: epicData.priority,
        }
      );

      if (taskIds.length > 0) {
        await executionPlanRepository.assignTasksToEpic(
          user.uid,
          projectId,
          epicId,
          taskIds
        );
      }
    } catch (error) {
      console.error("Error creating epic:", error);
      throw error;
    }
  };

  const handleApproveTask = async (task: SuggestedTask) => {
    setApprovingTaskId(task.id);
    try {
      await handleCreateTask({
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority,
        cleanArchitectureArea: task.cleanArchitectureArea,
        acceptanceCriteria: task.acceptanceCriteria,
      });
      setSuggestedTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: "approved" } : t))
      );
      setExpandedTaskId(null);
    } catch (error) {
      console.error("Error approving task:", error);
    } finally {
      setApprovingTaskId(null);
    }
  };

  const handleRejectTask = (taskId: string) => {
    setSuggestedTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "rejected" } : t))
    );
    setExpandedTaskId(null);
  };

  const handleApproveEpic = async (epic: SuggestedEpic) => {
    setApprovingEpicId(epic.id);
    try {
      // Get the tasks that belong to this epic and are pending
      const epicTasks = suggestedTasks.filter(
        (t) => t.epicId === epic.id && t.status === "pending"
      );

      // First, create all the tasks that belong to this epic and collect the real Firestore IDs
      const createdTaskIds: string[] = [];
      for (const task of epicTasks) {
        const createdTaskId = await handleCreateTask({
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          cleanArchitectureArea: task.cleanArchitectureArea,
          acceptanceCriteria: task.acceptanceCriteria,
        });
        createdTaskIds.push(createdTaskId);
        // Mark task as approved
        setSuggestedTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "approved" } : t))
        );
      }

      // Create the epic with the actual Firestore task IDs
      await handleCreateEpic(
        {
          title: epic.title,
          description: epic.description,
          priority: epic.priority,
        },
        createdTaskIds
      );

      setSuggestedEpics((prev) =>
        prev.map((e) => (e.id === epic.id ? { ...e, status: "approved" } : e))
      );
      setExpandedEpicId(null);
    } catch (error) {
      console.error("Error approving epic:", error);
    } finally {
      setApprovingEpicId(null);
    }
  };

  const handleRejectEpic = (epicId: string) => {
    setSuggestedEpics((prev) =>
      prev.map((e) => (e.id === epicId ? { ...e, status: "rejected" } : e))
    );
    setExpandedEpicId(null);
  };

  // Start a new session (clear current session and start fresh)
  const handleStartNewSession = () => {
    setSuggestedTasks([]);
    setSuggestedEpics([]);
    setExpandedTaskId(null);
    setExpandedEpicId(null);
    setInputValue("");
    setUploadedDocuments([]);
    setSelectedTab("tasks");
    setCurrentSessionId(null);
    setCurrentSessionTitle(null);

    // Set the initial greeting message for the new session
    const greeting: ChatMessage = {
      role: "assistant",
      content: `Hello! I'm here to help you with your grooming session${projectContext?.name ? ` for **${projectContext.name}**` : ""}. Tell me about the features, improvements, or bugs you'd like to work on, and I'll help you break them down into actionable tasks and epics.\n\nYou can also upload documents (requirements, specs, user stories) and I'll extract tasks and epics from them.\n\nWhat would you like to discuss today?`,
    };
    setMessages([greeting]);
  };

  // Format date for display
  const formatSessionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const pendingTasks = suggestedTasks.filter((t) => t.status === "pending");
  const approvedTasks = suggestedTasks.filter((t) => t.status === "approved");
  const pendingEpics = suggestedEpics.filter((e) => e.status === "pending");
  const approvedEpics = suggestedEpics.filter((e) => e.status === "approved");

  // Get tasks that belong to a specific epic
  const getEpicTasks = (epicId: string) => {
    return suggestedTasks.filter((t) => t.epicId === epicId);
  };

  if (authLoading || projectsLoading || migrationLoading) {
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
    <div className="flex flex-col h-[calc(100vh-48px)]">
      {/* Main content - CSS Grid 3 columns: sidebar | chat | suggestions */}
      <div
        className="flex-1 overflow-hidden px-4 py-3"
        style={{
          display: 'grid',
          gridTemplateColumns: isSessionSidebarCollapsed
            ? `52px 1fr ${suggestionsPanelWidth}px`
            : `280px 1fr ${suggestionsPanelWidth}px`,
          gap: '12px',
          height: '100%',
        }}
      >
        {/* Left sidebar - Session History */}
        <div
          className="flex flex-col border border-default-200 bg-default-50/50 dark:bg-default-100/20 transition-all duration-300 overflow-hidden rounded-xl"
        >
          {/* Toggle Sidebar Button */}
          <div className={`p-3 pb-0 ${isSessionSidebarCollapsed ? "flex justify-center" : ""}`}>
            <Tooltip content={isSessionSidebarCollapsed ? "Open sidebar" : "Close sidebar"} placement="right">
              <Button
                variant="light"
                isIconOnly
                className="h-10 w-10 text-default-700 hover:bg-default-100"
                onPress={() => setIsSessionSidebarCollapsed(!isSessionSidebarCollapsed)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              </Button>
            </Tooltip>
          </div>

          {/* Back to Task Board & New Chat Buttons */}
          <div className={`p-3 space-y-1 ${isSessionSidebarCollapsed ? "flex flex-col items-center" : "mt-2"}`}>
            {!isSessionSidebarCollapsed ? (
              <>
                <Button
                  variant="light"
                  className="w-full justify-start gap-2 h-9 px-3 text-default-600 hover:bg-default-100 rounded-xl"
                  onPress={() => router.push(`/dashboard/project/${projectId}/kanban`)}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="text-sm">Back to Task Board</span>
                </Button>
                <Button
                  variant="light"
                  className="w-full justify-start gap-2 h-9 px-3 text-default-600 hover:bg-default-100 rounded-xl"
                  onPress={handleStartNewSession}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                  </svg>
                  <span className="text-sm">New chat</span>
                </Button>
              </>
            ) : (
              <>
                <Tooltip content="Back to Task Board" placement="right">
                  <Button
                    variant="light"
                    isIconOnly
                    className="w-full h-9 text-default-600 hover:bg-default-100 rounded-xl"
                    onPress={() => router.push(`/dashboard/project/${projectId}/kanban`)}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </Button>
                </Tooltip>
                <Tooltip content="New chat" placement="right">
                  <Button
                    variant="light"
                    isIconOnly
                    className="w-full h-9 text-default-600 hover:bg-default-100 rounded-xl"
                    onPress={handleStartNewSession}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                  </Button>
                </Tooltip>
              </>
            )}
          </div>

          {!isSessionSidebarCollapsed ? (
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {/* Your chats title */}
              <p className="text-xs font-medium text-default-500 uppercase tracking-wider mb-3">
                Your chats
              </p>

              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size="sm" color="primary" />
                </div>
              ) : sortedSessions.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="w-10 h-10 mx-auto text-default-300 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-xs text-default-400">No previous sessions</p>
                  <p className="text-xs text-default-400 mt-1">
                    Start chatting to create one
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {sortedSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={`group relative w-full text-left px-3 py-2 rounded-xl transition-all cursor-pointer ${
                        currentSessionId === session.id
                          ? "bg-default-100 dark:bg-default-200/50"
                          : "hover:bg-default-100 dark:hover:bg-default-200/30"
                      }`}
                    >
                      {/* 3-dot menu */}
                      <div className="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <Dropdown>
                          <DropdownTrigger>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-default-200 dark:hover:bg-default-300/50"
                            >
                              <svg
                                className="w-4 h-4 text-default-500"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Session actions">
                            <DropdownItem
                              key="pin"
                              startContent={
                                <svg
                                  className="w-4 h-4"
                                  fill={session.pinned ? "currentColor" : "none"}
                                  stroke="currentColor"
                                  viewBox="0 0 16 16"
                                >
                                  <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
                                </svg>
                              }
                              onPress={() => handlePinSession(session.id)}
                            >
                              {session.pinned ? "Unpin" : "Pin"}
                            </DropdownItem>
                            <DropdownItem
                              key="rename"
                              startContent={
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              }
                              onPress={() => openRenameModal(session)}
                            >
                              Rename
                            </DropdownItem>
                            <DropdownItem
                              key="delete"
                              className="text-danger"
                              color="danger"
                              startContent={
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              }
                              onPress={() => handleDeleteSession(session.id)}
                            >
                              Delete
                            </DropdownItem>
                          </DropdownMenu>
                        </Dropdown>
                      </div>

                      {/* Session content - ChatGPT style (just title) */}
                      <div className="flex items-center gap-2 pr-6">
                        {session.pinned && (
                          <svg
                            className="w-3.5 h-3.5 text-default-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                          >
                            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
                          </svg>
                        )}
                        <p className="text-sm text-default-700 truncate">
                          {session.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-1 py-2">
              {isLoadingSessions ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" color="primary" />
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedSessions.map((session) => (
                    <Tooltip key={session.id} content={session.title} placement="right">
                      <button
                        onClick={() => loadSession(session)}
                        className={`w-full p-2 rounded-lg transition-all flex items-center justify-center ${
                          currentSessionId === session.id
                            ? "bg-default-100 dark:bg-default-200/50"
                            : "hover:bg-default-100/50 dark:hover:bg-default-200/30"
                        }`}
                      >
                        {session.pinned ? (
                          <svg
                            className="w-4 h-4 text-default-500"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                          >
                            <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-default-500"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                            />
                          </svg>
                        )}
                      </button>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center - Chat area (fills all available space) */}
        <div className="flex flex-col bg-background rounded-xl border border-default-200 overflow-hidden">
          {/* Chat header - same style as Suggestions */}
          <div className="px-4 pt-4 pb-3 border-b border-default-200 bg-default-100/50 dark:bg-default-200/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary-100 dark:bg-secondary-500/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-secondary-600 dark:text-secondary-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-base text-default-700">
                {currentSessionTitle || "Grooming Session"}
              </span>
            </div>
          </div>

          {/* Hidden file input - always present */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.md,.json,.csv,.xml,.html"
            multiple
            className="hidden"
          />

          {/* Check if this is a new chat (only greeting message, no user messages) */}
          {messages.length <= 1 && !messages.some(m => m.role === "user") ? (
            /* New chat welcome screen - centered layout */
            <div className="flex-1 flex flex-col items-center justify-center px-8 overflow-hidden">
              {/* Welcome content */}
              <div className="text-center mb-4">
                {/* Icon */}
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 dark:from-primary-500 dark:to-secondary-500 mb-4">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-semibold text-default-800 mb-2">
                  What are you working on?
                </h2>

                {/* Subtitle */}
                <p className="text-default-500 text-sm max-w-md">
                  Describe features, improvements, or bugs and I&apos;ll help break them into tasks and epics
                  {projectContext?.name && (
                    <span className="block mt-1 text-primary-500 font-medium">
                      for {projectContext.name}
                    </span>
                  )}
                </p>
              </div>

              {/* Centered input */}
              <div className="w-full max-w-xl">
                <div className="border border-default-300 rounded-2xl overflow-hidden focus-within:border-primary-400 focus-within:shadow-lg transition-all bg-white dark:bg-default-50/5">
                  {/* Input row */}
                  <div className="flex items-center px-4 py-3">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Describe a feature or ask about the documents..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isLoading || isProcessingDocument}
                      className="flex-1 bg-transparent outline-none text-sm text-default-700 placeholder:text-default-400"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading || isProcessingDocument}
                      className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl disabled:opacity-40 disabled:hover:bg-primary-500 transition-colors ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </button>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-1 px-3 py-2 border-t border-default-200 bg-default-50/50">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isProcessingDocument}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-default-500 hover:text-default-700 hover:bg-default-100 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attach
                    </button>
                  </div>
                </div>

                {/* Uploaded documents bar */}
                {uploadedDocuments.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-3 p-3 bg-default-50 dark:bg-default-100/30 rounded-lg">
                    <span className="text-xs text-default-500">Documents:</span>
                    {uploadedDocuments.map((doc) => (
                      <Chip
                        key={doc.name}
                        size="sm"
                        variant="flat"
                        onClose={() => removeDocument(doc.name)}
                        classNames={{ base: "h-6", content: "text-xs" }}
                      >
                        {doc.name}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Regular chat view with messages */
            <>
              {/* Messages area - scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-8 py-6 space-y-6">
                  {/* Uploaded documents bar */}
                  {uploadedDocuments.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-4 p-3 bg-default-50 dark:bg-default-100/30 rounded-lg">
                      <span className="text-xs text-default-500">Documents:</span>
                      {uploadedDocuments.map((doc) => (
                        <Chip
                          key={doc.name}
                          size="sm"
                          variant="flat"
                          onClose={() => removeDocument(doc.name)}
                          classNames={{ base: "h-6", content: "text-xs" }}
                        >
                          {doc.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                          msg.role === "user"
                            ? "bg-primary text-white"
                            : "bg-default-100 text-default-800"
                        }`}
                      >
                        <p className="text-base whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {(isLoading || isProcessingDocument) && (
                    <div className="flex justify-start">
                      <div className="bg-default-100 rounded-xl px-4 py-3 flex items-center gap-2">
                        <Spinner size="sm" color="primary" />
                        {isProcessingDocument && (
                          <span className="text-sm text-default-500">
                            Processing document...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input area - Notion style */}
              <div className="px-8 py-3">
                <div className="border border-default-300 rounded-xl overflow-hidden focus-within:border-primary-400 transition-colors">
                  {/* Input row */}
                  <div className="flex items-center px-3 py-2">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Describe a feature or ask about the documents..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isLoading || isProcessingDocument}
                      className="flex-1 bg-transparent outline-none text-sm text-default-700 placeholder:text-default-400"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isLoading || isProcessingDocument}
                      className="p-1.5 text-default-400 hover:text-primary-500 disabled:opacity-40 disabled:hover:text-default-400 transition-colors"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-1 px-2 py-1.5 border-t border-default-200 bg-default-50">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading || isProcessingDocument}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-default-500 hover:text-default-700 hover:bg-default-100 rounded-md transition-colors disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Attach
                    </button>

                    <button
                      onClick={() => setIsTaskSelectorModalOpen(true)}
                      disabled={isLoading || isProcessingDocument || (suggestedTasks.length === 0 && suggestedEpics.length === 0 && existingTasks.length === 0)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-default-500 hover:text-default-700 hover:bg-default-100 rounded-md transition-colors disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      Discuss Task
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right panel - Suggestions (resizable) */}
        <div className="flex flex-col bg-default-50 dark:bg-default-100/30 overflow-hidden relative rounded-xl border border-default-200">
          {/* Resize handle */}
          <div
            onMouseDown={handleSuggestionsResizeStart}
            className={`absolute left-0 top-0 bottom-0 cursor-col-resize transition-all z-10 rounded-l-xl ${
              isResizingSuggestions
                ? "w-1 bg-primary-400"
                : "w-px bg-transparent hover:w-1 hover:bg-primary-400"
            }`}
          />
          {/* Panel header */}
          <div className="px-4 pt-4 pb-3 border-b border-default-200 bg-default-100/50 dark:bg-default-200/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-500/20 rounded-lg">
                <svg
                  className="w-5 h-5 text-primary-600 dark:text-primary-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <span className="font-semibold text-base text-default-700">Suggestions</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-4">
            <Tabs
              selectedKey={selectedTab}
              onSelectionChange={(key) =>
                setSelectedTab(key as "tasks" | "epics")
              }
              size="sm"
              variant="solid"
              classNames={{
                tabList: "w-full",
                tab: "flex-1",
              }}
            >
              <Tab
                key="tasks"
                title={
                  <div className="flex items-center gap-1.5">
                    <span>Tasks</span>
                    {pendingTasks.length > 0 && (
                      <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">
                        {pendingTasks.length}
                      </span>
                    )}
                  </div>
                }
              />
              <Tab
                key="epics"
                title={
                  <div className="flex items-center gap-1.5">
                    <span>Epics</span>
                    {pendingEpics.length > 0 && (
                      <span className="text-xs bg-secondary-100 text-secondary-700 px-1.5 py-0.5 rounded-full">
                        {pendingEpics.length}
                      </span>
                    )}
                  </div>
                }
              />
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {selectedTab === "tasks" ? (
              // Tasks tab
              suggestedTasks.length === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="w-12 h-12 mx-auto text-default-300 mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="text-sm text-default-400">
                    Tasks will appear here as you discuss features
                  </p>
                </div>
              ) : (
                suggestedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isExpanded={expandedTaskId === task.id}
                    onExpand={() => {
                      if (
                        task.status === "pending" &&
                        expandedTaskId !== task.id
                      ) {
                        setExpandedTaskId(task.id);
                      }
                    }}
                    onApprove={() => handleApproveTask(task)}
                    onReject={() => handleRejectTask(task.id)}
                    onReference={() => handleReferenceTask(task)}
                    isApproving={approvingTaskId === task.id}
                    epicName={
                      task.epicId
                        ? suggestedEpics.find((e) => e.id === task.epicId)
                            ?.title
                        : undefined
                    }
                  />
                ))
              )
            ) : // Epics tab
            suggestedEpics.length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 mx-auto text-default-300 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <p className="text-sm text-default-400">
                  Epics will appear here as you discuss features
                </p>
              </div>
            ) : (
              suggestedEpics.map((epic) => (
                <EpicCard
                  key={epic.id}
                  epic={epic}
                  tasks={getEpicTasks(epic.id)}
                  isExpanded={expandedEpicId === epic.id}
                  onExpand={() => {
                    if (
                      epic.status === "pending" &&
                      expandedEpicId !== epic.id
                    ) {
                      setExpandedEpicId(epic.id);
                    }
                  }}
                  onApprove={() => handleApproveEpic(epic)}
                  onReject={() => handleRejectEpic(epic.id)}
                  onReference={() => handleReferenceEpic(epic)}
                  isApproving={approvingEpicId === epic.id}
                />
              ))
            )}
          </div>

          {/* Summary footer */}
          <div className="px-4 py-2 text-xs text-default-400">
            <div className="flex gap-4">
              <span>{pendingTasks.length + approvedTasks.length} tasks</span>
              <span>{pendingEpics.length + approvedEpics.length} epics</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Chat Modal - Gemini style */}
      <Modal
        isOpen={isRenameModalOpen}
        onClose={closeRenameModal}
        size="sm"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 pb-2">
            <span className="text-lg font-semibold">Rename this chat</span>
          </ModalHeader>
          <ModalBody className="py-2">
            <Input
              autoFocus
              value={renameSessionTitle}
              onValueChange={setRenameSessionTitle}
              placeholder="Enter chat name..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSession();
                } else if (e.key === "Escape") {
                  closeRenameModal();
                }
              }}
              classNames={{
                inputWrapper: "bg-default-100",
              }}
            />
          </ModalBody>
          <ModalFooter className="pt-2">
            <Button
              variant="light"
              onPress={closeRenameModal}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleRenameSession}
              isDisabled={!renameSessionTitle.trim()}
            >
              Rename
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Task Selector Modal */}
      <Modal
        isOpen={isTaskSelectorModalOpen}
        onClose={() => {
          setIsTaskSelectorModalOpen(false);
          setTaskSearchQuery("");
        }}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <span className="text-lg font-semibold">
              Select Task or Epic to Discuss
            </span>
            <span className="text-sm text-default-500 font-normal">
              Search and select a task or epic to start a discussion
            </span>
          </ModalHeader>
          <ModalBody className="pb-6">
            {/* Search Input */}
            <Input
              placeholder="Search tasks and epics..."
              value={taskSearchQuery}
              onValueChange={setTaskSearchQuery}
              startContent={
                <svg
                  className="w-4 h-4 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              }
              isClearable
              onClear={() => setTaskSearchQuery("")}
              classNames={{ inputWrapper: "bg-default-100" }}
            />

            <ScrollShadow className="max-h-[400px] mt-4">
              {/* Existing project tasks */}
              {filteredExistingTasks.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-default-500 uppercase tracking-wide mb-2">
                    Project Tasks ({filteredExistingTasks.length})
                  </p>
                  <div className="space-y-2">
                    {filteredExistingTasks.map((task) => (
                      <button
                        key={task.id}
                        className="w-full text-left p-3 rounded-lg border border-default-200 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                        onClick={() => handleReferenceExistingTask(task)}
                      >
                        <p className="text-sm font-medium text-default-800">
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-default-500 mt-1 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
                          <Chip
                            size="sm"
                            color={CATEGORY_COLORS[task.category]}
                            variant="flat"
                            classNames={{
                              base: "h-5",
                              content: "text-xs px-1",
                            }}
                          >
                            {task.category}
                          </Chip>
                          <Chip
                            size="sm"
                            color={PRIORITY_COLORS[task.priority]}
                            variant="dot"
                            classNames={{
                              base: "h-5",
                              content: "text-xs px-1",
                            }}
                          >
                            {task.priority}
                          </Chip>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested tasks from grooming session */}
              {filteredSuggestedTasks.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-default-500 uppercase tracking-wide mb-2">
                    Suggested Tasks ({filteredSuggestedTasks.length})
                  </p>
                  <div className="space-y-2">
                    {filteredSuggestedTasks.map((task) => (
                      <button
                        key={task.id}
                        className="w-full text-left p-3 rounded-lg border border-default-200 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                        onClick={() => handleReferenceTask(task)}
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-medium text-default-800">
                            {task.title}
                          </p>
                          {task.status === "approved" && (
                            <Chip
                              size="sm"
                              color="success"
                              variant="flat"
                              classNames={{
                                base: "h-5 ml-2",
                                content: "text-xs px-1",
                              }}
                            >
                              approved
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-500 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Chip
                            size="sm"
                            color={CATEGORY_COLORS[task.category]}
                            variant="flat"
                            classNames={{
                              base: "h-5",
                              content: "text-xs px-1",
                            }}
                          >
                            {task.category}
                          </Chip>
                          <Chip
                            size="sm"
                            color={PRIORITY_COLORS[task.priority]}
                            variant="dot"
                            classNames={{
                              base: "h-5",
                              content: "text-xs px-1",
                            }}
                          >
                            {task.priority}
                          </Chip>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested epics from grooming session */}
              {filteredSuggestedEpics.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-default-500 uppercase tracking-wide mb-2">
                    Suggested Epics ({filteredSuggestedEpics.length})
                  </p>
                  <div className="space-y-2">
                    {filteredSuggestedEpics.map((epic) => (
                      <button
                        key={epic.id}
                        className="w-full text-left p-3 rounded-lg border border-secondary-200 hover:border-secondary-300 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-all"
                        onClick={() => handleReferenceEpic(epic)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-4 h-4 text-secondary flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                              />
                            </svg>
                            <p className="text-sm font-medium text-default-800">
                              {epic.title}
                            </p>
                          </div>
                          {epic.status === "approved" && (
                            <Chip
                              size="sm"
                              color="success"
                              variant="flat"
                              classNames={{
                                base: "h-5 ml-2",
                                content: "text-xs px-1",
                              }}
                            >
                              approved
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-500 mt-1 line-clamp-2 ml-6">
                          {epic.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 ml-6">
                          <Chip
                            size="sm"
                            color={PRIORITY_COLORS[epic.priority]}
                            variant="dot"
                            classNames={{
                              base: "h-5",
                              content: "text-xs px-1",
                            }}
                          >
                            {epic.priority}
                          </Chip>
                          {epic.taskIds.length > 0 && (
                            <Chip
                              size="sm"
                              variant="flat"
                              classNames={{
                                base: "h-5",
                                content: "text-xs px-1",
                              }}
                            >
                              {epic.taskIds.length} task
                              {epic.taskIds.length !== 1 ? "s" : ""}
                            </Chip>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {filteredExistingTasks.length === 0 &&
                filteredSuggestedTasks.length === 0 &&
                filteredSuggestedEpics.length === 0 && (
                  <div className="text-center py-8">
                    <svg
                      className="w-12 h-12 mx-auto text-default-300 mb-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <p className="text-sm text-default-400">
                      {taskSearchQuery
                        ? `No tasks or epics found matching "${taskSearchQuery}"`
                        : "No tasks or epics available"}
                    </p>
                  </div>
                )}
            </ScrollShadow>
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}

// Task Card Component
function TaskCard({
  task,
  isExpanded,
  onExpand,
  onApprove,
  onReject,
  onReference,
  isApproving,
  epicName,
}: {
  task: SuggestedTask;
  isExpanded: boolean;
  onExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReference: () => void;
  isApproving: boolean;
  epicName?: string;
}) {
  return (
    <div
      className={`rounded-lg border transition-all ${
        task.status === "approved"
          ? "border-success-200 bg-success-50/50 dark:bg-success-900/20"
          : task.status === "rejected"
            ? "border-default-200 bg-default-100 opacity-50"
            : isExpanded
              ? "border-primary-300 bg-white dark:bg-default-100"
              : "border-default-200 bg-white dark:bg-default-100 hover:border-primary-200 cursor-pointer"
      }`}
      onClick={() => {
        if (task.status === "pending" && !isExpanded) {
          onExpand();
        }
      }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-default-800 line-clamp-2">
              {task.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Chip
                size="sm"
                color={CATEGORY_COLORS[task.category]}
                variant="flat"
                classNames={{ base: "h-5", content: "text-xs px-1" }}
              >
                {task.category}
              </Chip>
              <Chip
                size="sm"
                color={PRIORITY_COLORS[task.priority]}
                variant="dot"
                classNames={{ base: "h-5", content: "text-xs px-1" }}
              >
                {task.priority}
              </Chip>
              {epicName && (
                <Chip
                  size="sm"
                  variant="bordered"
                  classNames={{ base: "h-5", content: "text-xs px-1" }}
                >
                  {epicName}
                </Chip>
              )}
            </div>
          </div>
          {task.status === "approved" && (
            <div className="flex-shrink-0 p-1 bg-success-100 rounded-full">
              <svg
                className="w-4 h-4 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {task.status === "rejected" && (
            <div className="flex-shrink-0 p-1 bg-default-200 rounded-full">
              <svg
                className="w-4 h-4 text-default-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {isExpanded && task.status === "pending" && (
        <div className="px-3 pb-3 space-y-3 border-t border-default-100">
          <div className="pt-3">
            <p className="text-xs font-medium text-default-600 mb-1">
              Description
            </p>
            <p className="text-sm text-default-700 whitespace-pre-wrap">
              {task.description}
            </p>
          </div>

          {task.acceptanceCriteria.length > 0 && (
            <div>
              <p className="text-xs font-medium text-default-600 mb-1">
                Acceptance Criteria
              </p>
              <ul className="space-y-1">
                {task.acceptanceCriteria.map((criterion, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-default-700 flex items-start gap-2"
                  >
                    <span className="text-default-400 mt-0.5">-</span>
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-2">
            <Chip
              size="sm"
              variant="flat"
              classNames={{ base: "h-5", content: "text-xs px-1" }}
            >
              {task.cleanArchitectureArea}
            </Chip>
          </div>

          <div className="flex gap-2 pt-2">
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={onReference}
                className="w-full"
                startContent={
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                }
              >
                Discuss
              </Button>
            </div>
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onPress={onReject}
              className="flex-1"
            >
              Reject
            </Button>
            <Button
              size="sm"
              color="success"
              onPress={onApprove}
              isLoading={isApproving}
              className="flex-1"
            >
              Approve
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Epic Card Component
function EpicCard({
  epic,
  tasks,
  isExpanded,
  onExpand,
  onApprove,
  onReject,
  onReference,
  isApproving,
}: {
  epic: SuggestedEpic;
  tasks: SuggestedTask[];
  isExpanded: boolean;
  onExpand: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReference: () => void;
  isApproving: boolean;
}) {
  const pendingTaskCount = tasks.filter((t) => t.status === "pending").length;

  return (
    <div
      className={`rounded-lg border transition-all ${
        epic.status === "approved"
          ? "border-success-200 bg-success-50/50 dark:bg-success-900/20"
          : epic.status === "rejected"
            ? "border-default-200 bg-default-100 opacity-50"
            : isExpanded
              ? "border-secondary-300 bg-white dark:bg-default-100"
              : "border-default-200 bg-white dark:bg-default-100 hover:border-secondary-200 cursor-pointer"
      }`}
      onClick={() => {
        if (epic.status === "pending" && !isExpanded) {
          onExpand();
        }
      }}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-secondary flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-sm font-medium text-default-800 line-clamp-2">
                {epic.title}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Chip
                size="sm"
                color={PRIORITY_COLORS[epic.priority]}
                variant="dot"
                classNames={{ base: "h-5", content: "text-xs px-1" }}
              >
                {epic.priority}
              </Chip>
              {tasks.length > 0 && (
                <Chip
                  size="sm"
                  variant="flat"
                  classNames={{ base: "h-5", content: "text-xs px-1" }}
                >
                  {tasks.length} task{tasks.length !== 1 ? "s" : ""}
                </Chip>
              )}
            </div>
          </div>
          {epic.status === "approved" && (
            <div className="flex-shrink-0 p-1 bg-success-100 rounded-full">
              <svg
                className="w-4 h-4 text-success"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          )}
          {epic.status === "rejected" && (
            <div className="flex-shrink-0 p-1 bg-default-200 rounded-full">
              <svg
                className="w-4 h-4 text-default-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}
        </div>
      </div>

      {isExpanded && epic.status === "pending" && (
        <div className="px-3 pb-3 space-y-3 border-t border-default-100">
          <div className="pt-3">
            <p className="text-xs font-medium text-default-600 mb-1">
              Description
            </p>
            <p className="text-sm text-default-700 whitespace-pre-wrap">
              {epic.description}
            </p>
          </div>

          {tasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-default-600 mb-1">
                Included Tasks ({pendingTaskCount} pending)
              </p>
              <ul className="space-y-1">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="text-sm text-default-700 flex items-start gap-2"
                  >
                    <span
                      className={
                        task.status === "approved"
                          ? "text-success"
                          : "text-default-400"
                      }
                    >
                      {task.status === "approved" ? "✓" : "•"}
                    </span>
                    <span
                      className={
                        task.status === "approved"
                          ? "line-through text-default-400"
                          : ""
                      }
                    >
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <div className="flex-1" onClick={(e) => e.stopPropagation()}>
              <Button
                size="sm"
                color="primary"
                variant="flat"
                onPress={onReference}
                className="w-full"
                startContent={
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                }
              >
                Discuss
              </Button>
            </div>
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onPress={onReject}
              className="flex-1"
            >
              Reject
            </Button>
            <Button
              size="sm"
              color="success"
              onPress={onApprove}
              isLoading={isApproving}
              className="flex-1"
            >
              {pendingTaskCount > 0
                ? `Approve with ${pendingTaskCount} tasks`
                : "Approve"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
