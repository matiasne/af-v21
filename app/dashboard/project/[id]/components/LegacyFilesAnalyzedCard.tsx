"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";

interface LegacyFilesAnalyzedCardProps {
  filesCount: number;
  isLoading?: boolean;
}

export function LegacyFilesAnalyzedCard({
  filesCount,
  isLoading = false,
}: LegacyFilesAnalyzedCardProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <h3 className="text-lg font-semibold">Legacy Files Analyzed</h3>
      </CardHeader>
      <Divider />
      <CardBody>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size="sm" color="primary" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
              <svg
                className="w-6 h-6 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">{filesCount}</p>
              <p className="text-sm text-default-500">
                {filesCount === 1 ? "file" : "files"} indexed
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
