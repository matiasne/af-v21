"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";

import {
  AGENT_PROVIDERS,
  OPENROUTER_MODELS,
  CLAUDE_MODELS,
  AgentProvider,
  StepAgentConfig,
} from "@/domain/entities/MigrationAction";
import { ProcessorInfo } from "@/domain/entities/ProcessorInfo";
import { processorRepository } from "@/infrastructure/repositories/FirebaseProcessorRepository";
import { StepStatus, UIType } from "@/domain/entities/Project";
import {
  PROCESSING_STEPS,
  getStepLabel,
  getStepDescription,
} from "@/domain/entities/Project";

interface ProjectConfigModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  uiType?: UIType;
  // Migration config props
  migration?: {
    processorHost?: string;
    defaultAgent?: StepAgentConfig;
    stepAgents?: Record<string, StepAgentConfig>;
  } | null;
  onUpdateMigrationConfig?: (data: {
    processorHost?: string;
    defaultAgent?: StepAgentConfig;
    stepAgents?: Record<string, StepAgentConfig>;
  }) => Promise<void>;
  onDeleteProject?: () => Promise<void>;
}

export function ProjectConfigModal({
  isOpen,
  onOpenChange,
  projectName,
  uiType = "migration",
  migration,
  onUpdateMigrationConfig,
  onDeleteProject,
}: ProjectConfigModalProps) {
  // For start_from_doc, only show Processor Host, Default AI Agent, and Danger Zone
  const isSimplifiedConfig = uiType === "start_from_doc";
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Migration config state
  const [selectedProvider, setSelectedProvider] = useState<
    AgentProvider | undefined
  >(migration?.defaultAgent?.provider);
  const [selectedAgentModel, setSelectedAgentModel] = useState<string>(
    migration?.defaultAgent?.model || OPENROUTER_MODELS[0].id,
  );
  const [stepAgents, setStepAgents] = useState<Record<string, StepAgentConfig>>(
    migration?.stepAgents || {},
  );
  const [processorHost, setProcessorHost] = useState<string>(
    migration?.processorHost || "",
  );
  const [processors, setProcessors] = useState<ProcessorInfo[]>([]);

  // Fetch processors from Firebase
  useEffect(() => {
    const unsubscribe = processorRepository.subscribeProcessors(
      (updatedProcessors) => {
        setProcessors(updatedProcessors);
      },
      (error) => {
        console.error("Error fetching processors:", error);
      },
    );

    return () => unsubscribe();
  }, []);

  // Sync migration config with prop changes
  useEffect(() => {
    setSelectedProvider(migration?.defaultAgent?.provider);
    setSelectedAgentModel(
      migration?.defaultAgent?.model || OPENROUTER_MODELS[0].id,
    );
    setStepAgents(migration?.stepAgents || {});
    if (migration?.processorHost) {
      setProcessorHost(migration.processorHost);
    }
  }, [migration]);

  const handleProcessorHostChange = useCallback(
    async (host: string) => {
      if (!host || !onUpdateMigrationConfig) return;
      setProcessorHost(host);
      await onUpdateMigrationConfig({ processorHost: host });
    },
    [onUpdateMigrationConfig],
  );

  const handleProviderChange = useCallback(
    async (provider: AgentProvider) => {
      if (!onUpdateMigrationConfig) return;
      setSelectedProvider(provider);
      const defaultModel =
        provider === "openrouter"
          ? OPENROUTER_MODELS[0].id
          : provider === "claude"
            ? CLAUDE_MODELS[0].id
            : undefined;
      setSelectedAgentModel(defaultModel || OPENROUTER_MODELS[0].id);
      await onUpdateMigrationConfig({
        defaultAgent: { provider, model: defaultModel },
      });
    },
    [onUpdateMigrationConfig],
  );

  const handleAgentModelChange = useCallback(
    async (model: string) => {
      if (!selectedProvider || !onUpdateMigrationConfig) return;
      setSelectedAgentModel(model);
      await onUpdateMigrationConfig({
        defaultAgent: { provider: selectedProvider, model },
      });
    },
    [selectedProvider, onUpdateMigrationConfig],
  );

  const handleClearStepAgents = useCallback(async () => {
    if (!onUpdateMigrationConfig) return;
    setStepAgents({});
    await onUpdateMigrationConfig({ stepAgents: {} });
  }, [onUpdateMigrationConfig]);

  const handleStepAgentChange = useCallback(
    async (
      step: StepStatus,
      provider: AgentProvider | "default",
      model?: string,
    ) => {
      if (!onUpdateMigrationConfig) return;
      const newStepAgents = { ...stepAgents };

      if (provider === "default") {
        delete newStepAgents[step];
      } else {
        newStepAgents[step] = {
          provider,
          model:
            provider === "openrouter" || provider === "claude"
              ? model
              : undefined,
        };
      }

      setStepAgents(newStepAgents);
      await onUpdateMigrationConfig({ stepAgents: newStepAgents });
    },
    [stepAgents, onUpdateMigrationConfig],
  );

  const hasCustomStepAgents = Object.keys(stepAgents).length > 0;

  const handleDeleteProject = useCallback(async () => {
    if (!onDeleteProject) return;
    setIsDeleting(true);
    try {
      await onDeleteProject();
    } catch (error) {
      console.error("Error deleting project:", error);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [onDeleteProject]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold">Project Configuration</h3>
              <p className="text-sm text-default-500 font-normal">
                {projectName}
              </p>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                {onUpdateMigrationConfig && (
                  <>
                    {/* Processor Host */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium">Processor Host</h4>
                      <Select
                        label="Processor Host"
                        placeholder="Select a processor"
                        selectedKeys={
                          processorHost ? new Set([processorHost]) : new Set()
                        }
                        onSelectionChange={(keys) => {
                          const selected = Array.from(keys)[0] as string;
                          if (selected) {
                            handleProcessorHostChange(selected);
                          }
                        }}
                        isDisabled={isLoading}
                        description={
                          processors.length === 0
                            ? "No processors available. Make sure a processor is running."
                            : "Select the processor server that will handle the migration"
                        }
                      >
                        {processors
                          .filter((p) => p.status === "running")
                          .map((processor) => (
                            <SelectItem
                              key={processor.hostname}
                              textValue={processor.hostname}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {processor.hostname}
                                </span>
                                <span className="text-xs text-default-400">
                                  {processor.ipAddress} - PID: {processor.pid}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </Select>
                    </div>

                    <Divider />

                    {/* Default AI Agent */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-md font-medium">Default AI Agent</h4>
                        <p className="text-xs text-default-400">
                          Select the default AI agent for processing migration
                          steps
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <Select
                          label="Provider"
                          placeholder="Select provider"
                          selectedKeys={
                            selectedProvider ? [selectedProvider] : []
                          }
                          onChange={(e) =>
                            handleProviderChange(e.target.value as AgentProvider)
                          }
                          isDisabled={isLoading}
                          className="flex-1"
                        >
                          {AGENT_PROVIDERS.map((provider) => (
                            <SelectItem
                              key={provider.id}
                              textValue={provider.name}
                            >
                              <div className="flex flex-col">
                                <span>{provider.name}</span>
                                <span className="text-xs text-default-400">
                                  {provider.description}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </Select>
                        {selectedProvider === "openrouter" && (
                          <Select
                            label="Model"
                            placeholder="Select model"
                            selectedKeys={[selectedAgentModel]}
                            onChange={(e) =>
                              handleAgentModelChange(e.target.value)
                            }
                            isDisabled={isLoading}
                            className="flex-1"
                          >
                            {OPENROUTER_MODELS.map((model) => (
                              <SelectItem key={model.id} textValue={model.name}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </Select>
                        )}
                        {selectedProvider === "claude" && (
                          <Select
                            label="Model"
                            placeholder="Select model"
                            selectedKeys={[selectedAgentModel]}
                            onChange={(e) =>
                              handleAgentModelChange(e.target.value)
                            }
                            isDisabled={isLoading}
                            className="flex-1"
                          >
                            {CLAUDE_MODELS.map((model) => (
                              <SelectItem key={model.id} textValue={model.name}>
                                {model.name}
                              </SelectItem>
                            ))}
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Per-Step Agent Configuration - only for migration type */}
                    {!isSimplifiedConfig && (
                      <>
                        <Divider />

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-md font-medium">
                                Per-Step AI Agent Configuration
                              </h4>
                              <p className="text-xs text-default-400">
                                Configure the AI agent for each step (Claude Code is
                                the default)
                              </p>
                            </div>
                            {hasCustomStepAgents && (
                              <Button
                                size="sm"
                                variant="light"
                                color="warning"
                                onPress={handleClearStepAgents}
                                isDisabled={isLoading}
                              >
                                Clear All
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {PROCESSING_STEPS.filter(
                              (step) =>
                                !["clone", "clear_conversation"].includes(step),
                            ).map((step) => {
                              const stepLabelText = getStepLabel(step);
                              const stepDescriptionText = getStepDescription(step);
                              const stepAgent = stepAgents[step];
                              const currentProvider =
                                stepAgent?.provider || "default";

                              return (
                                <div
                                  key={step}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-content2"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">
                                      {stepLabelText}
                                    </p>
                                    <p className="text-xs text-default-400 truncate">
                                      {stepDescriptionText}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Select
                                      size="sm"
                                      label="Agent"
                                      className="w-40"
                                      selectedKeys={[currentProvider]}
                                      onChange={(e) => {
                                        const value = e.target.value as
                                          | AgentProvider
                                          | "default";
                                        const defaultModel =
                                          value === "openrouter"
                                            ? OPENROUTER_MODELS[0].id
                                            : value === "claude"
                                              ? CLAUDE_MODELS[0].id
                                              : undefined;
                                        handleStepAgentChange(
                                          step,
                                          value,
                                          defaultModel,
                                        );
                                      }}
                                      isDisabled={isLoading}
                                    >
                                      {[
                                        { id: "default", name: "Default" },
                                        ...AGENT_PROVIDERS,
                                      ].map((provider) => (
                                        <SelectItem
                                          key={provider.id}
                                          textValue={provider.name}
                                        >
                                          {provider.name}
                                        </SelectItem>
                                      ))}
                                    </Select>
                                    {stepAgent?.provider === "claude" && (
                                      <Select
                                        size="sm"
                                        label="Model"
                                        className="w-44"
                                        selectedKeys={
                                          stepAgent.model ? [stepAgent.model] : []
                                        }
                                        onChange={(e) =>
                                          handleStepAgentChange(
                                            step,
                                            "claude",
                                            e.target.value,
                                          )
                                        }
                                        isDisabled={isLoading}
                                      >
                                        {CLAUDE_MODELS.map((model) => (
                                          <SelectItem
                                            key={model.id}
                                            textValue={model.name}
                                          >
                                            {model.name}
                                          </SelectItem>
                                        ))}
                                      </Select>
                                    )}
                                    {stepAgent?.provider === "openrouter" && (
                                      <Select
                                        size="sm"
                                        label="Model"
                                        className="w-44"
                                        selectedKeys={
                                          stepAgent.model ? [stepAgent.model] : []
                                        }
                                        onChange={(e) =>
                                          handleStepAgentChange(
                                            step,
                                            "openrouter",
                                            e.target.value,
                                          )
                                        }
                                        isDisabled={isLoading}
                                      >
                                        {OPENROUTER_MODELS.map((model) => (
                                          <SelectItem
                                            key={model.id}
                                            textValue={model.name}
                                          >
                                            {model.name}
                                          </SelectItem>
                                        ))}
                                      </Select>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Danger Zone */}
                {onDeleteProject && (
                  <>
                    <Divider />
                    <div className="space-y-4">
                      <h4 className="text-md font-medium text-danger">
                        Danger Zone
                      </h4>
                      {!showDeleteConfirm ? (
                        <div className="flex items-center justify-between p-4 rounded-lg border border-danger-200 dark:border-danger-800 bg-danger-50/50 dark:bg-danger-900/20">
                          <div>
                            <p className="text-sm font-medium text-danger-600 dark:text-danger-400">
                              Delete this project
                            </p>
                            <p className="text-xs text-default-500">
                              This action cannot be undone. All project data
                              will be permanently deleted.
                            </p>
                          </div>
                          <Button
                            color="danger"
                            variant="flat"
                            onPress={() => setShowDeleteConfirm(true)}
                          >
                            Delete Project
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border border-danger-500 bg-danger-50 dark:bg-danger-900/30">
                          <div className="flex items-center gap-2 mb-3">
                            <svg
                              className="h-5 w-5 text-danger"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                              />
                            </svg>
                            <p className="text-sm font-semibold text-danger">
                              Are you sure you want to delete this project?
                            </p>
                          </div>
                          <p className="text-sm text-danger-600 dark:text-danger-400 mb-4">
                            This will permanently delete{" "}
                            <strong>{projectName}</strong> and all associated
                            data including FDD documents, migration plans, and
                            task boards.
                          </p>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="flat"
                              onPress={() => setShowDeleteConfirm(false)}
                              isDisabled={isDeleting}
                            >
                              Cancel
                            </Button>
                            <Button
                              color="danger"
                              onPress={handleDeleteProject}
                              isLoading={isDeleting}
                            >
                              Yes, Delete Project
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
