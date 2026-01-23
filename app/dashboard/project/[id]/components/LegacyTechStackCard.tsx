"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";

import { getTechIcon } from "./techIcons";
import { GradientBorderWrapper } from "./GradientBorderWrapper";

interface LegacyTechStackCardProps {
  legacyTechStack?: string[];
  isQueue?: boolean;
}

export function LegacyTechStackCard({
  legacyTechStack,
  isQueue = false,
}: LegacyTechStackCardProps) {
  const isDisabled = !legacyTechStack || legacyTechStack.length === 0;

  return (
    <GradientBorderWrapper isActive={isQueue && isDisabled}>
      <Card
        className={`h-full ${isDisabled ? "opacity-50" : ""}`}
        isDisabled={isDisabled}
      >
        <CardHeader>
          <h3 className="text-lg font-semibold">Legacy Tech Stack</h3>
        </CardHeader>
        <Divider />
        <CardBody>
          {isDisabled ? (
            <p className="text-sm text-default-400 italic">
              Tech stack analysis not yet available
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {legacyTechStack.map((tech) => {
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
          )}
        </CardBody>
      </Card>
    </GradientBorderWrapper>
  );
}
