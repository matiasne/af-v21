"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";
import { FileListSection } from "../fdd/components";

export default function FilesAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { setProjectContext, setCurrentProjectId, setIsConfiguration, setPageTitle, setBreadcrumbs, projectOwnerId } =
    useProjectChat();
  const [project, setProject] = useState<Project | null>(null);

  const projectId = params.id as string;
  const { migration, initializing: migrationInitializing } = useMigration(projectId, projectOwnerId);

  // Set page title and breadcrumbs
  useEffect(() => {
    setPageTitle("Analyzed Files");
    setBreadcrumbs([
      { label: "Current Application Knowledge", href: `/dashboard/project/${projectId}/fdd` }
    ]);
    return () => {
      setPageTitle(null);
      setBreadcrumbs([]);
    };
  }, [setPageTitle, setBreadcrumbs, projectId]);

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

  if (authLoading || projectsLoading || migrationInitializing) {
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

  if (!migration) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
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
                d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
              />
            </svg>
          </div>
          <p className="text-default-500 mb-4">
            No migration found. Start a migration to analyze files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Analyzed Files</h1>
        <p className="text-sm text-default-500">
          View all files that have been analyzed during the migration process
        </p>
      </div>

      <FileListSection
        userId={user.uid}
        projectId={projectId}
        migrationId={migration.id}
      />
    </div>
  );
}
