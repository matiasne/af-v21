"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Link } from "@heroui/link";

interface ProjectDetailsCardProps {
  createdAt: number;
  updatedAt: number;
  githubUrl?: string;
  formatDate: (timestamp: number) => string;
}

export function ProjectDetailsCard({
  createdAt,
  updatedAt,
  githubUrl,
  formatDate,
}: ProjectDetailsCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="text-lg font-semibold">Project Details</h3>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        <div>
          <p className="text-sm text-default-500">Created</p>
          <p>{formatDate(createdAt)}</p>
        </div>
        <div>
          <p className="text-sm text-default-500">Last Updated</p>
          <p>{formatDate(updatedAt)}</p>
        </div>
        {githubUrl && (
          <div>
            <p className="text-sm text-default-500">
              Base GitHub Repository (Legacy)
            </p>
            <Link isExternal showAnchorIcon href={githubUrl}>
              {githubUrl}
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
