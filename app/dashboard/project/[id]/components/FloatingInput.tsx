"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tooltip } from "@heroui/tooltip";

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

interface MigrationContext {
  currentStep?: string;
  isProcessing?: boolean;
  isCompleted?: boolean;
  techStack?: string[];
  ragStoreName?: string;
}

interface FloatingInputProps {
  projectContext?: ProjectContext;
  projectId?: string;
  userId?: string;
  migrationId?: string;
  chatHistory: ChatMessage[];
  onChatHistoryChange: (messages: ChatMessage[]) => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
  hidePopups?: boolean;
  migrationContext?: MigrationContext;
}

export function FloatingInput({
  projectContext,
  projectId,
  userId,
  migrationId,
  chatHistory,
  onChatHistoryChange,
  isLoading,
  onLoadingChange,
  hidePopups = false,
  migrationContext,
}: FloatingInputProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [showResponse, setShowResponse] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const responseRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when history is shown or messages change
  useEffect(() => {
    if (showHistory && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showHistory, chatHistory, isLoading]);

  // Hide response tooltip when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        responseRef.current &&
        !responseRef.current.contains(event.target as Node)
      ) {
        setShowResponse(false);
      }
    };

    if (showResponse) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showResponse]);

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: message.trim() };
    const newHistory = [...chatHistory, userMessage];

    onChatHistoryChange(newHistory);
    setMessage("");
    onLoadingChange(true);

    // If history is already open, keep it open; otherwise show the response tooltip
    if (!hidePopups && !showHistory) {
      setShowResponse(true);
    }

    try {
      const response = await fetch("/api/chat/project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newHistory,
          userId,
          projectId,
          migrationId,
          projectContext,
          migrationContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = data.message;

      onChatHistoryChange([...newHistory, assistantMessage]);

      // Show chat history after receiving response (only if not already showing)
      if (!hidePopups && !showHistory) {
        setShowHistory(true);
        setShowResponse(false);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      onChatHistoryChange([...newHistory, errorMessage]);
    } finally {
      onLoadingChange(false);
    }
  };

  const lastAssistantMessage = [...chatHistory]
    .reverse()
    .find((msg) => msg.role === "assistant");

  const toggleHistory = () => {
    setShowHistory(!showHistory);
    setShowResponse(false);
  };

  return (
    <>
      {/* Backdrop for Chat History */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          !hidePopups && showHistory
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setShowHistory(false)}
      />

      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Floating Response Tooltip */}
      {!hidePopups &&
        showResponse &&
        (lastAssistantMessage || isLoading) &&
        !showHistory && (
          <div
            ref={responseRef}
            className="absolute bottom-full left-0 right-0 mb-2 px-4"
          >
            <div className="container mx-auto max-w-4xl">
              <div className="bg-content1 border border-default-200 rounded-xl shadow-lg p-4 max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <Spinner size="sm" color="primary" />
                    <span className="text-default-500">Thinking...</span>
                  </div>
                ) : lastAssistantMessage ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <svg
                        className="h-5 w-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-primary">
                        AI Assistant
                      </span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="ml-auto"
                        onPress={() => setShowResponse(false)}
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </Button>
                    </div>
                    <p className="text-default-700 whitespace-pre-wrap">
                      {lastAssistantMessage.content}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

      {/* Chat History Panel */}
      <div
        ref={historyRef}
        className={`absolute bottom-full left-0 right-0 mb-2 px-4 z-50 transition-all duration-300 ${
          !hidePopups && showHistory
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
          <div className="container mx-auto max-w-4xl">
            <div className="bg-content1 border border-default-200 rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-default-200">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-default-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <span className="text-sm font-medium">Chat History</span>
                </div>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setShowHistory(false)}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </Button>
              </div>
              <ScrollShadow className="max-h-80 p-4">
                {chatHistory.length === 0 ? (
                  <p className="text-default-400 text-center py-8">
                    No messages yet. Start a conversation!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl px-4 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-default-100 text-default-700"
                          }`}
                        >
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-1 mb-1">
                              <svg
                                className="h-3 w-3 text-primary"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                                />
                              </svg>
                              <span className="text-xs font-medium text-primary">
                                AI
                              </span>
                            </div>
                          )}
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-default-100 rounded-xl px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Spinner size="sm" color="primary" />
                            <span className="text-sm text-default-500">
                              Thinking...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollShadow>
            </div>
          </div>
        </div>

      {/* Input Bar */}
      <div className="border-t border-default-200 bg-background/80 backdrop-blur-lg p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-2">
            {!hidePopups && (
              <Button
                isIconOnly
                variant={showHistory ? "solid" : "flat"}
                color={showHistory ? "primary" : "default"}
                onPress={toggleHistory}
                isDisabled={chatHistory.length === 0 && !isLoading}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  />
                </svg>
              </Button>
            )}
            {projectId && (
              <>
                <Tooltip content="View task board">
                  <Button
                    isIconOnly
                    variant="flat"
                    onPress={() => router.push(`/dashboard/project/${projectId}/kanban`)}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z"
                      />
                    </svg>
                  </Button>
                </Tooltip>
                <Tooltip content="View FDD documents">
                  <Button
                    isIconOnly
                    variant="flat"
                    onPress={() => router.push(`/dashboard/project/${projectId}/fdd`)}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
                      />
                    </svg>
                  </Button>
                </Tooltip>
              </>
            )}
            <Input
              placeholder="Ask a question or send a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && message.trim() && !isLoading) {
                  handleSend();
                }
              }}
              onFocus={() => {
                if (!hidePopups && lastAssistantMessage && !showHistory) {
                  setShowResponse(true);
                }
              }}
              classNames={{
                inputWrapper: "bg-default-100",
              }}
              isDisabled={isLoading}
            />
            <Button
              color="primary"
              isDisabled={!message.trim() || isLoading}
              isIconOnly
              isLoading={isLoading}
              onPress={handleSend}
            >
              {!isLoading && (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                  />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
