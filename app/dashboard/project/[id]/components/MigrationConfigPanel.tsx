"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";

import {
  MigrationAction,
  StepAgentConfig,
  AGENT_PROVIDERS,
  OPENROUTER_MODELS,
  AgentProvider,
} from "@/domain/entities/MigrationAction";
import { ProcessorInfo } from "@/domain/entities/ProcessorInfo";
import { processorRepository } from "@/infrastructure/repositories/FirebaseProcessorRepository";
import { StepStatus } from "@/domain/entities/Project";
import {
  PROCESSING_STEPS,
  getStepLabel,
  getStepDescription,
} from "@/domain/entities/Project";

interface MigrationConfigPanelProps {
  migration: MigrationAction | null;
  onUpdateConfig: (data: Partial<MigrationAction>) => Promise<void>;
  onDelete?: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function MigrationConfigPanel({
  migration,
  onUpdateConfig,
  onDelete,
  isLoading = false,
  disabled = false,
}: MigrationConfigPanelProps) {
  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onOpenChange: onDeleteModalOpenChange,
  } = useDisclosure();
  const [selectedProvider, setSelectedProvider] = useState<
    AgentProvider | undefined
  >(migration?.defaultAgent?.provider);
  const [selectedModel, setSelectedModel] = useState<string>(
    migration?.defaultAgent?.model || OPENROUTER_MODELS[0].id
  );
  const [stepAgents, setStepAgents] = useState<Record<string, StepAgentConfig>>(
    migration?.stepAgents || {}
  );
  const [processorHost, setProcessorHost] = useState<string>(
    migration?.processorHost || ""
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
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync local state with migration prop when it changes
  useEffect(() => {
    setSelectedProvider(migration?.defaultAgent?.provider);
    setSelectedModel(migration?.defaultAgent?.model || OPENROUTER_MODELS[0].id);
    setStepAgents(migration?.stepAgents || {});
    // Only sync processorHost if migration has a value (don't reset to empty during save)
    if (migration?.processorHost) {
      setProcessorHost(migration.processorHost);
    }
  }, [migration]);

  const handleProcessorHostChange = useCallback(
    async (host: string) => {
      // Only update if we have a valid selection
      if (!host) return;
      setProcessorHost(host);
      await onUpdateConfig({ processorHost: host });
    },
    [onUpdateConfig]
  );

  const handleProviderChange = useCallback(
    async (provider: AgentProvider) => {
      setSelectedProvider(provider);
      const newAgent: StepAgentConfig = {
        provider,
        model: provider === "openrouter" ? selectedModel : undefined,
      };
      await onUpdateConfig({ defaultAgent: newAgent });
    },
    [selectedModel, onUpdateConfig]
  );

  const handleModelChange = useCallback(
    async (model: string) => {
      setSelectedModel(model);
      if (selectedProvider === "openrouter") {
        await onUpdateConfig({
          defaultAgent: { provider: "openrouter", model },
        });
      }
    },
    [selectedProvider, onUpdateConfig]
  );

  const handleClearStepAgents = useCallback(async () => {
    setStepAgents({});
    await onUpdateConfig({
      stepAgents: {},
    });
  }, [onUpdateConfig]);

  const handleStepAgentChange = useCallback(
    async (
      step: StepStatus,
      provider: AgentProvider | "default",
      model?: string
    ) => {
      const newStepAgents = { ...stepAgents };

      if (provider === "default") {
        // Remove custom agent for this step
        delete newStepAgents[step];
      } else {
        newStepAgents[step] = {
          provider,
          model: provider === "openrouter" ? model : undefined,
        };
      }

      setStepAgents(newStepAgents);
      await onUpdateConfig({ stepAgents: newStepAgents });
    },
    [stepAgents, onUpdateConfig]
  );

  const getStepAgentDisplay = (step: StepStatus): string => {
    const agent = stepAgents[step];
    if (!agent) return "Default";
    if (agent.provider === "claude") return "Claude Code";
    if (agent.provider === "openrouter" && agent.model) {
      const model = OPENROUTER_MODELS.find((m) => m.id === agent.model);
      return model?.name || agent.model;
    }
    return agent.provider;
  };

  const hasCustomStepAgents = Object.keys(stepAgents).length > 0;

  return (
    <div className="w-full space-y-6">
        {/* Processor Host */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Processor Host</h4>
          <Select
            label="Processor Host"
            placeholder="Select a processor"
            selectedKeys={processorHost ? new Set([processorHost]) : new Set()}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string;
              if (selected) {
                handleProcessorHostChange(selected);
              }
            }}
            isDisabled={disabled || isLoading}
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
                    <span className="font-medium">{processor.hostname}</span>
                    <span className="text-xs text-default-400">
                      {processor.ipAddress} - PID: {processor.pid}
                    </span>
                  </div>
                </SelectItem>
              ))}
          </Select>
        </div>

        <Divider />

        {/* Default Agent Selection */}
        <div className="space-y-4">
          <h4 className="text-md font-medium">Default AI Agent</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Agent Provider"
              placeholder="Select an agent provider"
              selectedKeys={selectedProvider ? [selectedProvider] : []}
              onChange={(e) =>
                handleProviderChange(e.target.value as AgentProvider)
              }
              isDisabled={disabled || isLoading}
              isRequired
            >
              {AGENT_PROVIDERS.map((provider) => (
                <SelectItem key={provider.id} textValue={provider.name}>
                  <div className="flex flex-col">
                    <span className="font-medium">{provider.name}</span>
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
                selectedKeys={[selectedModel]}
                onChange={(e) => handleModelChange(e.target.value)}
                isDisabled={disabled || isLoading}
              >
                {OPENROUTER_MODELS.map((model) => (
                  <SelectItem key={model.id} textValue={model.name}>
                    {model.name}
                  </SelectItem>
                ))}
              </Select>
            )}
          </div>
        </div>

        <Divider />

        {/* Per-Step Agent Configuration */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium">Per-Step Agent Override</h4>
              <p className="text-xs text-default-400">
                Configure a different AI agent for specific steps
              </p>
            </div>
            {hasCustomStepAgents && (
              <Button
                size="sm"
                variant="light"
                color="warning"
                onPress={handleClearStepAgents}
                isDisabled={disabled || isLoading}
              >
                Clear All
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {PROCESSING_STEPS.filter(
              (step) => !["clone", "clear_conversation"].includes(step)
            ).map((step) => {
              const stepLabelText = getStepLabel(step);
              const stepDescriptionText = getStepDescription(step);
              const stepAgent = stepAgents[step];
              const currentProvider = stepAgent?.provider || "default";

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
                        handleStepAgentChange(
                          step,
                          value,
                          value === "openrouter"
                            ? OPENROUTER_MODELS[0].id
                            : undefined
                        );
                      }}
                      isDisabled={disabled || isLoading}
                    >
                      {[
                        <SelectItem key="default" textValue="Default">
                          Default
                        </SelectItem>,
                        ...AGENT_PROVIDERS.map((provider) => (
                          <SelectItem
                            key={provider.id}
                            textValue={provider.name}
                          >
                            {provider.name}
                          </SelectItem>
                        )),
                      ]}
                    </Select>
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
                            e.target.value
                          )
                        }
                        isDisabled={disabled || isLoading}
                      >
                        {OPENROUTER_MODELS.map((model) => (
                          <SelectItem key={model.id} textValue={model.name}>
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

        {/* Delete Code Analysis */}
        {onDelete && (
          <>
            <Divider />
            <div className="pt-2">
              <Button
                color="danger"
                variant="flat"
                onPress={onDeleteModalOpen}
                isLoading={isLoading}
                isDisabled={disabled}
              >
                Delete Code Analysis
              </Button>
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        <Modal isOpen={isDeleteModalOpen} onOpenChange={onDeleteModalOpenChange}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Delete Code Analysis
                </ModalHeader>
                <ModalBody>
                  <p>
                    Are you sure you want to delete this code analysis? This action
                    cannot be undone.
                  </p>
                </ModalBody>
                <ModalFooter>
                  <Button color="default" variant="light" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    color="danger"
                    onPress={async () => {
                      onClose();
                      if (onDelete) {
                        await onDelete();
                      }
                    }}
                    isLoading={isLoading}
                  >
                    Yes, Delete Code Analysis
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
    </div>
  );
}
