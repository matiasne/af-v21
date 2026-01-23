"use client";

import { useMemo, useState, DragEvent, useRef, useCallback, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";

import { ExecutionPlanTask, TaskStatus } from "@/domain/entities/ExecutionPlan";

const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const TASKS_PER_PAGE = 20;

interface KanbanBoardProps {
  tasks: ExecutionPlanTask[];
  onMoveTask?: (taskId: string, status: TaskStatus) => void;
  onMoveAllBacklogToTodo?: (taskIds: string[]) => void;
  onMoveAllTodoToBacklog?: (taskIds: string[]) => void;
}

function getColumnColor(status: TaskStatus): "default" | "primary" | "warning" | "success" {
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
}

function getCategoryColor(category: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
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
}

function getArchitectureAreaColor(area: string): "default" | "primary" | "secondary" | "success" | "warning" {
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
}

function getStatusLabel(status: TaskStatus): string {
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
}

// Column component with infinite scroll
function KanbanColumn({
  column,
  tasks,
  draggedTaskId,
  dragOverColumn,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenTaskDetails,
  onMoveAllBacklogToTodo,
  onMoveAllTodoToBacklog,
  tasksByStatus,
}: {
  column: { id: TaskStatus; label: string };
  tasks: ExecutionPlanTask[];
  draggedTaskId: string | null;
  dragOverColumn: TaskStatus | null;
  onDragStart: (e: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, columnId: TaskStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => void;
  onOpenTaskDetails: (task: ExecutionPlanTask) => void;
  onMoveAllBacklogToTodo?: () => void;
  onMoveAllTodoToBacklog?: () => void;
  tasksByStatus: Record<TaskStatus, ExecutionPlanTask[]>;
}) {
  const [visibleCount, setVisibleCount] = useState(TASKS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  const visibleTasks = tasks.slice(0, visibleCount);
  const hasMore = visibleCount < tasks.length;

  // Reset visible count when tasks change
  useEffect(() => {
    setVisibleCount(TASKS_PER_PAGE);
  }, [tasks.length]);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    // Simulate a small delay for smooth UX
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + TASKS_PER_PAGE, tasks.length));
      setIsLoading(false);
    }, 200);
  }, [isLoading, hasMore, tasks.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loader = loaderRef.current;
    if (!loader) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        root: columnRef.current,
        rootMargin: "100px",
        threshold: 0.1,
      }
    );

    observer.observe(loader);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadMore]);

  return (
    <div key={column.id} className="flex flex-col">
      {/* Column Header */}
      <div className="flex items-center gap-2 mb-3 px-2">
        <Chip
          size="sm"
          color={getColumnColor(column.id)}
          variant="flat"
        >
          {column.label}
        </Chip>
        <span className="text-sm text-default-400">
          {tasks.length}
        </span>
        {/* Move all to To Do button for Backlog column */}
        {column.id === "backlog" && tasksByStatus.backlog.length > 0 && onMoveAllBacklogToTodo && (
          <Button
            size="sm"
            color="primary"
            variant="flat"
            className="ml-auto text-xs"
            onPress={onMoveAllBacklogToTodo}
          >
            Move all to To Do
          </Button>
        )}
        {/* Move all to Backlog button for To Do column */}
        {column.id === "todo" && tasksByStatus.todo.length > 0 && onMoveAllTodoToBacklog && (
          <Button
            size="sm"
            color="default"
            variant="flat"
            className="ml-auto text-xs"
            onPress={onMoveAllTodoToBacklog}
          >
            Move all to Backlog
          </Button>
        )}
      </div>

      {/* Column Content */}
      <div
        ref={columnRef}
        className={`flex-1 bg-default-100 dark:bg-default-50/10 rounded-lg p-3 min-h-[300px] max-h-[600px] overflow-y-auto space-y-3 transition-colors ${
          dragOverColumn === column.id ? "bg-primary-100 dark:bg-primary-900/20 ring-2 ring-primary" : ""
        }`}
        onDragOver={(e) => onDragOver(e, column.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, column.id)}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-default-400 text-sm">
            {dragOverColumn === column.id ? "Drop here" : "No tasks"}
          </div>
        ) : (
          <>
            {visibleTasks.map((task) => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => onDragStart(e, task.id)}
                onDragEnd={onDragEnd}
                className={`${draggedTaskId === task.id ? "opacity-50" : ""}`}
              >
                <Card
                  className={`bg-white dark:bg-default-100 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
                    task.error ? "border-2 border-red-300 dark:border-red-900" : ""
                  }`}
                >
                  <CardBody className="p-3">
                    <div className="flex flex-col gap-2">
                      {/* Category and Architecture Area badges */}
                      <div className="flex flex-wrap items-center gap-1">
                        {task.category && (
                          <Chip
                            size="sm"
                            color={getCategoryColor(task.category)}
                            variant="flat"
                            className="text-xs"
                          >
                            {task.category}
                          </Chip>
                        )}
                        {task.cleanArchitectureArea && (
                          <Chip
                            size="sm"
                            color={getArchitectureAreaColor(task.cleanArchitectureArea)}
                            variant="bordered"
                            className="text-xs"
                          >
                            {task.cleanArchitectureArea}
                          </Chip>
                        )}
                      </div>
                      <h4 className="text-sm font-medium line-clamp-2">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-xs text-default-500 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      {/* Dependencies count */}
                      {task.dependencies && task.dependencies.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-default-400">
                          <svg
                            className="w-3 h-3"
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
                          <span>{task.dependencies.length} dependencies</span>
                        </div>
                      )}
                      {/* Acceptance criteria count */}
                      {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-default-400">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                            />
                          </svg>
                          <span>{task.acceptanceCriteria.length} criteria</span>
                        </div>
                      )}
                      {/* View Details Button */}
                      <Button
                        size="sm"
                        variant="light"
                        color="primary"
                        className="mt-1 text-xs"
                        onPress={() => onOpenTaskDetails(task)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </div>
            ))}
            {/* Loader element for intersection observer */}
            {hasMore && (
              <div ref={loaderRef} className="flex justify-center py-2">
                {isLoading ? (
                  <Spinner size="sm" color="primary" />
                ) : (
                  <span className="text-xs text-default-400">
                    {tasks.length - visibleCount} more tasks
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks, onMoveTask, onMoveAllBacklogToTodo, onMoveAllTodoToBacklog }: KanbanBoardProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<ExecutionPlanTask | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, ExecutionPlanTask[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      completed: [],
    };

    tasks.forEach((task) => {
      const status = task.status || "backlog";
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped.backlog.push(task);
      }
    });

    return grouped;
  }, [tasks]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, columnId: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");

    if (taskId && onMoveTask) {
      onMoveTask(taskId, targetStatus);
    }

    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleMoveAllBacklogToTodo = () => {
    if (onMoveAllBacklogToTodo && tasksByStatus.backlog.length > 0) {
      const backlogTaskIds = tasksByStatus.backlog.map((task) => task.id);
      onMoveAllBacklogToTodo(backlogTaskIds);
    }
  };

  const handleMoveAllTodoToBacklog = () => {
    if (onMoveAllTodoToBacklog && tasksByStatus.todo.length > 0) {
      const todoTaskIds = tasksByStatus.todo.map((task) => task.id);
      onMoveAllTodoToBacklog(todoTaskIds);
    }
  };

  const handleOpenTaskDetails = (task: ExecutionPlanTask) => {
    setSelectedTask(task);
    onOpen();
  };

  const handleCloseModal = () => {
    onClose();
    setSelectedTask(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={tasksByStatus[column.id]}
            draggedTaskId={draggedTaskId}
            dragOverColumn={dragOverColumn}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onOpenTaskDetails={handleOpenTaskDetails}
            onMoveAllBacklogToTodo={onMoveAllBacklogToTodo ? handleMoveAllBacklogToTodo : undefined}
            onMoveAllTodoToBacklog={onMoveAllTodoToBacklog ? handleMoveAllTodoToBacklog : undefined}
            tasksByStatus={tasksByStatus}
          />
        ))}
      </div>

      {/* Task Details Modal */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {selectedTask && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Chip
                    size="sm"
                    color={getColumnColor(selectedTask.status)}
                    variant="flat"
                  >
                    {getStatusLabel(selectedTask.status)}
                  </Chip>
                  {selectedTask.category && (
                    <Chip
                      size="sm"
                      color={getCategoryColor(selectedTask.category)}
                      variant="flat"
                    >
                      {selectedTask.category}
                    </Chip>
                  )}
                  {selectedTask.cleanArchitectureArea && (
                    <Chip
                      size="sm"
                      color={getArchitectureAreaColor(selectedTask.cleanArchitectureArea)}
                      variant="bordered"
                    >
                      {selectedTask.cleanArchitectureArea}
                    </Chip>
                  )}
                </div>
              </ModalHeader>
              <ModalBody>
                {/* Description */}
                {selectedTask.description && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-default-700 mb-2">Description</h3>
                    <p className="text-sm text-default-600">{selectedTask.description}</p>
                  </div>
                )}

                <Divider className="my-4" />

                {/* Acceptance Criteria */}
                {selectedTask.acceptanceCriteria && selectedTask.acceptanceCriteria.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-default-700 mb-2">
                      Acceptance Criteria ({selectedTask.acceptanceCriteria.length})
                    </h3>
                    <ul className="space-y-2">
                      {selectedTask.acceptanceCriteria.map((criteria, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-default-600">
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
                )}

                {/* Dependencies */}
                {selectedTask.dependencies && selectedTask.dependencies.length > 0 && (
                  <>
                    <Divider className="my-4" />
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-default-700 mb-2">
                        Dependencies ({selectedTask.dependencies.length})
                      </h3>
                      <ul className="space-y-1">
                        {selectedTask.dependencies.map((dep, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-default-600">
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
                {selectedTask.sourceDocument && (
                  <>
                    <Divider className="my-4" />
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-default-700 mb-2">Source Document</h3>
                      <p className="text-sm text-default-600">{selectedTask.sourceDocument}</p>
                    </div>
                  </>
                )}

                {/* Completion Summary */}
                {selectedTask.completionSummary && (
                  <>
                    <Divider className="my-4" />
                    <div className="mb-4">
                      <h3 className="text-sm font-semibold text-default-700 mb-2">Completion Summary</h3>
                      <p className="text-sm text-default-600 whitespace-pre-wrap">{selectedTask.completionSummary}</p>
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
                          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Error</h3>
                          <p className="text-sm text-red-600 dark:text-red-300 whitespace-pre-wrap">{selectedTask.error}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Metadata */}
                <Divider className="my-4" />
                <div className="text-xs text-default-400">
                  <p>Task ID: {selectedTask.id}</p>
                  <p>Created: {new Date(selectedTask.createdAt).toLocaleString()}</p>
                  <p>Updated: {new Date(selectedTask.updatedAt).toLocaleString()}</p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" variant="light" onPress={handleCloseModal}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
