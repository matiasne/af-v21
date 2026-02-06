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

import { ExecutionPlanTask } from "@/domain/entities/ExecutionPlan";

interface NewEpicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (epicData: {
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    taskIds: string[];
  }) => Promise<void>;
  tasks: ExecutionPlanTask[];
}

const PRIORITY_OPTIONS: { id: "high" | "medium" | "low"; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export default function NewEpicModal({ isOpen, onClose, onSubmit, tasks }: NewEpicModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter tasks that don't have an epic assigned yet
  const unassignedTasks = tasks.filter((task) => !task.epicId);

  const handleToggleTask = (taskId: string) => {
    const newSet = new Set(selectedTaskIds);
    if (newSet.has(taskId)) {
      newSet.delete(taskId);
    } else {
      newSet.add(taskId);
    }
    setSelectedTaskIds(newSet);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        priority,
        taskIds: Array.from(selectedTaskIds),
      });
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSelectedTaskIds(new Set());
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setSelectedTaskIds(new Set());
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
          <span className="text-lg font-semibold">New Epic</span>
          <span className="text-sm text-default-500 font-normal">
            Create a new epic to group related tasks
          </span>
        </ModalHeader>

        <ModalBody className="gap-4">
          <Input
            label="Title"
            placeholder="Enter epic title"
            value={title}
            onValueChange={setTitle}
            isRequired
            isDisabled={isSubmitting}
          />

          <Textarea
            label="Description"
            placeholder="Describe the epic and its goals..."
            value={description}
            onValueChange={setDescription}
            minRows={3}
            isDisabled={isSubmitting}
          />

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

          {/* Task Assignment Section */}
          {unassignedTasks.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm text-default-700">
                Assign Tasks <span className="text-default-400">(optional)</span>
              </label>
              <div className="max-h-48 overflow-y-auto border border-default-200 rounded-lg p-2 space-y-1">
                {unassignedTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-start gap-2 p-2 rounded-md hover:bg-default-100 cursor-pointer ${
                      isSubmitting ? "opacity-50 pointer-events-none" : ""
                    }`}
                    onClick={() => !isSubmitting && handleToggleTask(task.id)}
                  >
                    <div
                      className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedTaskIds.has(task.id)
                          ? "bg-primary border-primary"
                          : "border-default-300"
                      }`}
                    >
                      {selectedTaskIds.has(task.id) && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-default-500 truncate">{task.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {selectedTaskIds.size > 0 && (
                <p className="text-xs text-default-500">
                  {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}
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
            isDisabled={!title.trim()}
          >
            Create Epic
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
