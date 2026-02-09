"use client";

import { useMemo, useState, DragEvent, useRef, useCallback, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { useDisclosure } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";

import { ExecutionPlanTask, TaskStatus, Epic } from "@/domain/entities/ExecutionPlan";
import { TaskDetailModal } from "./TaskDetailModal";

const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const TASKS_PER_PAGE = 20;

interface KanbanBoardProps {
  tasks: ExecutionPlanTask[];
  epics?: Epic[];
  isLocked?: boolean;
  lockedReason?: string;
  onMoveTask?: (taskId: string, status: TaskStatus) => void;
  onMoveAllBacklogToTodo?: (taskIds: string[]) => void;
  onMoveAllTodoToBacklog?: (taskIds: string[]) => void;
  onCreateTask?: () => void;
  onUpdateTaskEpic?: (taskId: string, epicId: string) => Promise<void>;
  onDeleteTask?: (taskId: string) => Promise<void>;
  onMoveToBacklog?: (taskId: string) => Promise<void>;
  onUpdateTask?: (
    taskId: string,
    updates: { title?: string; description?: string; dependencies?: string[] }
  ) => Promise<void>;
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
  isBoardLocked,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenTaskDetails,
  onMoveAllBacklogToTodo,
  onMoveAllTodoToBacklog,
  onCreateTask,
  tasksByStatus,
}: {
  column: { id: TaskStatus; label: string };
  tasks: ExecutionPlanTask[];
  draggedTaskId: string | null;
  dragOverColumn: TaskStatus | null;
  isBoardLocked: boolean;
  onDragStart: (e: DragEvent<HTMLDivElement>, taskId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLDivElement>, columnId: TaskStatus) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => void;
  onOpenTaskDetails: (task: ExecutionPlanTask) => void;
  onMoveAllBacklogToTodo?: () => void;
  onMoveAllTodoToBacklog?: () => void;
  onCreateTask?: () => void;
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
        {/* New Task button and Move all to To Do button for Backlog column */}
        {column.id === "backlog" && (
          <div className="flex items-center gap-2 ml-auto">
            {onCreateTask && (
              <Button
                size="sm"
                color="success"
                variant="flat"
                className="text-xs"
                onPress={onCreateTask}
                startContent={
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                New Task
              </Button>
            )}
            {tasksByStatus.backlog.length > 0 && onMoveAllBacklogToTodo && (
              <Button
                size="sm"
                color="primary"
                variant="flat"
                className="text-xs"
                onPress={onMoveAllBacklogToTodo}
              >
                Move all to To Do
              </Button>
            )}
          </div>
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
        className={`flex-1 bg-default-100 dark:bg-default-100/50 rounded-lg p-3 min-h-[300px] max-h-[600px] overflow-y-auto space-y-3 transition-colors ${
          dragOverColumn === column.id ? "bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary" : ""
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
            {visibleTasks.map((task) => {
              const isTaskLocked = isBoardLocked || task.status === "in_progress" || task.status === "completed";
              return (
              <div
                key={task.id}
                draggable={!isTaskLocked}
                onDragStart={(e) => onDragStart(e, task.id)}
                onDragEnd={onDragEnd}
                className={`${draggedTaskId === task.id ? "opacity-50" : ""}`}
              >
                <Card
                  className={`bg-white dark:bg-default-100 shadow-sm hover:shadow-md transition-shadow ${
                    isTaskLocked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"
                  } ${task.error ? "border-2 border-red-300 dark:border-red-900" : ""}`}
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
            );
            })}
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

export function KanbanBoard({ tasks, epics = [], isLocked = false, lockedReason, onMoveTask, onMoveAllBacklogToTodo, onMoveAllTodoToBacklog, onCreateTask, onUpdateTaskEpic, onDeleteTask, onMoveToBacklog, onUpdateTask }: KanbanBoardProps) {
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

    // Sort completed tasks by updatedAt descending (most recent first)
    grouped.completed.sort((a, b) => b.updatedAt - a.updatedAt);

    return grouped;
  }, [tasks]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, taskId: string) => {
    // Prevent dragging when board is locked
    if (isLocked) {
      e.preventDefault();
      addToast({
        title: "Task movement disabled",
        description: lockedReason || "Task movement is currently disabled.",
        color: "warning",
      });
      return;
    }
    // Find the task to check its status
    const task = tasks.find((t) => t.id === taskId);
    // Prevent dragging tasks from in_progress or completed columns
    if (task && (task.status === "in_progress" || task.status === "completed")) {
      e.preventDefault();
      return;
    }
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
    // Don't allow dropping into in_progress or completed columns
    if (columnId === "in_progress" || columnId === "completed") {
      e.dataTransfer.dropEffect = "none";
      return;
    }
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");

    // Prevent dropping into in_progress or completed columns
    if (targetStatus === "in_progress" || targetStatus === "completed") {
      setDraggedTaskId(null);
      setDragOverColumn(null);
      return;
    }

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
            isBoardLocked={isLocked}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onOpenTaskDetails={handleOpenTaskDetails}
            onMoveAllBacklogToTodo={onMoveAllBacklogToTodo ? handleMoveAllBacklogToTodo : undefined}
            onMoveAllTodoToBacklog={onMoveAllTodoToBacklog ? handleMoveAllTodoToBacklog : undefined}
            onCreateTask={onCreateTask}
            tasksByStatus={tasksByStatus}
          />
        ))}
      </div>

      {/* Task Details Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isOpen}
        onClose={handleCloseModal}
        epics={epics}
        onUpdateEpic={onUpdateTaskEpic}
        onDeleteTask={onDeleteTask}
        onMoveToBacklog={onMoveToBacklog}
        onUpdateTask={onUpdateTask}
      />
    </>
  );
}
