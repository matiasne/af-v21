"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";

import { useMigration } from "@/infrastructure/hooks/useMigration";

interface FilesCardProps {
  projectId: string;
  onNavigateToFiles: () => void;
}

export function FilesCard({ projectId, onNavigateToFiles }: FilesCardProps) {
  const { migration, loading } = useMigration(projectId);

  const ragStoreName = migration?.ragFunctionalAndBusinessStoreName;
  const hasRagStore = !!ragStoreName;

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning-100 dark:bg-warning-900/30">
            <svg
              className="h-5 w-5 text-warning"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Indexed Files</h3>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner color="primary" />
          </div>
        ) : !hasRagStore ? (
          <div className="text-center py-6">
            <div className="mb-4">
              <svg
                className="h-12 w-12 mx-auto text-default-300"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                viewBox="0 0 24 24"
              >
                <path
                  d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-default-500 text-sm mb-4">
              RAG store not created yet
            </p>
            <p className="text-default-400 text-xs mb-4">
              Files will be indexed during the migration process
            </p>
            <Button color="primary" variant="flat" onPress={onNavigateToFiles}>
              Learn More
            </Button>
          </div>
        ) : (
          <>
            {/* Files Overview */}
            <div className="space-y-3">
              {/* RAG Store Info */}
              <div className="bg-warning-50 dark:bg-warning-900/20 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="h-5 w-5 text-warning-600 dark:text-warning-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="text-sm font-medium text-warning-600 dark:text-warning-400">
                    RAG Store Name
                  </span>
                </div>
                <p className="text-xs text-default-600 dark:text-default-400 truncate font-mono mt-1">
                  {ragStoreName}
                </p>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-2 p-3 bg-success-50 dark:bg-success-900/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <p className="text-xs text-success-600 dark:text-success-400">
                  RAG store configured and ready
                </p>
              </div>
            </div>

            {/* View Files Button */}
            <Button
              fullWidth
              color="primary"
              variant="flat"
              onPress={onNavigateToFiles}
            >
              View Indexed Files
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
