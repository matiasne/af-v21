"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";
import { Tabs, Tab } from "@heroui/tabs";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/dropdown";

import {
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
  epicId?: string; // Reference to a suggested epic
}

interface SuggestedEpic {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "approved" | "rejected";
  taskIds: string[]; // Tasks that belong to this epic
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

interface GroomingSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproveTask: (task: Omit<SuggestedTask, "id" | "status" | "epicId">) => Promise<void>;
  onApproveEpic: (epic: { title: string; description: string; priority: "high" | "medium" | "low" }, taskIds: string[]) => Promise<void>;
  projectContext?: {
    name: string;
    description?: string;
    techStack?: string[];
  };
  existingTasks?: ExistingTask[];
  userId?: string;
  projectId?: string;
  ragStoreName?: string;
}

const CATEGORY_COLORS: Record<TaskCategory, "primary" | "secondary" | "success" | "warning" | "danger"> = {
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

export default function GroomingSessionModal({
  isOpen,
  onClose,
  onApproveTask,
  onApproveEpic,
  projectContext,
  existingTasks = [],
  userId,
  projectId,
  ragStoreName,
}: GroomingSessionModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);
  const [suggestedEpics, setSuggestedEpics] = useState<SuggestedEpic[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [expandedEpicId, setExpandedEpicId] = useState<string | null>(null);
  const [approvingTaskId, setApprovingTaskId] = useState<string | null>(null);
  const [approvingEpicId, setApprovingEpicId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"tasks" | "epics">("tasks");
  const [isTaskSelectorModalOpen, setIsTaskSelectorModalOpen] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");

  // Session persistence state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [previousSessions, setPreviousSessions] = useState<GroomingSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSessionSelectorOpen, setIsSessionSelectorOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build task context string for the AI
  const buildTaskContext = (task: SuggestedTask | ExistingTask, isSuggested: boolean = false) => {
    const suggestedTask = isSuggested ? task as SuggestedTask : null;
    const lines = [
      `Task: ${task.title}`,
      `Description: ${task.description || "No description provided"}`,
      `Category: ${task.category}`,
      `Priority: ${task.priority}`,
    ];
    if (suggestedTask?.cleanArchitectureArea) {
      lines.push(`Architecture Layer: ${suggestedTask.cleanArchitectureArea}`);
    }
    if (suggestedTask?.acceptanceCriteria && suggestedTask.acceptanceCriteria.length > 0) {
      lines.push(`Acceptance Criteria:\n${suggestedTask.acceptanceCriteria.map(c => `  - ${c}`).join("\n")}`);
    }
    return lines.join("\n");
  };

  // Build epic context string for the AI
  const buildEpicContext = (epic: SuggestedEpic) => {
    const epicTasks = suggestedTasks.filter(t => t.epicId === epic.id);
    const lines = [
      `Epic: ${epic.title}`,
      `Description: ${epic.description}`,
      `Priority: ${epic.priority}`,
    ];
    if (epicTasks.length > 0) {
      lines.push(`Related Tasks:\n${epicTasks.map(t => `  - ${t.title}`).join("\n")}`);
    }
    return lines.join("\n");
  };

  // Load previous sessions when modal opens
  const loadPreviousSessions = useCallback(async () => {
    if (!userId || !projectId) return;
    setIsLoadingSessions(true);
    try {
      const sessions = await groomingSessionRepository.getSessions(userId, projectId);
      setPreviousSessions(sessions);
    } catch (error) {
      console.error("Error loading previous sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  }, [userId, projectId]);

  // Load a specific session
  const loadSession = async (session: GroomingSession) => {
    if (!userId || !projectId) return;
    setIsLoading(true);
    setIsSessionSelectorOpen(false);

    try {
      // Load messages from subcollection
      const sessionMessages = await groomingSessionRepository.getMessages(userId, projectId, session.id);

      // Convert to ChatMessage format
      const chatMessages: ChatMessage[] = sessionMessages.map(msg => ({
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

      // Set the session ID and messages
      setCurrentSessionId(session.id);
      setMessages(chatMessages);

      // Load suggested tasks and epics from the session
      if (session.suggestedTasks && session.suggestedTasks.length > 0) {
        setSuggestedTasks(session.suggestedTasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          cleanArchitectureArea: t.cleanArchitectureArea,
          acceptanceCriteria: t.acceptanceCriteria,
          status: t.status,
          epicId: t.epicId,
        })));
      }

      if (session.suggestedEpics && session.suggestedEpics.length > 0) {
        setSuggestedEpics(session.suggestedEpics.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description,
          priority: e.priority,
          status: e.status,
          taskIds: e.taskIds,
        })));
      }
    } catch (error) {
      console.error("Error loading session:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create a new session
  const createSession = async (firstMessageContent: string): Promise<string | null> => {
    if (!userId || !projectId) return null;
    try {
      // Create a title from the first message (truncate if too long)
      const title = firstMessageContent.length > 50
        ? firstMessageContent.substring(0, 47) + "..."
        : firstMessageContent;

      const sessionId = await groomingSessionRepository.createSession(userId, projectId, title);
      setCurrentSessionId(sessionId);
      return sessionId;
    } catch (error) {
      console.error("Error creating session:", error);
      return null;
    }
  };

  // Save a message to the current session
  const saveMessage = async (message: Omit<GroomingSessionMessage, "timestamp">, sessionId?: string | null) => {
    const targetSessionId = sessionId ?? currentSessionId;
    if (!userId || !projectId || !targetSessionId) return;
    try {
      await groomingSessionRepository.addMessage(userId, projectId, targetSessionId, message);
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Save suggested tasks and epics to the session
  const saveSuggestionsToSession = async (tasks: SuggestedTask[], epics: SuggestedEpic[], sessionId?: string | null) => {
    const targetSessionId = sessionId ?? currentSessionId;
    if (!userId || !projectId || !targetSessionId) return;
    try {
      // Convert to domain format
      const domainTasks: DomainSuggestedTask[] = tasks.map(t => ({
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

      const domainEpics: DomainSuggestedEpic[] = epics.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        priority: e.priority,
        status: e.status,
        taskIds: e.taskIds,
      }));

      await groomingSessionRepository.updateSession(userId, projectId, targetSessionId, {
        suggestedTasks: domainTasks,
        suggestedEpics: domainEpics,
      });
    } catch (error) {
      console.error("Error saving suggestions:", error);
    }
  };

  // Load sessions when modal opens
  useEffect(() => {
    if (isOpen && userId && projectId) {
      loadPreviousSessions();
    }
  }, [isOpen, userId, projectId, loadPreviousSessions]);

  // Send a message directly (used for discuss buttons)
  const sendMessageDirectly = async (messageContent: string) => {
    if (isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    // Create session if this is the first user message
    let sessionId = currentSessionId;
    if (!sessionId && userId && projectId) {
      sessionId = await createSession(messageContent);
    }

    // Save user message to session
    if (sessionId) {
      await saveMessage({ role: "user", content: messageContent }, sessionId);
    }

    try {
      const documentContext = uploadedDocuments.length > 0
        ? uploadedDocuments.map((d) => `Document "${d.name}":\n${d.content}`).join("\n\n---\n\n")
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
        await saveMessage({ role: "assistant", content: data.message.content }, sessionId);
      }

      // Update suggested tasks
      let updatedTasks = suggestedTasks;
      if (data.suggestedTasks && data.suggestedTasks.length > 0) {
        setSuggestedTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTasks = data.suggestedTasks
            .filter((t: SuggestedTask) => !existingIds.has(t.id))
            .map((t: Omit<SuggestedTask, "status">) => ({ ...t, status: "pending" as const }));
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
            .map((e: Omit<SuggestedEpic, "status">) => ({ ...e, status: "pending" as const }));
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
  const filteredExistingTasks = existingTasks.filter((task) =>
    task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
    (task.description && task.description.toLowerCase().includes(taskSearchQuery.toLowerCase()))
  );

  const filteredSuggestedTasks = suggestedTasks
    .filter((t) => t.status !== "rejected")
    .filter((task) =>
      task.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(taskSearchQuery.toLowerCase())
    );

  const filteredSuggestedEpics = suggestedEpics
    .filter((e) => e.status !== "rejected")
    .filter((epic) =>
      epic.title.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
      epic.description.toLowerCase().includes(taskSearchQuery.toLowerCase())
    );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send initial greeting when modal opens (only for new sessions, not loaded ones)
  useEffect(() => {
    if (isOpen && messages.length === 0 && !currentSessionId && !isLoading) {
      const greeting: ChatMessage = {
        role: "assistant",
        content: `Hello! I'm here to help you with your grooming session${projectContext?.name ? ` for **${projectContext.name}**` : ""}. Tell me about the features, improvements, or bugs you'd like to work on, and I'll help you break them down into actionable tasks and epics.\n\nYou can also upload documents (requirements, specs, user stories) and I'll extract tasks and epics from them.\n\nWhat would you like to discuss today?`,
      };
      setMessages([greeting]);
    }
  }, [isOpen, messages.length, projectContext?.name, currentSessionId, isLoading]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
              .map((t: Omit<SuggestedTask, "status">) => ({ ...t, status: "pending" as const }));
            return [...prev, ...newTasks];
          });
        }

        // Update suggested epics
        if (data.suggestedEpics && data.suggestedEpics.length > 0) {
          setSuggestedEpics((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const newEpics = data.suggestedEpics
              .filter((e: SuggestedEpic) => !existingIds.has(e.id))
              .map((e: Omit<SuggestedEpic, "status">) => ({ ...e, status: "pending" as const }));
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
    if (!sessionId && userId && projectId) {
      sessionId = await createSession(messageContent);
    }

    // Save user message to session
    if (sessionId) {
      await saveMessage({ role: "user", content: messageContent }, sessionId);
    }

    try {
      // Include document contents in context if any
      const documentContext = uploadedDocuments.length > 0
        ? uploadedDocuments.map((d) => `Document "${d.name}":\n${d.content}`).join("\n\n---\n\n")
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
        await saveMessage({ role: "assistant", content: data.message.content }, sessionId);
      }

      // Update suggested tasks
      let updatedTasks = suggestedTasks;
      if (data.suggestedTasks && data.suggestedTasks.length > 0) {
        setSuggestedTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newTasks = data.suggestedTasks
            .filter((t: SuggestedTask) => !existingIds.has(t.id))
            .map((t: Omit<SuggestedTask, "status">) => ({ ...t, status: "pending" as const }));
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
            .map((e: Omit<SuggestedEpic, "status">) => ({ ...e, status: "pending" as const }));
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

  const handleApproveTask = async (task: SuggestedTask) => {
    setApprovingTaskId(task.id);
    try {
      await onApproveTask({
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
      // Get the task IDs that belong to this epic and are pending
      const epicTaskIds = suggestedTasks
        .filter((t) => t.epicId === epic.id && t.status === "pending")
        .map((t) => t.id);

      // First, create all the tasks that belong to this epic
      const createdTaskIds: string[] = [];
      for (const taskId of epicTaskIds) {
        const task = suggestedTasks.find((t) => t.id === taskId);
        if (task) {
          await onApproveTask({
            title: task.title,
            description: task.description,
            category: task.category,
            priority: task.priority,
            cleanArchitectureArea: task.cleanArchitectureArea,
            acceptanceCriteria: task.acceptanceCriteria,
          });
          createdTaskIds.push(taskId);
          // Mark task as approved
          setSuggestedTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: "approved" } : t))
          );
        }
      }

      // Create the epic with the task IDs
      await onApproveEpic(
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

  const handleClose = () => {
    if (!isLoading && !isProcessingDocument) {
      setMessages([]);
      setSuggestedTasks([]);
      setSuggestedEpics([]);
      setExpandedTaskId(null);
      setExpandedEpicId(null);
      setInputValue("");
      setUploadedDocuments([]);
      setSelectedTab("tasks");
      setCurrentSessionId(null);
      setIsSessionSelectorOpen(false);
      onClose();
    }
  };

  // Start a new session (clear current session and start fresh)
  const handleStartNewSession = () => {
    setMessages([]);
    setSuggestedTasks([]);
    setSuggestedEpics([]);
    setExpandedTaskId(null);
    setExpandedEpicId(null);
    setInputValue("");
    setUploadedDocuments([]);
    setSelectedTab("tasks");
    setCurrentSessionId(null);
    setIsSessionSelectorOpen(false);
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
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="5xl"
      isDismissable={!isLoading && !isProcessingDocument}
      hideCloseButton={isLoading || isProcessingDocument}
      scrollBehavior="inside"
    >
      <ModalContent className="h-[80vh]">
        <ModalHeader className="flex flex-col gap-1 border-b border-default-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-primary"
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
              <span className="text-lg font-semibold">Grooming Session</span>
              {currentSessionId && (
                <Chip size="sm" variant="flat" color="primary" classNames={{ base: "h-5", content: "text-xs" }}>
                  Session saved
                </Chip>
              )}
            </div>
            {userId && projectId && (
              <div className="flex items-center gap-2">
                <Dropdown isOpen={isSessionSelectorOpen} onOpenChange={setIsSessionSelectorOpen}>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant="flat"
                      isLoading={isLoadingSessions}
                      startContent={
                        !isLoadingSessions && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )
                      }
                    >
                      {previousSessions.length > 0 ? `${previousSessions.length} Previous` : "History"}
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Session history"
                    className="max-h-[300px] overflow-y-auto"
                    emptyContent="No previous sessions"
                  >
                    {previousSessions.length > 0 ? (
                      <>
                        <DropdownItem
                          key="new-session"
                          className="text-primary"
                          startContent={
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          }
                          onPress={handleStartNewSession}
                        >
                          Start New Session
                        </DropdownItem>
                        {previousSessions.map((session) => (
                          <DropdownItem
                            key={session.id}
                            description={formatSessionDate(session.updatedAt)}
                            onPress={() => loadSession(session)}
                            className={currentSessionId === session.id ? "bg-primary-100" : ""}
                          >
                            <span className="line-clamp-1">{session.title}</span>
                          </DropdownItem>
                        ))}
                      </>
                    ) : (
                      <DropdownItem key="empty" isReadOnly>
                        No previous sessions
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </Dropdown>
              </div>
            )}
          </div>
          <span className="text-sm text-default-500 font-normal">
            Discuss features, upload documents, and get task & epic suggestions from AI
          </span>
        </ModalHeader>

        <ModalBody className="p-0 flex flex-row gap-0 overflow-hidden">
          {/* Left side - Chat */}
          <div className="flex-1 flex flex-col border-r border-default-200 min-w-0">
            {/* Uploaded documents bar */}
            {uploadedDocuments.length > 0 && (
              <div className="px-4 py-2 border-b border-default-200 bg-default-50 dark:bg-default-100/30">
                <div className="flex items-center gap-2 flex-wrap">
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
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-primary text-white"
                        : "bg-default-100 text-default-800"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {(isLoading || isProcessingDocument) && (
                <div className="flex justify-start">
                  <div className="bg-default-100 rounded-xl px-4 py-3 flex items-center gap-2">
                    <Spinner size="sm" color="primary" />
                    {isProcessingDocument && (
                      <span className="text-sm text-default-500">Processing document...</span>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 border-t border-default-200">
              <div className="flex gap-2">
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.json,.csv,.xml,.html"
                  multiple
                  className="hidden"
                />

                {/* Upload button */}
                <Button
                  isIconOnly
                  variant="flat"
                  onPress={() => fileInputRef.current?.click()}
                  isDisabled={isLoading || isProcessingDocument}
                  title="Upload document"
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
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                </Button>

                {/* Discuss task/epic button - opens modal */}
                <Button
                  isIconOnly
                  variant="flat"
                  isDisabled={isLoading || isProcessingDocument || (suggestedTasks.length === 0 && suggestedEpics.length === 0 && existingTasks.length === 0)}
                  title="Discuss a task or epic"
                  onPress={() => setIsTaskSelectorModalOpen(true)}
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
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </Button>

                <Input
                  ref={inputRef}
                  placeholder="Describe a feature or ask about the documents..."
                  value={inputValue}
                  onValueChange={setInputValue}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  isDisabled={isLoading || isProcessingDocument}
                  classNames={{
                    inputWrapper: "bg-default-100",
                  }}
                />
                <Button
                  color="primary"
                  isIconOnly
                  onPress={handleSendMessage}
                  isDisabled={!inputValue.trim() || isLoading || isProcessingDocument}
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
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </Button>
              </div>
              <p className="text-xs text-default-400 mt-2">
                Supports .txt, .md, .json, .csv, .xml, .html files
              </p>
            </div>
          </div>

          {/* Right side - Suggested Tasks & Epics */}
          <div className="w-[380px] flex flex-col bg-default-50 dark:bg-default-100/30">
            <div className="p-3 border-b border-default-200">
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => setSelectedTab(key as "tasks" | "epics")}
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
                        if (task.status === "pending" && expandedTaskId !== task.id) {
                          setExpandedTaskId(task.id);
                        }
                      }}
                      onApprove={() => handleApproveTask(task)}
                      onReject={() => handleRejectTask(task.id)}
                      onReference={() => handleReferenceTask(task)}
                      isApproving={approvingTaskId === task.id}
                      epicName={task.epicId ? suggestedEpics.find((e) => e.id === task.epicId)?.title : undefined}
                    />
                  ))
                )
              ) : (
                // Epics tab
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
                        if (epic.status === "pending" && expandedEpicId !== epic.id) {
                          setExpandedEpicId(epic.id);
                        }
                      }}
                      onApprove={() => handleApproveEpic(epic)}
                      onReject={() => handleRejectEpic(epic.id)}
                      onReference={() => handleReferenceEpic(epic)}
                      isApproving={approvingEpicId === epic.id}
                    />
                  ))
                )
              )}
            </div>

            {/* Summary footer */}
            <div className="p-3 border-t border-default-200 text-xs text-default-500">
              <div className="flex justify-between">
                <span>Tasks: {pendingTasks.length} pending, {approvedTasks.length} approved</span>
                <span>Epics: {pendingEpics.length} pending, {approvedEpics.length} approved</span>
              </div>
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="border-t border-default-200">
          <Button variant="flat" onPress={handleClose} isDisabled={isLoading || isProcessingDocument}>
            Close Session
          </Button>
        </ModalFooter>
      </ModalContent>

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
            <span className="text-lg font-semibold">Select Task or Epic to Discuss</span>
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
                        <p className="text-sm font-medium text-default-800">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-default-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2">
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
                          <p className="text-sm font-medium text-default-800">{task.title}</p>
                          {task.status === "approved" && (
                            <Chip
                              size="sm"
                              color="success"
                              variant="flat"
                              classNames={{ base: "h-5 ml-2", content: "text-xs px-1" }}
                            >
                              approved
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-500 mt-1 line-clamp-2">{task.description}</p>
                        <div className="flex items-center gap-1.5 mt-2">
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
                            <svg className="w-4 h-4 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <p className="text-sm font-medium text-default-800">{epic.title}</p>
                          </div>
                          {epic.status === "approved" && (
                            <Chip
                              size="sm"
                              color="success"
                              variant="flat"
                              classNames={{ base: "h-5 ml-2", content: "text-xs px-1" }}
                            >
                              approved
                            </Chip>
                          )}
                        </div>
                        <p className="text-xs text-default-500 mt-1 line-clamp-2 ml-6">{epic.description}</p>
                        <div className="flex items-center gap-1.5 mt-2 ml-6">
                          <Chip
                            size="sm"
                            color={PRIORITY_COLORS[epic.priority]}
                            variant="dot"
                            classNames={{ base: "h-5", content: "text-xs px-1" }}
                          >
                            {epic.priority}
                          </Chip>
                          {epic.taskIds.length > 0 && (
                            <Chip
                              size="sm"
                              variant="flat"
                              classNames={{ base: "h-5", content: "text-xs px-1" }}
                            >
                              {epic.taskIds.length} task{epic.taskIds.length !== 1 ? "s" : ""}
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
    </Modal>
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
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {task.status === "rejected" && (
            <div className="flex-shrink-0 p-1 bg-default-200 rounded-full">
              <svg className="w-4 h-4 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {isExpanded && task.status === "pending" && (
        <div className="px-3 pb-3 space-y-3 border-t border-default-100">
          <div className="pt-3">
            <p className="text-xs font-medium text-default-600 mb-1">Description</p>
            <p className="text-sm text-default-700 whitespace-pre-wrap">{task.description}</p>
          </div>

          {task.acceptanceCriteria.length > 0 && (
            <div>
              <p className="text-xs font-medium text-default-600 mb-1">Acceptance Criteria</p>
              <ul className="space-y-1">
                {task.acceptanceCriteria.map((criterion, idx) => (
                  <li key={idx} className="text-sm text-default-700 flex items-start gap-2">
                    <span className="text-default-400 mt-0.5">-</span>
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-2">
            <Chip size="sm" variant="flat" classNames={{ base: "h-5", content: "text-xs px-1" }}>
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
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
              >
                Discuss
              </Button>
            </div>
            <Button size="sm" color="danger" variant="flat" onPress={onReject} className="flex-1">
              Reject
            </Button>
            <Button size="sm" color="success" onPress={onApprove} isLoading={isApproving} className="flex-1">
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
              <svg className="w-4 h-4 text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm font-medium text-default-800 line-clamp-2">{epic.title}</p>
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
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {epic.status === "rejected" && (
            <div className="flex-shrink-0 p-1 bg-default-200 rounded-full">
              <svg className="w-4 h-4 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {isExpanded && epic.status === "pending" && (
        <div className="px-3 pb-3 space-y-3 border-t border-default-100">
          <div className="pt-3">
            <p className="text-xs font-medium text-default-600 mb-1">Description</p>
            <p className="text-sm text-default-700 whitespace-pre-wrap">{epic.description}</p>
          </div>

          {tasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-default-600 mb-1">
                Included Tasks ({pendingTaskCount} pending)
              </p>
              <ul className="space-y-1">
                {tasks.map((task) => (
                  <li key={task.id} className="text-sm text-default-700 flex items-start gap-2">
                    <span className={task.status === "approved" ? "text-success" : "text-default-400"}>
                      {task.status === "approved" ? "✓" : "•"}
                    </span>
                    <span className={task.status === "approved" ? "line-through text-default-400" : ""}>
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
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                }
              >
                Discuss
              </Button>
            </div>
            <Button size="sm" color="danger" variant="flat" onPress={onReject} className="flex-1">
              Reject
            </Button>
            <Button size="sm" color="success" onPress={onApprove} isLoading={isApproving} className="flex-1">
              {pendingTaskCount > 0 ? `Approve with ${pendingTaskCount} tasks` : "Approve"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
