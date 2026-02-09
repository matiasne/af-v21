"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody } from "@heroui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";

export default function FDDDocViewerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const {
    setProjectContext,
    setCurrentProjectId,
    setIsConfiguration,
    setPageTitle,
  } = useProjectChat();
  const [project, setProject] = useState<Project | null>(null);
  const [markdownContent, setMarkdownContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectId = params.id as string;

  // Get document info from query params
  const docUrl = searchParams.get("url");
  const title = searchParams.get("title") || "Document";
  const sectionNumber = searchParams.get("section") || "";

  // Set page title
  useEffect(() => {
    setPageTitle(`FDD: ${title}`);

    return () => setPageTitle(null);
  }, [setPageTitle, title]);

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

  // Set configuration mode to false
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Fetch markdown content from the provided URL
  useEffect(() => {
    if (!docUrl) {
      setContentLoading(false);

      return;
    }

    const fetchContent = async () => {
      setContentLoading(true);
      setError(null);

      try {
        const response = await fetch(docUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const content = await response.text();

        setMarkdownContent(content);
      } catch (err) {
        console.error("Error fetching markdown:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load document",
        );
      } finally {
        setContentLoading(false);
      }
    };

    fetchContent();
  }, [docUrl]);

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

  if (!docUrl) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No document URL specified.</p>
          <Button
            color="primary"
            variant="flat"
            onPress={() => router.push(`/dashboard/project/${projectId}/fdd`)}
          >
            Back to FDD
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Button
          className="mb-4"
          size="sm"
          variant="light"
          onPress={() => router.push(`/dashboard/project/${projectId}/fdd`)}
        >
          ← Back to FDD
        </Button>
        <div className="flex items-center gap-3">
          {sectionNumber && (
            <span className="text-2xl font-mono text-secondary">
              {sectionNumber}
            </span>
          )}
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <p className="text-sm text-default-400 mt-1">{project.name}</p>
      </div>

      {/* Content */}
      <Card>
        <CardBody className="p-6">
          {contentLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner color="secondary" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <svg
                  className="h-12 w-12 mx-auto text-danger"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-danger mb-2">Failed to load document</p>
              <p className="text-sm text-default-400 mb-4">{error}</p>
              <p className="text-xs text-default-400">
                The document may not have been generated yet. Run the
                &quot;Generate Legacy FDD&quot; step in the migration process.
              </p>
            </div>
          ) : !markdownContent ? (
            <div className="text-center py-12">
              <p className="text-default-500">No content available.</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdownContent}
              </ReactMarkdown>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
