"use client";

import { useRef, useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";

import { getTechIcon } from "./techIcons";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConfigurationChatProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  techStack?: string[];
  suggestions?: string[];
  isComplete?: boolean;
  onSave?: () => void;
  onRemoveTech?: (tech: string) => void;
  onClearAll?: () => void;
  onSendMessage?: (message: string) => void;
}

const MAX_VISIBLE_MESSAGES = 15;

export function ConfigurationChat({
  messages,
  isLoading = false,
  techStack = [],
  suggestions = [],
  isComplete = false,
  onSave,
  onRemoveTech,
  onClearAll,
  onSendMessage,
}: ConfigurationChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputMessage, setInputMessage] = useState("");

  const handleSend = () => {
    if (!inputMessage.trim() || isLoading || !onSendMessage) return;
    onSendMessage(inputMessage.trim());
    setInputMessage("");
  };

  // Only show the last 15 messages
  const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <Card className="w-full">
      {techStack.length > 0 && (
        <>
          <CardHeader className="flex flex-col items-start gap-2">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-semibold text-default-600">
                Target Tech Stack
              </h3>
              {onClearAll && (
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={onClearAll}
                >
                  Clear All
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => {
                const { icon: Icon, color } = getTechIcon(tech);
                return (
                  <Chip
                    key={tech}
                    startContent={<Icon className="ml-1" style={{ color }} />}
                    variant="flat"
                    color="primary"
                    onClose={onRemoveTech ? () => onRemoveTech(tech) : undefined}
                  >
                    {tech}
                  </Chip>
                );
              })}
            </div>
            {suggestions.length > 0 && (
              <div className="mt-3 w-full">
                <h4 className="text-xs font-medium text-default-400 mb-2">
                  Suggestions
                </h4>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => {
                    const { icon: Icon, color } = getTechIcon(suggestion);
                    return (
                      <Chip
                        key={suggestion}
                        startContent={<Icon className="ml-1" style={{ color }} />}
                        variant="bordered"
                        color="default"
                        size="sm"
                      >
                        {suggestion}
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}
          </CardHeader>
          <Divider />
        </>
      )}
      <CardBody className="p-0">
        <ScrollShadow className="h-[400px] p-4">
          {visibleMessages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg
                className="h-16 w-16 text-default-300 mb-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
                />
              </svg>
              <p className="text-default-500 text-lg font-medium mb-2">
                Start the configuration
              </p>
              <p className="text-default-400 text-sm max-w-md">
                Tell us about your project, the technologies you want to
                migrate to, and any specific requirements you have.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-default-100 text-default-700"
                    }`}
                  >
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <svg
                          className="h-4 w-4 text-primary"
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
                          AI Assistant
                        </span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-default-100 rounded-xl px-4 py-3">
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
      </CardBody>
      <Divider />
      {/* Chat Input */}
      <CardFooter className="p-3">
        <div className="flex gap-2 w-full">
          <Input
            placeholder="Describe your target tech stack..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputMessage.trim() && !isLoading) {
                handleSend();
              }
            }}
            classNames={{
              inputWrapper: "bg-default-100",
            }}
            isDisabled={isLoading}
          />
          <Button
            color="primary"
            isDisabled={!inputMessage.trim() || isLoading}
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
                  d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                />
              </svg>
            )}
          </Button>
        </div>
      </CardFooter>
      {techStack.length > 0 && (
        <>
          <Divider />
          <CardFooter className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {isComplete ? (
                <>
                  <svg
                    className="h-5 w-5 text-success"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    />
                  </svg>
                  <span className="text-sm text-success font-medium">
                    Tech stack configuration complete
                  </span>
                </>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 text-primary"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z"
                    />
                  </svg>
                  <span className="text-sm text-default-500">
                    {techStack.length} technologies selected
                  </span>
                </>
              )}
            </div>
            <Button color="success" onPress={onSave}>
              Save & Continue
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}
