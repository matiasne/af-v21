"use client";

import { useEffect, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody } from "@heroui/modal";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Accordion, AccordionItem } from "@heroui/accordion";

import { Epic, Phase, ExecutionPlanTask } from "@/domain/entities/ExecutionPlan";
import { executionPlanRepository } from "@/infrastructure/repositories/FirebaseExecutionPlanRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

type PanelType = "epics" | "phases" | "tasks";

interface ExecutionPlanPanelProps {
  isOpen: boolean;
  onClose: () => void;
  type: PanelType;
  projectId: string;
}

function PriorityChip({ priority }: { priority: string }) {
  const colorMap: Record<string, "danger" | "warning" | "success"> = {
    high: "danger",
    medium: "warning",
    low: "success",
  };

  return (
    <Chip size="sm" color={colorMap[priority] || "default"} variant="flat">
      {priority}
    </Chip>
  );
}

function EpicsList({ epics }: { epics: Epic[] }) {
  if (epics.length === 0) {
    return <p className="text-default-500 text-center py-8">No epics found</p>;
  }

  return (
    <div className="space-y-3">
      {epics.map((epic) => (
        <Card key={epic.id} className="bg-default-50">
          <CardBody className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-default-400">{epic.id}</span>
                <PriorityChip priority={epic.priority} />
              </div>
            </div>
            <h4 className="font-semibold">{epic.title}</h4>
            <p className="text-sm text-default-600">{epic.description}</p>
            {epic.relatedRequirements.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {epic.relatedRequirements.map((req) => (
                  <Chip key={req} size="sm" variant="bordered">
                    {req}
                  </Chip>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function PhasesList({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) {
    return <p className="text-default-500 text-center py-8">No phases found</p>;
  }

  return (
    <div className="space-y-3">
      {phases.map((phase) => (
        <Card key={phase.id} className="bg-default-50">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Chip size="sm" color="primary" variant="flat">
                Phase {phase.number}
              </Chip>
              <span className="text-xs font-mono text-default-400">{phase.id}</span>
            </div>
            <h4 className="font-semibold">{phase.title}</h4>
            <p className="text-sm text-default-600">{phase.description}</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function TasksList({ tasks }: { tasks: ExecutionPlanTask[] }) {
  if (tasks.length === 0) {
    return <p className="text-default-500 text-center py-8">No tasks found</p>;
  }

  return (
    <Accordion variant="splitted" selectionMode="multiple">
      {tasks.map((task) => (
        <AccordionItem
          key={task.id}
          aria-label={task.title}
          title={
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-default-400">{task.id}</span>
              <PriorityChip priority={task.priority} />
              <span className="font-medium">{task.title}</span>
            </div>
          }
          subtitle={
            <div className="flex items-center gap-2 mt-1">
              <Chip size="sm" variant="flat" color="secondary">
                {task.epicId}
              </Chip>
              <Chip size="sm" variant="flat" color="primary">
                {task.phaseId}
              </Chip>
              <span className="text-xs text-default-400">{task.effortEstimate}</span>
            </div>
          }
        >
          <div className="space-y-4 pb-2">
            <div>
              <h5 className="text-sm font-medium text-default-700 mb-1">Description</h5>
              <p className="text-sm text-default-600">{task.description}</p>
            </div>

            {task.acceptanceCriteria.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-default-700 mb-1">Acceptance Criteria</h5>
                <ul className="list-disc list-inside text-sm text-default-600 space-y-1">
                  {task.acceptanceCriteria.map((criteria, idx) => (
                    <li key={idx}>{criteria}</li>
                  ))}
                </ul>
              </div>
            )}

            {task.deliverables.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-default-700 mb-1">Deliverables</h5>
                <div className="flex flex-wrap gap-1">
                  {task.deliverables.map((deliverable, idx) => (
                    <Chip key={idx} size="sm" variant="bordered" className="font-mono text-xs">
                      {deliverable}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {task.skillsRequired.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-default-700 mb-1">Skills Required</h5>
                <div className="flex flex-wrap gap-1">
                  {task.skillsRequired.map((skill, idx) => (
                    <Chip key={idx} size="sm" color="warning" variant="flat">
                      {skill}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {task.relatedRequirements.length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-default-700 mb-1">Related Requirements</h5>
                <div className="flex flex-wrap gap-1">
                  {task.relatedRequirements.map((req, idx) => (
                    <Chip key={idx} size="sm" variant="bordered">
                      {req}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

export function ExecutionPlanPanel({
  isOpen,
  onClose,
  type,
  projectId,
}: ExecutionPlanPanelProps) {
  const { user } = useAuth();
  const [epics, setEpics] = useState<Epic[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<ExecutionPlanTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user?.uid || !projectId) {
      return;
    }

    setLoading(true);

    let unsubscribe: () => void;

    if (type === "epics") {
      unsubscribe = executionPlanRepository.subscribeEpics(
        user.uid,
        projectId,
        (data) => {
          setEpics(data);
          setLoading(false);
        },
        () => setLoading(false)
      );
    } else if (type === "phases") {
      unsubscribe = executionPlanRepository.subscribePhases(
        user.uid,
        projectId,
        (data) => {
          setPhases(data);
          setLoading(false);
        },
        () => setLoading(false)
      );
    } else {
      unsubscribe = executionPlanRepository.subscribeTasks(
        user.uid,
        projectId,
        (data) => {
          setTasks(data);
          setLoading(false);
        },
        () => setLoading(false)
      );
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [isOpen, user?.uid, projectId, type]);

  const titles: Record<PanelType, string> = {
    epics: "Epics",
    phases: "Phases",
    tasks: "Execution Plan Tasks",
  };

  const counts: Record<PanelType, number> = {
    epics: epics.length,
    phases: phases.length,
    tasks: tasks.length,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex items-center gap-3">
          <span>{titles[type]}</span>
          {!loading && (
            <Chip size="sm" variant="flat">
              {counts[type]} item{counts[type] !== 1 ? "s" : ""}
            </Chip>
          )}
        </ModalHeader>
        <ModalBody className="pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner color="primary" />
            </div>
          ) : (
            <ScrollShadow className="max-h-[60vh]">
              {type === "epics" && <EpicsList epics={epics} />}
              {type === "phases" && <PhasesList phases={phases} />}
              {type === "tasks" && <TasksList tasks={tasks} />}
            </ScrollShadow>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
