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
import { Card, CardBody } from "@heroui/card";

import { UIType, UI_TYPE_CONFIGS } from "@/domain/entities/Project";

interface UITypeSelectionModalProps {
  isOpen: boolean;
  onSelect: (uiType: UIType) => void;
  isLoading?: boolean;
}

const UI_TYPE_ICONS: Record<UIType, React.ReactNode> = {
  migration: (
    <svg
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
      />
    </svg>
  ),
  start_from_doc: (
    <svg
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  ),
  chat_planning: (
    <svg
      className="h-8 w-8"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>
  ),
};

export function UITypeSelectionModal({
  isOpen,
  onSelect,
  isLoading = false,
}: UITypeSelectionModalProps) {
  const [selectedType, setSelectedType] = useState<UIType | null>(null);

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType);
    }
  };

  const uiTypes: UIType[] = ["migration", "start_from_doc", "chat_planning"];

  return (
    <Modal
      isOpen={isOpen}
      hideCloseButton
      isDismissable={false}
      size="2xl"
      classNames={{
        backdrop: "bg-black/50 backdrop-blur-sm",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">Choose Your Workflow</h2>
          <p className="text-sm font-normal text-default-500">
            Select how you want to work with this project
          </p>
        </ModalHeader>
        <ModalBody>
          <div className="grid gap-4">
            {uiTypes.map((type) => {
              const config = UI_TYPE_CONFIGS[type];
              const isSelected = selectedType === type;

              return (
                <Card
                  key={type}
                  isPressable
                  isHoverable
                  className={`transition-all ${
                    isSelected
                      ? "border-2 border-primary bg-primary-50 dark:bg-primary-900/20"
                      : "border-2 border-transparent"
                  }`}
                  onPress={() => setSelectedType(type)}
                >
                  <CardBody className="flex flex-row items-center gap-4 p-4">
                    <div
                      className={`flex-shrink-0 p-3 rounded-lg ${
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-default-100 text-default-500"
                      }`}
                    >
                      {UI_TYPE_ICONS[type]}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{config.label}</h3>
                      <p className="text-sm text-default-500">
                        {config.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0">
                        <svg
                          className="h-6 w-6 text-primary"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            fillRule="evenodd"
                            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button
            color="primary"
            isDisabled={!selectedType}
            isLoading={isLoading}
            onPress={handleConfirm}
          >
            Continue
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
