"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";

interface FileExtensionsCardProps {
  extensions: string[];
}

export function FileExtensionsCard({ extensions }: FileExtensionsCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="text-lg font-semibold">File Extensions Detected</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        {extensions.length === 0 ? (
          <p className="text-sm text-default-400 italic">
            No file extensions detected yet
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {extensions.map((ext) => (
              <Chip key={ext} color="secondary" size="sm" variant="flat">
                {ext}
              </Chip>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
