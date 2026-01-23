"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from "react";

import { useProjects } from "@/infrastructure/hooks/useProjects";
import { ConfigChatMessage } from "@/domain/entities/Project";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ProjectContext {
  name: string;
  description?: string;
  status: string;
  githubUrl?: string;
}

// Type for migration config chat functions passed from useMigration
interface MigrationConfigChatFunctions {
  getConfigChatMessages: () => Promise<ConfigChatMessage[]>;
  addConfigChatMessage: (message: Omit<ConfigChatMessage, "timestamp">) => Promise<string | null>;
}

interface ProjectChatContextType {
  // General chat state (for FloatingInput)
  chatHistory: ChatMessage[];
  setChatHistory: (messages: ChatMessage[]) => void;
  isChatLoading: boolean;
  setIsChatLoading: (loading: boolean) => void;

  // Configuration chat state (for ConfigurationChat)
  configChatHistory: ChatMessage[];
  setConfigChatHistory: (messages: ChatMessage[]) => void;
  isConfigChatLoading: boolean;
  setIsConfigChatLoading: (loading: boolean) => void;
  handleConfigChatHistoryChange: (messages: ChatMessage[]) => void;

  // Tech stack state
  currentTechStack: string[];
  setCurrentTechStack: (techStack: string[]) => void;
  suggestions: string[];
  setSuggestions: (suggestions: string[]) => void;
  isTechStackComplete: boolean;
  setIsTechStackComplete: (complete: boolean) => void;

  // Project context
  projectContext: ProjectContext | null;
  setProjectContext: (context: ProjectContext | null) => void;

  // Current project ID
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  // Project owner ID (for shared projects)
  projectOwnerId: string | null;
  setProjectOwnerId: (id: string | null) => void;

  // Configuration mode
  isConfiguration: boolean;
  setIsConfiguration: (config: boolean) => void;

  // Page title and breadcrumbs
  pageTitle: string | null;
  setPageTitle: (title: string | null) => void;
  breadcrumbs: Array<{ label: string; href?: string }>;
  setBreadcrumbs: (breadcrumbs: Array<{ label: string; href?: string }>) => void;
  backUrl: string | null;
  setBackUrl: (url: string | null) => void;

  // Migration config chat functions
  setMigrationConfigChatFunctions: (functions: MigrationConfigChatFunctions | null) => void;

  // Handlers
  handleChatHistoryChange: (messages: ChatMessage[]) => void;
  handleTechStackChange: (
    techStack: string[],
    isComplete: boolean,
    newSuggestions?: string[]
  ) => void;
}

const ProjectChatContext = createContext<ProjectChatContextType | undefined>(
  undefined
);

export function ProjectChatProvider({ children }: { children: ReactNode }) {
  const {
    getGeneralChatMessages,
    addGeneralChatMessage,
  } = useProjects();

  // General chat state (for FloatingInput)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Configuration chat state (for ConfigurationChat)
  const [configChatHistory, setConfigChatHistory] = useState<ChatMessage[]>([]);
  const [isConfigChatLoading, setIsConfigChatLoading] = useState(false);
  const previousConfigMessagesLength = useRef(0);

  // Migration config chat functions (set by tech-stack page when migration is available)
  const [migrationConfigChatFunctions, setMigrationConfigChatFunctions] =
    useState<MigrationConfigChatFunctions | null>(null);

  // Tech stack state
  const [currentTechStack, setCurrentTechStack] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isTechStackComplete, setIsTechStackComplete] = useState(false);

  // Project context
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(
    null
  );
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<string | null>(null);
  const [isConfiguration, setIsConfiguration] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; href?: string }>>([]);
  const [backUrl, setBackUrl] = useState<string | null>(null);

  const previousMessagesLength = useRef(0);

  // Load general chat messages when project changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentProjectId) {
        setChatHistory([]);
        previousMessagesLength.current = 0;
        return;
      }

      // Load general chat messages (for FloatingInput)
      const generalMessages = await getGeneralChatMessages(currentProjectId);
      const formattedGeneralMessages = generalMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setChatHistory(formattedGeneralMessages);
      previousMessagesLength.current = generalMessages.length;
    };

    loadMessages();
  }, [currentProjectId, getGeneralChatMessages]);

  // Load config chat messages when migration functions are set
  useEffect(() => {
    const loadConfigMessages = async () => {
      if (!migrationConfigChatFunctions) {
        setConfigChatHistory([]);
        previousConfigMessagesLength.current = 0;
        return;
      }

      const configMessages = await migrationConfigChatFunctions.getConfigChatMessages();
      const formattedConfigMessages = configMessages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));
      setConfigChatHistory(formattedConfigMessages);
      previousConfigMessagesLength.current = configMessages.length;
    };

    loadConfigMessages();
  }, [migrationConfigChatFunctions]);

  const handleChatHistoryChange = useCallback(
    (messages: ChatMessage[]) => {
      // Update state immediately (synchronously)
      setChatHistory([...messages]);

      // Persist to Firebase asynchronously (general chat messages)
      if (
        currentProjectId &&
        messages.length > previousMessagesLength.current
      ) {
        const newMessages = messages.slice(previousMessagesLength.current);
        previousMessagesLength.current = messages.length;

        // Fire and forget - don't await
        (async () => {
          for (const msg of newMessages) {
            await addGeneralChatMessage(currentProjectId, {
              role: msg.role,
              content: msg.content,
            });
          }
        })();
      }
    },
    [currentProjectId, addGeneralChatMessage]
  );

  const handleConfigChatHistoryChange = useCallback(
    (messages: ChatMessage[]) => {
      // Create a new array reference to ensure React detects the change
      const newMessages = [...messages];

      // Update state immediately (synchronously)
      setConfigChatHistory(newMessages);

      // Persist to Firebase asynchronously (using migration functions)
      if (
        migrationConfigChatFunctions &&
        newMessages.length > previousConfigMessagesLength.current
      ) {
        const messagesToPersist = newMessages.slice(previousConfigMessagesLength.current);
        previousConfigMessagesLength.current = newMessages.length;

        // Fire and forget - don't await
        (async () => {
          for (const msg of messagesToPersist) {
            await migrationConfigChatFunctions.addConfigChatMessage({
              role: msg.role,
              content: msg.content,
            });
          }
        })();
      }
    },
    [migrationConfigChatFunctions]
  );

  const handleTechStackChange = useCallback(
    async (
      techStack: string[],
      isComplete: boolean,
      newSuggestions: string[] = []
    ) => {
      setCurrentTechStack(techStack);
      setIsTechStackComplete(isComplete);
      setSuggestions(newSuggestions);
    },
    []
  );

  return (
    <ProjectChatContext.Provider
      value={{
        chatHistory,
        setChatHistory,
        isChatLoading,
        setIsChatLoading,
        configChatHistory,
        setConfigChatHistory,
        isConfigChatLoading,
        setIsConfigChatLoading,
        handleConfigChatHistoryChange,
        currentTechStack,
        setCurrentTechStack,
        suggestions,
        setSuggestions,
        isTechStackComplete,
        setIsTechStackComplete,
        projectContext,
        setProjectContext,
        currentProjectId,
        setCurrentProjectId,
        projectOwnerId,
        setProjectOwnerId,
        isConfiguration,
        setIsConfiguration,
        pageTitle,
        setPageTitle,
        breadcrumbs,
        setBreadcrumbs,
        backUrl,
        setBackUrl,
        setMigrationConfigChatFunctions,
        handleChatHistoryChange,
        handleTechStackChange,
      }}
    >
      {children}
    </ProjectChatContext.Provider>
  );
}

export function useProjectChat() {
  const context = useContext(ProjectChatContext);
  if (context === undefined) {
    throw new Error("useProjectChat must be used within a ProjectChatProvider");
  }
  return context;
}
