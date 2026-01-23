"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";

import { getTechIcon } from "./techIcons";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface TechStackEditModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  techStack: string[];
  messages: ChatMessage[];
  isLoading?: boolean;
  suggestions?: string[];
  onSendMessage: (message: string) => void;
  onRemoveTech: (tech: string) => void;
  onClearAll: () => void;
  onSave: () => void;
}

const MAX_VISIBLE_MESSAGES = 15;

export function TechStackEditModal({
  isOpen,
  onOpenChange,
  techStack,
  messages,
  isLoading = false,
  suggestions = [],
  onSendMessage,
  onRemoveTech,
  onClearAll,
  onSave,
}: TechStackEditModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  // Only show the last 15 messages
  const visibleMessages = messages.slice(-MAX_VISIBLE_MESSAGES);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSendMessage = useCallback(() => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  }, [inputValue, isLoading, onSendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Edit Target Tech Stack</h2>
              <p className="text-sm text-default-500 font-normal">
                Configure the technologies for your migration
              </p>
            </ModalHeader>
            <Divider />
            <ModalBody className="py-4">
              {/* Current Tech Stack */}
              {techStack.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-default-600">
                      Current Tech Stack
                    </h3>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={onClearAll}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {techStack.map((tech) => {
                      const { icon: Icon, color } = getTechIcon(tech);
                      return (
                        <Chip
                          key={tech}
                          startContent={
                            <Icon className="ml-1" style={{ color }} />
                          }
                          variant="flat"
                          color="primary"
                          onClose={() => onRemoveTech(tech)}
                        >
                          {tech}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-default-400 mb-2">
                    Suggestions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion) => {
                      const { icon: Icon, color } = getTechIcon(suggestion);
                      return (
                        <Chip
                          key={suggestion}
                          startContent={
                            <Icon className="ml-1" style={{ color }} />
                          }
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

              {(techStack.length > 0 || suggestions.length > 0) && (
                <Divider className="my-2" />
              )}

              {/* Chat Messages */}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-default-600 mb-2">
                  Configuration Chat
                </h3>
                <ScrollShadow className="h-[300px] border rounded-lg p-4 bg-default-50">
                  {visibleMessages.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <svg
                        className="h-12 w-12 text-default-300 mb-3"
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
                      <p className="text-default-500 text-sm font-medium mb-1">
                        Start configuring your tech stack
                      </p>
                      <p className="text-default-400 text-xs max-w-sm">
                        Tell us about the technologies you want to migrate to,
                        and any specific requirements you have.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleMessages.map((msg, index) => (
                        <div
                          key={index}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-xl px-3 py-2 ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-default-100 text-default-700"
                            }`}
                          >
                            {msg.role === "assistant" && (
                              <div className="flex items-center gap-1.5 mb-1">
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
                                  AI Assistant
                                </span>
                              </div>
                            )}
                            <p className="whitespace-pre-wrap text-sm">
                              {msg.content}
                            </p>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="bg-default-100 rounded-xl px-3 py-2">
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

                {/* User Input */}
                <div className="mt-3 flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Describe your target tech stack..."
                    value={inputValue}
                    onValueChange={setInputValue}
                    onKeyDown={handleKeyDown}
                    isDisabled={isLoading}
                    classNames={{
                      inputWrapper: "bg-default-100",
                    }}
                  />
                  <Button
                    color="primary"
                    isIconOnly
                    onPress={handleSendMessage}
                    isDisabled={!inputValue.trim() || isLoading}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                      />
                    </svg>
                  </Button>
                </div>
              </div>
            </ModalBody>
            <Divider />
            <ModalFooter>
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  {techStack.length > 0 ? (
                    <>
                      <svg
                        className="h-4 w-4 text-primary"
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
                  ) : (
                    <span className="text-sm text-default-400">
                      No technologies selected yet
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="success"
                    onPress={() => {
                      onSave();
                      onClose();
                    }}
                    isDisabled={techStack.length === 0}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
