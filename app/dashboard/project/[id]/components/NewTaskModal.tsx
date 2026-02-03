"use client";

import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";

import { TaskCategory, CleanArchitectureArea } from "@/domain/entities/ExecutionPlan";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    description: string;
    category: TaskCategory;
    priority: "high" | "medium" | "low";
    cleanArchitectureArea: CleanArchitectureArea;
    acceptanceCriteria: string[];
  }) => Promise<void>;
  projectContext?: {
    name: string;
    description?: string;
    techStack?: string[];
  };
}

const CATEGORY_OPTIONS: { id: TaskCategory; label: string }[] = [
  { id: "backend", label: "Backend" },
  { id: "frontend", label: "Frontend" },
  { id: "database", label: "Database" },
  { id: "integration", label: "Integration" },
  { id: "api", label: "API" },
];

const PRIORITY_OPTIONS: { id: "high" | "medium" | "low"; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

const ARCHITECTURE_OPTIONS: { id: CleanArchitectureArea; label: string }[] = [
  { id: "domain", label: "Domain" },
  { id: "application", label: "Application" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "presentation", label: "Presentation" },
];

// Pencil with sparkles icon component
function PencilSparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
      {/* Pencil */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 7.125L16.862 4.487" />
      {/* Sparkles */}
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7L4 5.5L4.5 7L6 7.5L4.5 8L4 9.5L3.5 8L2 7.5L3.5 7z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 2.5L6 1L6.5 2.5L8 3L6.5 3.5L6 5L5.5 3.5L4 3L5.5 2.5z" />
    </svg>
  );
}

// AI-Enhanced Textarea Component
function AITextarea({
  label,
  placeholder,
  value,
  onValueChange,
  field,
  taskTitle,
  projectContext,
  disabled,
  minRows = 3,
  required = false,
}: {
  label: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  field: "description" | "acceptanceCriteria";
  taskTitle: string;
  projectContext?: { name: string; description?: string; techStack?: string[] };
  disabled?: boolean;
  minRows?: number;
  required?: boolean;
}) {
  const [aiMode, setAiMode] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");

  const handleActivateAI = () => {
    if (!taskTitle.trim()) return;
    setAiMode(true);
    setPrompt("");
    setSuggestion("");
    setError("");
  };

  const handleCancel = () => {
    setAiMode(false);
    setPrompt("");
    setSuggestion("");
    setError("");
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !taskTitle.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/task-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          field,
          taskTitle,
          currentValue: value,
          userPrompt: prompt,
          projectContext,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate suggestion");
      }

      const data = await response.json();
      setSuggestion(data.suggestion);
    } catch (err) {
      setError("Failed to generate. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsert = () => {
    onValueChange(suggestion);
    setAiMode(false);
    setPrompt("");
    setSuggestion("");
  };

  const handleRegenerate = () => {
    setSuggestion("");
    handleGenerate();
  };

  return (
    <div className="space-y-2">
      {/* Label */}
      <span className="text-sm text-default-700">
        {label} {required && <span className="text-danger">*</span>}
      </span>

      {/* AI Mode - Prompt Input */}
      {aiMode && !suggestion ? (
        <div className={`relative rounded-xl bg-default-100 dark:bg-default-50 overflow-hidden ${isLoading ? "ai-border-spin" : ""}`}>
          {/* AI prompt input bar */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="p-1.5 bg-primary-100 rounded-lg flex-shrink-0">
              <PencilSparklesIcon className="w-5 h-5 text-primary" />
            </div>
            <input
              type="text"
              placeholder={field === "description" ? "Describe what this task should do..." : "What criteria should be met..."}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-default-700 placeholder:text-default-400 outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="text-sm text-default-500 hover:text-default-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim() || isLoading}
                className={`px-4 py-1.5 text-sm rounded-full transition-all disabled:cursor-not-allowed ${
                  prompt.trim()
                    ? "bg-primary text-white hover:bg-primary-600"
                    : "bg-default-200 text-default-500"
                }`}
              >
                {isLoading ? "..." : "Create"}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <p className="px-4 pb-3 text-xs text-danger">{error}</p>
          )}

          {/* CSS for spinning border animation */}
          <style jsx>{`
            .ai-border-spin {
              position: relative;
            }
            .ai-border-spin::before {
              content: '';
              position: absolute;
              inset: 0;
              border-radius: 0.75rem;
              padding: 2px;
              background: conic-gradient(from var(--angle, 0deg), transparent 60%, #3b82f6 80%, #8b5cf6 90%, #3b82f6 100%);
              -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
              -webkit-mask-composite: xor;
              mask-composite: exclude;
              animation: spin-border 1.5s linear infinite;
            }
            @keyframes spin-border {
              to {
                --angle: 360deg;
              }
            }
            @property --angle {
              syntax: '<angle>';
              initial-value: 0deg;
              inherits: false;
            }
          `}</style>
        </div>
      ) : aiMode && suggestion ? (
        /* AI Mode - Suggestion Display */
        <div className="relative rounded-xl border-2 border-primary overflow-hidden">
          <div className="p-4 bg-white dark:bg-default-100">
            {/* Suggestion content */}
            <div className="flex items-start gap-2 mb-4">
              <PencilSparklesIcon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-default-700 whitespace-pre-wrap flex-1">{suggestion}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-default-200">
              <Button
                size="sm"
                variant="light"
                onPress={handleRegenerate}
                isDisabled={isLoading}
                startContent={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              >
                Recreate
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="light"
                onPress={handleCancel}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                color="primary"
                onPress={handleInsert}
              >
                Insert
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Normal textarea with AI button inside */
        <div className="relative">
          <Textarea
            placeholder={placeholder}
            value={value}
            onValueChange={onValueChange}
            minRows={minRows}
            isDisabled={disabled}
            classNames={{
              input: "pr-12",
            }}
          />
          {/* AI button positioned inside textarea */}
          <button
            type="button"
            onClick={handleActivateAI}
            disabled={disabled || !taskTitle.trim()}
            className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${
              !taskTitle.trim() || disabled
                ? "opacity-30 cursor-not-allowed bg-default-100"
                : "bg-primary-100 hover:bg-primary-200 cursor-pointer"
            }`}
            title={!taskTitle.trim() ? "Enter a task title first" : "AI Assist"}
          >
            <PencilSparklesIcon className="w-5 h-5 text-primary" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function NewTaskModal({ isOpen, onClose, onSubmit, projectContext }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [category, setCategory] = useState<TaskCategory>("backend");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [architectureArea, setArchitectureArea] = useState<CleanArchitectureArea>("infrastructure");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    const criteriaArray = acceptanceCriteria
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        cleanArchitectureArea: architectureArea,
        acceptanceCriteria: criteriaArray,
      });
      setTitle("");
      setDescription("");
      setAcceptanceCriteria("");
      setCategory("backend");
      setPriority("medium");
      setArchitectureArea("infrastructure");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle("");
      setDescription("");
      setAcceptanceCriteria("");
      setCategory("backend");
      setPriority("medium");
      setArchitectureArea("infrastructure");
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      isDismissable={!isSubmitting}
      hideCloseButton={isSubmitting}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold">New Task</span>
          <span className="text-sm text-default-500 font-normal">
            Create a new task for the backlog
          </span>
        </ModalHeader>

        <ModalBody className="gap-5">
          <Input
            label="Title"
            placeholder="Enter task title"
            value={title}
            onValueChange={setTitle}
            isRequired
            isDisabled={isSubmitting}
          />

          <AITextarea
            label="Description"
            placeholder="Describe what needs to be done..."
            value={description}
            onValueChange={setDescription}
            field="description"
            taskTitle={title}
            projectContext={projectContext}
            disabled={isSubmitting}
            minRows={4}
            required
          />

          <AITextarea
            label="Acceptance Criteria"
            placeholder="Enter each criterion on a new line..."
            value={acceptanceCriteria}
            onValueChange={setAcceptanceCriteria}
            field="acceptanceCriteria"
            taskTitle={title}
            projectContext={projectContext}
            disabled={isSubmitting}
            minRows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              selectedKeys={[category]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as TaskCategory;
                if (selected) setCategory(selected);
              }}
              isDisabled={isSubmitting}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.id}>{option.label}</SelectItem>
              ))}
            </Select>

            <Select
              label="Priority"
              selectedKeys={[priority]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as "high" | "medium" | "low";
                if (selected) setPriority(selected);
              }}
              isDisabled={isSubmitting}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.id}>{option.label}</SelectItem>
              ))}
            </Select>
          </div>

          <Select
            label="Architecture Layer"
            selectedKeys={[architectureArea]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as CleanArchitectureArea;
              if (selected) setArchitectureArea(selected);
            }}
            isDisabled={isSubmitting}
          >
            {ARCHITECTURE_OPTIONS.map((option) => (
              <SelectItem key={option.id}>{option.label}</SelectItem>
            ))}
          </Select>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="light"
            onPress={handleClose}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isLoading={isSubmitting}
            isDisabled={!title.trim() || !description.trim()}
          >
            Create Task
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
