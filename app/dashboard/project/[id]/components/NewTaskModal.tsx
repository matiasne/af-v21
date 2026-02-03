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

export default function NewTaskModal({ isOpen, onClose, onSubmit }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [category, setCategory] = useState<TaskCategory>("backend");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [architectureArea, setArchitectureArea] = useState<CleanArchitectureArea>("infrastructure");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    // Parse acceptance criteria: split by newlines, trim each, filter empty
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
      // Reset form
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
      size="lg"
      isDismissable={!isSubmitting}
      hideCloseButton={isSubmitting}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="text-lg font-semibold">New Task</span>
          <span className="text-sm text-default-500 font-normal">
            Create a new task for the backlog
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          <Input
            label="Title"
            placeholder="Enter task title"
            value={title}
            onValueChange={setTitle}
            isRequired
            isDisabled={isSubmitting}
          />

          <Textarea
            label="Description"
            placeholder="Describe what needs to be done..."
            value={description}
            onValueChange={setDescription}
            minRows={3}
            isRequired
            isDisabled={isSubmitting}
          />

          <Textarea
            label="Acceptance Criteria"
            placeholder="Enter each criterion on a new line...&#10;- User can submit the form&#10;- Data is validated before saving&#10;- Success message is displayed"
            value={acceptanceCriteria}
            onValueChange={setAcceptanceCriteria}
            minRows={3}
            isDisabled={isSubmitting}
            description="One criterion per line (optional)"
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
