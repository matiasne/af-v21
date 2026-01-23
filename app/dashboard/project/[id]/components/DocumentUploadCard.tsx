"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Chip } from "@heroui/chip";

import { ProjectDocument } from "@/domain/entities/Project";
import { FirebaseProjectRepository } from "@/infrastructure/repositories/FirebaseProjectRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

const projectRepository = new FirebaseProjectRepository();

interface DocumentUploadCardProps {
  projectId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getFileIcon(type: string): string {
  if (type.includes("pdf")) return "pdf";
  if (type.includes("word") || type.includes("document")) return "doc";
  if (type.includes("sheet") || type.includes("excel")) return "xls";
  if (type.includes("text") || type.includes("markdown")) return "txt";
  return "file";
}

export function DocumentUploadCard({ projectId }: DocumentUploadCardProps) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to documents
  useEffect(() => {
    if (!user?.uid || !projectId) return;

    const unsubscribe = projectRepository.subscribeToDocuments(
      user.uid,
      projectId,
      (docs) => setDocuments(docs)
    );

    return () => unsubscribe();
  }, [user?.uid, projectId]);

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !user?.uid) return;

      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          await projectRepository.uploadDocument(user.uid, projectId, file);
        }
      } catch (error) {
        console.error("Failed to upload document:", error);
      } finally {
        setUploading(false);
      }
    },
    [user?.uid, projectId]
  );

  const handleDelete = useCallback(
    async (documentId: string) => {
      if (!user?.uid) return;

      setDeleting(documentId);
      try {
        await projectRepository.deleteDocument(user.uid, projectId, documentId);
      } catch (error) {
        console.error("Failed to delete document:", error);
      } finally {
        setDeleting(null);
      }
    },
    [user?.uid, projectId]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleUpload(e.dataTransfer.files);
    },
    [handleUpload]
  );

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3">
        <div className="flex flex-col">
          <p className="text-md font-semibold">Project Documents</p>
          <p className="text-small text-default-500">
            Upload documentation files to start planning
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/10"
              : "border-default-300 hover:border-primary/50"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx"
          />
          <div className="flex flex-col items-center gap-2">
            <svg
              className="h-12 w-12 text-default-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            <p className="text-default-600">
              Drag and drop files here, or{" "}
              <button
                type="button"
                className="text-primary font-medium hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                browse
              </button>
            </p>
            <p className="text-xs text-default-400">
              PDF, Word, Excel, Text, Markdown files supported
            </p>
          </div>
        </div>

        {/* Uploading indicator */}
        {uploading && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm text-default-500">Uploading...</span>
          </div>
        )}

        {/* Document list */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-default-700">
              Uploaded Documents ({documents.length})
            </p>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-default-100 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-primary"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-default-400">
                        {formatFileSize(doc.size)}
                      </p>
                    </div>
                  </div>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="danger"
                    isLoading={deleting === doc.id}
                    onPress={() => handleDelete(doc.id)}
                  >
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
                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                      />
                    </svg>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {documents.length === 0 && !uploading && (
          <div className="text-center py-4">
            <p className="text-sm text-default-400">
              No documents uploaded yet. Upload your project documentation to get started.
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
