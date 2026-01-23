"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { Project } from "@/domain/entities/Project";
import { RAGFile, RAGCorpus } from "@/domain/entities/RAGFile";

interface RAGFilesResponse {
  corpus: RAGCorpus | null;
  documents: RAGFile[];
  count: number;
}

export default function FilesPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const {
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    setPageTitle,
  } = useProjectChat();

  const [project, setProject] = useState<Project | null>(null);
  const [corpus, setCorpus] = useState<RAGCorpus | null>(null);
  const [files, setFiles] = useState<RAGFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<RAGFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const projectId = params.id as string;
  const { migration } = useMigration(projectId);

  // Set page title
  useEffect(() => {
    setPageTitle("RAG Files");
    return () => setPageTitle(null);
  }, [setPageTitle]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Find the project
  useEffect(() => {
    if (projects.length > 0 && projectId) {
      const foundProject = projects.find((p) => p.id === projectId);
      if (foundProject) {
        setProject(foundProject);
      } else {
        router.push("/dashboard");
      }
    }
  }, [projects, projectId, router]);

  // Sync project context with layout
  useEffect(() => {
    if (project) {
      setProjectContext({
        name: project.name,
        description: project.description,
        status: project.status?.step || "unknown",
        githubUrl: project.githubUrl,
      });
      setCurrentProjectId(project.id || null);
    }
  }, [project, setProjectContext, setCurrentProjectId]);

  // Set configuration mode to false for files page
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Fetch RAG files
  const fetchFiles = useCallback(async () => {
    const ragStoreName = migration?.ragFunctionalAndBusinessStoreName;

    if (!ragStoreName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Fetching files for corpus:", ragStoreName);
      const response = await fetch(
        `/api/rag/files?corpusName=${encodeURIComponent(ragStoreName)}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.error || "Failed to fetch files");
      }

      const data: RAGFilesResponse = await response.json();
      console.log("API response data:", data);
      console.log("Documents count:", data.documents?.length || 0);
      console.log("Documents:", data.documents);

      setCorpus(data.corpus);
      setFiles(data.documents || []);
      setFilteredFiles(data.documents || []);
    } catch (err) {
      console.error("Error fetching RAG files:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  }, [migration?.ragFunctionalAndBusinessStoreName]);

  useEffect(() => {
    if (migration?.ragFunctionalAndBusinessStoreName) {
      fetchFiles();
    } else {
      setLoading(false);
    }
  }, [migration?.ragFunctionalAndBusinessStoreName, fetchFiles]);

  // Filter files based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFiles(files);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredFiles(
        files.filter(
          (file) =>
            file.displayName.toLowerCase().includes(query) ||
            file.name.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, files]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading || projectsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  if (!user || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner color="primary" size="lg" />
      </div>
    );
  }

  const ragStoreName = migration?.ragFunctionalAndBusinessStoreName;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-default-500">{project.name}</h2>
        {corpus && (
          <Chip size="sm" variant="flat" color="secondary">
            {corpus.displayName || "RAG Store"}
          </Chip>
        )}
      </div>

      {/* Store Info */}
      {corpus && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Indexed Files</h1>
          <p className="text-sm text-default-400">
            {files.length} document{files.length !== 1 ? "s" : ""} indexed in
            Gemini File Search
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner color="primary" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              className="h-16 w-16 mx-auto text-danger-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-danger-500 mb-4">{error}</p>
          <Button color="primary" variant="flat" onPress={fetchFiles}>
            Retry
          </Button>
        </div>
      ) : !ragStoreName ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              className="h-16 w-16 mx-auto text-default-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </div>
          <p className="text-default-500 mb-4">
            No RAG store has been created yet. Files will be indexed during the
            migration process after the &quot;Upload to RAG&quot; step completes.
          </p>
          <Button
            color="primary"
            variant="flat"
            onPress={() => router.push(`/dashboard/project/${projectId}/migration`)}
          >
            Go to Migration
          </Button>
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12">
          <div className="mb-4">
            <svg
              className="h-16 w-16 mx-auto text-default-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
          </div>
          <p className="text-default-500 mb-2">
            No documents indexed yet
          </p>
          <p className="text-default-400 text-sm mb-4">
            The RAG store has been created, but files haven&apos;t been uploaded yet.
            <br />
            Files will be indexed when the migration reaches the file upload step.
          </p>
          <Button
            color="primary"
            variant="flat"
            onPress={() => router.push(`/dashboard/project/${projectId}/migration`)}
          >
            View Migration Progress
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Search */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              startContent={
                <svg
                  className="h-4 w-4 text-default-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              }
              isClearable
              onClear={() => setSearchQuery("")}
              className="max-w-md"
            />
            <span className="text-sm text-default-400">
              {filteredFiles.length} of {files.length} files
            </span>
          </div>

          {/* Files List */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Documents</h2>
            </CardHeader>
            <Divider />
            <CardBody className="p-0">
              <div className="divide-y divide-default-100">
                {filteredFiles.map((file) => (
                  <div
                    key={file.name}
                    className="p-4 hover:bg-default-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <svg
                            className="h-4 w-4 text-default-400 flex-shrink-0"
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
                          <p className="font-medium truncate">
                            {file.displayName || file.name.split("/").pop()}
                          </p>
                        </div>
                        <p className="text-xs text-default-400 font-mono truncate">
                          {file.name}
                        </p>
                        {file.customMetadata &&
                          Object.keys(file.customMetadata).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {Object.entries(file.customMetadata).map(
                                ([key, value]) => (
                                  <Chip
                                    key={key}
                                    size="sm"
                                    variant="flat"
                                    className="text-xs"
                                  >
                                    {key}: {value}
                                  </Chip>
                                )
                              )}
                            </div>
                          )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-default-400">
                          {formatDate(file.createTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Corpus Info */}
          {corpus && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Store Information</h2>
              </CardHeader>
              <Divider />
              <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-default-400">Store Name</p>
                    <p className="font-mono text-sm truncate">{corpus.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-400">Display Name</p>
                    <p className="text-sm">{corpus.displayName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-400">Created</p>
                    <p className="text-sm">{formatDate(corpus.createTime)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-default-400">Last Updated</p>
                    <p className="text-sm">{formatDate(corpus.updateTime)}</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
