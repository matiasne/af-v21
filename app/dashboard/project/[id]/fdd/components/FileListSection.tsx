"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";

import { FileAnalysisModal } from "./FileAnalysisModal";

import { AnalyzedFile } from "@/domain/entities/FileAnalysis";
import { fileAnalysisRepository } from "@/infrastructure/repositories/FirebaseFileAnalysisRepository";

const PAGE_SIZE = 20;

interface FileListSectionProps {
  userId: string;
  projectId: string;
  migrationId: string;
}

export function FileListSection({
  userId,
  projectId,
  migrationId,
}: FileListSectionProps) {
  const [files, setFiles] = useState<AnalyzedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<AnalyzedFile | null>(null);
  const [skippingFileId, setSkippingFileId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId || !projectId || !migrationId) {
      console.log("FileListSection: Missing required params", {
        userId,
        projectId,
        migrationId,
      });
      setFiles([]);
      setLoading(false);

      return;
    }

    console.log("FileListSection: Subscribing to files with params:", {
      projectId,
      migrationId,
    });
    setLoading(true);

    const unsubscribe = fileAnalysisRepository.subscribeFiles(
      projectId,
      migrationId,
      (updatedFiles) => {
        console.log(
          "FileListSection: Received files update:",
          updatedFiles.length,
          "files",
        );
        setFiles(updatedFiles);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to files:", error);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [projectId, migrationId]);

  const filteredFiles = useMemo(
    () =>
      files.filter(
        (file) =>
          file.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.filePath.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [files, searchQuery],
  );

  // Reset display count when search query changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [searchQuery]);

  // Visible files based on lazy loading
  const visibleFiles = useMemo(
    () => filteredFiles.slice(0, displayCount),
    [filteredFiles, displayCount],
  );

  const hasMore = displayCount < filteredFiles.length;

  // Load more files function
  const loadMore = useCallback(() => {
    if (hasMore) {
      setDisplayCount((prev) =>
        Math.min(prev + PAGE_SIZE, filteredFiles.length),
      );
    }
  }, [hasMore, filteredFiles.length]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loader = loaderRef.current;

    if (!loader || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
    );

    observer.observe(loader);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore]);

  const getEnrichmentStatus = (file: AnalyzedFile) => {
    if (!file.fddEnrichment) {
      return {
        status: "not_enriched",
        label: "Not Enriched",
        color: "default" as const,
      };
    }

    // Check if file was skipped
    if ((file.fddEnrichment as any).action === "skipped") {
      return { status: "skipped", label: "Skipped", color: "warning" as const };
    }

    // If file has enrichment data, it's enriched
    return { status: "enriched", label: "Enriched", color: "success" as const };
  };

  const handleSkipFile = useCallback(
    async (e: React.MouseEvent, fileId: string) => {
      e.stopPropagation();
      setSkippingFileId(fileId);
      try {
        await fileAnalysisRepository.skipFile(projectId, migrationId, fileId);
      } catch (error) {
        console.error("Error skipping file:", error);
      } finally {
        setSkippingFileId(null);
      }
    },
    [userId, projectId, migrationId],
  );

  const handleFileClick = (file: AnalyzedFile) => {
    setSelectedFile(file);
  };

  const handleCloseModal = () => {
    setSelectedFile(null);
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-col items-start gap-2">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-xl font-semibold">
              Analyzed Files ({files.length})
            </h2>
          </div>
          <Input
            classNames={{
              base: "w-full",
              input: "text-sm",
            }}
            placeholder="Search files..."
            size="sm"
            startContent={
              <svg
                className="h-4 w-4 text-default-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            value={searchQuery}
            variant="bordered"
            onValueChange={setSearchQuery}
          />
        </CardHeader>
        <Divider />
        <CardBody>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner color="primary" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-default-400">
                {searchQuery
                  ? "No files found matching your search"
                  : "No analyzed files yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleFiles.map((file) => {
                const enrichmentStatus = getEnrichmentStatus(file);

                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-default-200 hover:border-primary hover:bg-default-50 cursor-pointer transition-all"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-4 w-4 flex-shrink-0 text-default-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {file.fileName}
                          </p>
                          <p className="text-xs text-default-400 truncate">
                            {file.filePath}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {file.fileType && (
                        <Chip size="sm" variant="flat">
                          {file.fileType}
                        </Chip>
                      )}
                      {file.hasBusinessAnalysis && (
                        <Chip color="secondary" size="sm" variant="flat">
                          Business
                        </Chip>
                      )}
                      {file.hasFunctionalAnalysis && (
                        <Chip color="primary" size="sm" variant="flat">
                          Functional
                        </Chip>
                      )}
                      {file.hasUserComments && (
                        <Chip color="warning" size="sm" variant="flat">
                          Comments
                        </Chip>
                      )}
                      <Chip
                        color={enrichmentStatus.color}
                        size="sm"
                        variant="flat"
                      >
                        {enrichmentStatus.label}
                      </Chip>
                      {enrichmentStatus.status === "not_enriched" && (
                        <Button
                          color="warning"
                          isLoading={skippingFileId === file.id}
                          size="sm"
                          variant="flat"
                          onPress={(e) => handleSkipFile(e as any, file.id)}
                        >
                          Skip FDD Enrichment
                        </Button>
                      )}
                      <svg
                        className="h-4 w-4 flex-shrink-0 text-default-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                );
              })}
              {/* Lazy loading trigger */}
              {hasMore && (
                <div
                  ref={loaderRef}
                  className="flex flex-col items-center justify-center py-4 gap-2"
                >
                  <span className="text-sm text-default-400">
                    Showing {visibleFiles.length} of {filteredFiles.length}{" "}
                    files
                  </span>
                  <Button
                    color="primary"
                    size="sm"
                    variant="flat"
                    onPress={loadMore}
                  >
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* File Analysis Modal */}
      {selectedFile && (
        <FileAnalysisModal
          fileId={selectedFile.id}
          fileName={selectedFile.fileName}
          isOpen={!!selectedFile}
          migrationId={migrationId}
          projectId={projectId}
          userId={userId}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
