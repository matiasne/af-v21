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
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";

import {
  ExecutionPlanTask,
  TaskStatus,
  TaskCategory,
  CleanArchitectureArea,
  Epic,
} from "@/domain/entities/ExecutionPlan";

interface TaskDetailModalProps {
  task: ExecutionPlanTask | null;
  isOpen: boolean;
  onClose: () => void;
  epics?: Epic[];
  onUpdateEpic?: (taskId: string, epicId: string) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onMoveToBacklog?: (taskId: string) => Promise<void>;
}

const getStatusColor = (
  status: TaskStatus
): "default" | "primary" | "warning" | "success" => {
  switch (status) {
    case "backlog":
      return "default";
    case "todo":
      return "primary";
    case "in_progress":
      return "warning";
    case "completed":
      return "success";
    default:
      return "default";
  }
};

const getStatusLabel = (status: TaskStatus): string => {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    default:
      return status;
  }
};

const getCategoryColor = (
  category: TaskCategory
): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
  switch (category) {
    case "backend":
      return "primary";
    case "frontend":
      return "secondary";
    case "database":
      return "warning";
    case "integration":
      return "success";
    case "api":
      return "danger";
    default:
      return "default";
  }
};

const getArchitectureAreaColor = (
  area: CleanArchitectureArea
): "default" | "primary" | "secondary" | "success" | "warning" => {
  switch (area) {
    case "domain":
      return "secondary";
    case "application":
      return "success";
    case "infrastructure":
      return "warning";
    case "presentation":
      return "primary";
    default:
      return "default";
  }
};

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  epics = [],
  onUpdateEpic,
  onDeleteTask,
  onMoveToBacklog,
}: TaskDetailModalProps) {
  const [isUpdatingEpic, setIsUpdatingEpic] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMovingToBacklog, setIsMovingToBacklog] = useState(false);
  const [showMoveToBacklogConfirm, setShowMoveToBacklogConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setShowMoveToBacklogConfirm(false);
  };

  const handleConfirmDelete = async () => {
    if (!task || !onDeleteTask) return;
    setIsDeleting(true);
    try {
      await onDeleteTask(task.id);
      setShowDeleteConfirm(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleMoveToBacklogClick = () => {
    setShowMoveToBacklogConfirm(true);
    setShowDeleteConfirm(false);
  };

  const handleConfirmMoveToBacklog = async () => {
    if (!task || !onMoveToBacklog) return;
    setIsMovingToBacklog(true);
    try {
      await onMoveToBacklog(task.id);
      setShowMoveToBacklogConfirm(false);
      onClose();
    } finally {
      setIsMovingToBacklog(false);
    }
  };

  const handleCancelMoveToBacklog = () => {
    setShowMoveToBacklogConfirm(false);
  };

  const handleEpicChange = async (epicId: string) => {
    if (!task || !onUpdateEpic) return;

    setIsUpdatingEpic(true);
    try {
      await onUpdateEpic(task.id, epicId);
    } catch (error) {
      console.error("Error updating epic:", error);
    } finally {
      setIsUpdatingEpic(false);
    }
  };

  const getEpicName = (epicId: string) => {
    const epic = epics.find((e) => e.id === epicId);
    return epic?.title || null;
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">{task.title}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Chip
              size="sm"
              color={getStatusColor(task.status)}
              variant="flat"
            >
              {getStatusLabel(task.status)}
            </Chip>
            {task.category && (
              <Chip
                size="sm"
                color={getCategoryColor(task.category)}
                variant="flat"
              >
                {task.category}
              </Chip>
            )}
            {task.cleanArchitectureArea && (
              <Chip
                size="sm"
                color={getArchitectureAreaColor(task.cleanArchitectureArea)}
                variant="bordered"
              >
                {task.cleanArchitectureArea}
              </Chip>
            )}
            {task.epicId && getEpicName(task.epicId) && (
              <Chip
                size="sm"
                color="secondary"
                variant="dot"
              >
                {getEpicName(task.epicId)}
              </Chip>
            )}
          </div>
        </ModalHeader>
        <ModalBody>
          {/* Description */}
          {task.description && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-default-700 mb-2">
                Description
              </h3>
              <p className="text-sm text-default-600 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Epic Assignment */}
          {epics.length > 0 && onUpdateEpic && (
            <>
              <Divider className="my-4" />
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-default-700 mb-2">
                  Epic
                </h3>
                <Select
                  label="Assign to Epic"
                  placeholder="Select an epic"
                  selectedKeys={task.epicId ? new Set([task.epicId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const epicId = Array.from(keys)[0] as string;
                    if (epicId) {
                      handleEpicChange(epicId);
                    }
                  }}
                  isLoading={isUpdatingEpic}
                  className="max-w-xs"
                >
                  {epics.map((epic) => (
                    <SelectItem key={epic.id} textValue={epic.title}>
                      {epic.title}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </>
          )}

          {/* Acceptance Criteria */}
          {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
            <>
              <Divider className="my-4" />
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-default-700 mb-2">
                  Acceptance Criteria ({task.acceptanceCriteria.length})
                </h3>
                <ul className="space-y-2">
                  {task.acceptanceCriteria.map((criteria, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-sm text-default-600"
                    >
                      <svg
                        className="w-4 h-4 text-success mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{criteria}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <>
              <Divider className="my-4" />
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-default-700 mb-2">
                  Dependencies ({task.dependencies.length})
                </h3>
                <ul className="space-y-1">
                  {task.dependencies.map((dep, index) => (
                    <li
                      key={index}
                      className="flex items-center gap-2 text-sm text-default-600"
                    >
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
                          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                        />
                      </svg>
                      <span>{dep}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Source Document */}
          {task.sourceDocument && (
            <>
              <Divider className="my-4" />
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-default-700 mb-2">
                  Source Document
                </h3>
                <p className="text-sm text-default-600">{task.sourceDocument}</p>
              </div>
            </>
          )}

          {/* Completion Summary */}
          {task.completionSummary && (
            <>
              <Divider className="my-4" />
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-default-700 mb-2">
                  Completion Summary
                </h3>
                <p className="text-sm text-default-600 whitespace-pre-wrap">
                  {task.completionSummary}
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {task.error && (
            <>
              <Divider className="my-4" />
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                      Error
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">
                      {task.error}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Metadata */}
          <Divider className="my-4" />
          <div className="text-xs text-default-400">
            <p>Task ID: {task.id}</p>
            <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(task.updatedAt).toLocaleString()}</p>
          </div>
        </ModalBody>
        <ModalFooter className="flex justify-between">
          <div className="flex items-center gap-2">
            {/* Delete button */}
            {onDeleteTask && !showDeleteConfirm && !showMoveToBacklogConfirm && (
              <Button
                color="danger"
                variant="light"
                onPress={handleDeleteClick}
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
              >
                Delete
              </Button>
            )}
            {/* Move to Backlog button - only show for completed tasks */}
            {onMoveToBacklog && task.status === "completed" && !showDeleteConfirm && !showMoveToBacklogConfirm && (
              <Button
                color="warning"
                variant="light"
                onPress={handleMoveToBacklogClick}
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
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                }
              >
                Move to Backlog
              </Button>
            )}
            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-danger">Delete this task?</span>
                <Button
                  size="sm"
                  color="danger"
                  onPress={handleConfirmDelete}
                  isLoading={isDeleting}
                >
                  Yes, Delete
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={handleCancelDelete}
                  isDisabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            )}
            {/* Move to Backlog confirmation */}
            {showMoveToBacklogConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-warning">Move this task back to backlog?</span>
                <Button
                  size="sm"
                  color="warning"
                  onPress={handleConfirmMoveToBacklog}
                  isLoading={isMovingToBacklog}
                >
                  Yes, Move
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={handleCancelMoveToBacklog}
                  isDisabled={isMovingToBacklog}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <Button color="primary" variant="light" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
