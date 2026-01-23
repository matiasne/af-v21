"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Button } from "@heroui/button";

import { getTechIcon } from "./techIcons";

interface NewTechStackCardProps {
  newTechStack?: string[];
  canSelect?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onNavigateToConfig?: () => void;
  isDisabled?: boolean;
}

export function NewTechStackCard({
  newTechStack,
  canSelect = false,
  onSelect,
  onEdit,
  onNavigateToConfig,
  isDisabled = false,
}: NewTechStackCardProps) {
  const isEmpty = !newTechStack || newTechStack.length === 0;

  // Determine which handler to use for the edit/select action
  const editHandler = onEdit || onNavigateToConfig;

  return (
    <Card className="h-full">
      <CardHeader className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">New Tech Stack</h3>
        <div className="flex gap-2">
          {isEmpty && canSelect && onSelect && (
            <Button
              color="primary"
              size="sm"
              onPress={onSelect}
              isDisabled={isDisabled}
            >
              Select
            </Button>
          )}

          {editHandler && (
            <Button
              color="default"
              size="sm"
              variant="flat"
              onPress={editHandler}
              isDisabled={isDisabled}
              startContent={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                  />
                </svg>
              }
            >
              {isEmpty ? "Configure" : "Edit"}
            </Button>
          )}
        </div>
      </CardHeader>
      <Divider />
      <CardBody>
        {isEmpty ? (
          <p className="text-sm text-default-400 italic">
            {canSelect
              ? isDisabled
                ? "Tech stack cannot be changed after analysis has started"
                : "Select your target tech stack"
              : "No tech stack selected yet"}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {newTechStack.map((tech) => {
                const { icon: Icon, color } = getTechIcon(tech);
                return (
                  <Chip
                    key={tech}
                    startContent={<Icon className="ml-1" style={{ color }} />}
                    variant="flat"
                  >
                    {tech}
                  </Chip>
                );
              })}
            </div>
            {isDisabled && (
              <p className="text-xs text-default-400 mt-3">
                Tech stack cannot be changed after analysis has started
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
