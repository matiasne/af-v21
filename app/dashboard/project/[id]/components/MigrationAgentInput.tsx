"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

interface MigrationAgentInputProps {
  projectId: string;
  migrationId: string | undefined;
  disabled?: boolean;
}

export function MigrationAgentInput({
  projectId,
  migrationId,
  disabled = false,
}: MigrationAgentInputProps) {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hide history when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        historyRef.current &&
        !historyRef.current.contains(event.target as Node)
      ) {
        setShowHistory(false);
      }
    };

    if (showHistory) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showHistory]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current && showHistory) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, showHistory]);

  const handleSend = async () => {
    if (!message.trim() || isLoading || !migrationId) return;

    const userMessage: AgentMessage = { role: "user", content: message.trim() };
    const newHistory = [...chatHistory, userMessage];

    setChatHistory(newHistory);
    setMessage("");
    setIsLoading(true);
    setShowHistory(true);

    try {
      const response = await fetch("/api/chat/migration-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newHistory,
          projectId,
          migrationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const assistantMessage: AgentMessage = data.message;

      setChatHistory([...newHistory, assistantMessage]);
    } catch (error) {
      console.error("Migration agent error:", error);
      const errorMessage: AgentMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };

      setChatHistory([...newHistory, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Chat History Panel */}
      {showHistory && (
        <div
          ref={historyRef}
          className="absolute bottom-full left-0 right-0 mb-2 px-4"
        >
          <div className="container mx-auto max-w-4xl">
            <div className="bg-content1 border border-default-200 rounded-xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-default-200">
                <div className="flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-medium">Migration Agent</span>
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
                      d="M6 18L18 6M6 6l12 12"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Button>
              </div>
              <ScrollShadow ref={scrollRef} className="max-h-80 p-4">
                {chatHistory.length === 0 ? (
                  <p className="text-default-400 text-center py-8">
                    Ask questions about the migration process or get help with
                    configuration.
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
                                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span className="text-xs font-medium text-primary">
                                Agent
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
                            <Spinner color="primary" size="sm" />
                            <span className="text-sm text-default-500">
                              Thinking...
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollShadow>
            </div>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-default-200 bg-background/80 backdrop-blur-lg p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex gap-2">
            <Button
              isIconOnly
              color={showHistory ? "primary" : "default"}
              isDisabled={disabled}
              variant={showHistory ? "solid" : "flat"}
              onPress={toggleHistory}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Button>
            <Input
              classNames={{
                inputWrapper: "bg-default-100",
              }}
              isDisabled={isLoading || disabled || !migrationId}
              placeholder="Ask the AI agent about the migration..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  message.trim() &&
                  !isLoading &&
                  !disabled
                ) {
                  handleSend();
                }
              }}
            />
            <Button
              isIconOnly
              color="primary"
              isDisabled={
                !message.trim() || isLoading || disabled || !migrationId
              }
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
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
