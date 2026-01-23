"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";

interface QuickActionsCardProps {
  githubUrl?: string;
  onEditProject: () => void;
}

export function QuickActionsCard({
  githubUrl,
  onEditProject,
}: QuickActionsCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="text-lg font-semibold">Quick Actions</h3>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-3">
        {githubUrl && (
          <Button
            fullWidth
            as={Link}
            color="default"
            href={githubUrl}
            target="_blank"
            variant="flat"
          >
            Open GitHub Repository
          </Button>
        )}
        <Button
          fullWidth
          color="primary"
          variant="flat"
          onPress={onEditProject}
        >
          Edit Project
        </Button>
      </CardBody>
    </Card>
  );
}
