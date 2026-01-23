"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableColumn,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";

import {
  ExecutionPlanTask,
  TaskStatus,
  TaskCategory,
  CleanArchitectureArea,
} from "@/domain/entities/ExecutionPlan";

interface TaskListProps {
  tasks: ExecutionPlanTask[];
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
}

const STATUS_OPTIONS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const getCategoryColor = (
  category: TaskCategory
): "primary" | "success" | "warning" | "danger" | "secondary" => {
  switch (category) {
    case "backend":
      return "primary";
    case "frontend":
      return "success";
    case "database":
      return "warning";
    case "integration":
      return "danger";
    case "api":
      return "secondary";
    default:
      return "primary";
  }
};

const getArchitectureAreaColor = (
  area: CleanArchitectureArea
): "default" | "primary" | "secondary" | "success" | "warning" => {
  switch (area) {
    case "domain":
      return "primary";
    case "application":
      return "secondary";
    case "infrastructure":
      return "success";
    case "presentation":
      return "warning";
    default:
      return "default";
  }
};

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

export function TaskList({ tasks, onUpdateTaskStatus }: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<ExecutionPlanTask | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewDetails = (task: ExecutionPlanTask) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    await onUpdateTaskStatus(taskId, newStatus);
  };

  return (
    <>
      <Table aria-label="Tasks table">
        <TableHeader>
          <TableColumn>TITLE</TableColumn>
          <TableColumn>CATEGORY</TableColumn>
          <TableColumn>LAYER</TableColumn>
          <TableColumn>STATUS</TableColumn>
          <TableColumn>ACTIONS</TableColumn>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className={task.error ? "bg-red-50 dark:bg-red-950/20" : ""}
            >
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{task.title}</span>
                  {task.description && (
                    <span className="text-xs text-default-500 line-clamp-2">
                      {task.description}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  color={getCategoryColor(task.category)}
                  variant="flat"
                >
                  {task.category}
                </Chip>
              </TableCell>
              <TableCell>
                <Chip
                  size="sm"
                  color={getArchitectureAreaColor(task.cleanArchitectureArea)}
                  variant="dot"
                >
                  {task.cleanArchitectureArea}
                </Chip>
              </TableCell>
              <TableCell>
                <Select
                  size="sm"
                  selectedKeys={new Set([task.status])}
                  onSelectionChange={(keys) => {
                    const newStatus = Array.from(keys)[0] as TaskStatus;
                    if (newStatus && newStatus !== task.status) {
                      handleStatusChange(task.id, newStatus);
                    }
                  }}
                  className="max-w-xs"
                  aria-label="Task status"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.id} textValue={option.label}>
                      {option.label}
                    </SelectItem>
                  ))}
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => handleViewDetails(task)}
                >
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Task Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold">{selectedTask?.title}</h2>
              <div className="flex items-center gap-2">
                {selectedTask?.category && (
                  <Chip
                    size="sm"
                    color={getCategoryColor(selectedTask.category)}
                    variant="flat"
                  >
                    {selectedTask.category}
                  </Chip>
                )}
                {selectedTask?.cleanArchitectureArea && (
                  <Chip
                    size="sm"
                    color={getArchitectureAreaColor(
                      selectedTask.cleanArchitectureArea
                    )}
                    variant="dot"
                  >
                    {selectedTask.cleanArchitectureArea}
                  </Chip>
                )}
                {selectedTask?.status && (
                  <Chip
                    size="sm"
                    color={getStatusColor(selectedTask.status)}
                    variant="flat"
                  >
                    {getStatusLabel(selectedTask.status)}
                  </Chip>
                )}
              </div>
            </div>
          </ModalHeader>
          <ModalBody>
            {selectedTask && (
              <>
                {/* Description */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-default-700 mb-2">
                    Description
                  </h3>
                  <p className="text-sm text-default-600 whitespace-pre-wrap">
                    {selectedTask.description}
                  </p>
                </div>

                {/* Acceptance Criteria */}
                {selectedTask.acceptanceCriteria &&
                  selectedTask.acceptanceCriteria.length > 0 && (
                    <>
                      <Divider className="my-4" />
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-default-700 mb-2">
                          Acceptance Criteria
                        </h3>
                        <ul className="list-disc list-inside text-sm text-default-600 space-y-1">
                          {selectedTask.acceptanceCriteria.map(
                            (criteria, index) => (
                              <li key={index}>{criteria}</li>
                            )
                          )}
                        </ul>
                      </div>
                    </>
                  )}

                {/* Dependencies */}
                {selectedTask.dependencies &&
                  selectedTask.dependencies.length > 0 && (
                    <>
                      <Divider className="my-4" />
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-default-700 mb-2">
                          Dependencies
                        </h3>
                        <ul className="list-disc list-inside text-sm text-default-600 space-y-1">
                          {selectedTask.dependencies.map((dep, index) => (
                            <li key={index}>{dep}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                {/* Source Document */}
                {selectedTask.sourceDocument && (
                  <>
                    <Divider className="my-4" />
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-default-700 mb-2">
                        Source Document
                      </h3>
                      <p className="text-sm text-default-600">
                        {selectedTask.sourceDocument}
                      </p>
                    </div>
                  </>
                )}

                {/* Completion Summary */}
                {selectedTask.completionSummary && (
                  <>
                    <Divider className="my-4" />
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-default-700 mb-2">
                        Completion Summary
                      </h3>
                      <p className="text-sm text-default-600 whitespace-pre-wrap">
                        {selectedTask.completionSummary}
                      </p>
                    </div>
                  </>
                )}

                {/* Error */}
                {selectedTask.error && (
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
                            {selectedTask.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Metadata */}
                <Divider className="my-4" />
                <div className="text-xs text-default-400">
                  <p>Task ID: {selectedTask.id}</p>
                  <p>
                    Created: {new Date(selectedTask.createdAt).toLocaleString()}
                  </p>
                  <p>
                    Updated: {new Date(selectedTask.updatedAt).toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="primary"
              variant="light"
              onPress={() => setIsModalOpen(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
