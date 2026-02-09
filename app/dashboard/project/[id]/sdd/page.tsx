"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Link } from "@heroui/link";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";
import { SDDTableOfContents, SDDSection } from "@/domain/entities/SDD";
import { sddRepository } from "@/infrastructure/repositories/FirebaseSDDRepository";

function getFirebaseStorageUrl(gsUrl: string): string {
  // Convert gs://bucket/path to https://firebasestorage.googleapis.com/v0/b/bucket/o/path?alt=media
  const match = gsUrl.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) return gsUrl;
  const [, bucket, path] = match;
  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;
}

function SectionCard({ section }: { section: SDDSection }) {
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 w-full justify-between">
          <div className="flex items-center gap-2">
            <Chip size="sm" color="primary" variant="flat">
              {section.number}
            </Chip>
            <h3 className="text-lg font-semibold">{section.title}</h3>
          </div>
          {section.documentLink && (
            <Link
              href={getFirebaseStorageUrl(section.documentLink)}
              isExternal
              showAnchorIcon
              size="sm"
              color="primary"
            >
              View Document
            </Link>
          )}
        </div>
        <p className="text-sm text-default-500">{section.description}</p>
      </CardHeader>
      {section.subsections.length > 0 && (
        <>
          <Divider />
          <CardBody className="pt-2">
            <Accordion variant="light" selectionMode="multiple">
              {section.subsections.map((subsection) => (
                <AccordionItem
                  key={subsection.number}
                  aria-label={subsection.title}
                  title={
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-default-400">
                        {subsection.number}
                      </span>
                      <span className="font-medium">{subsection.title}</span>
                    </div>
                  }
                >
                  <p className="text-sm text-default-600 pb-2">
                    {subsection.description}
                  </p>
                  {subsection.viewpointRef && (
                    <Chip size="sm" variant="bordered" className="mt-1">
                      {subsection.viewpointRef}
                    </Chip>
                  )}
                </AccordionItem>
              ))}
            </Accordion>
          </CardBody>
        </>
      )}
    </Card>
  );
}

export default function SDDPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { setProjectContext, setCurrentProjectId, setIsConfiguration, setPageTitle } =
    useProjectChat();
  const [project, setProject] = useState<Project | null>(null);
  const [toc, setToc] = useState<SDDTableOfContents | null>(null);
  const [tocLoading, setTocLoading] = useState(true);

  const projectId = params.id as string;

  // Set page title
  useEffect(() => {
    setPageTitle("Software Design Document");
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

  // Set configuration mode to false for SDD page
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Subscribe to SDD Table of Contents
  useEffect(() => {
    if (!user?.uid || !projectId) {
      setToc(null);
      setTocLoading(false);
      return;
    }

    setTocLoading(true);

    const unsubscribe = sddRepository.subscribeTableOfContents(
      projectId,
      (updatedToc) => {
        setToc(updatedToc);
        setTocLoading(false);
      },
      (error) => {
        console.error("Error subscribing to SDD TOC:", error);
        setTocLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [projectId]);

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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-medium text-default-500">{project.name}</h2>
        {toc && (
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color="secondary">
              {toc.standard}
            </Chip>
            <Chip size="sm" variant="flat">
              v{toc.version}
            </Chip>
          </div>
        )}
      </div>

      {/* Document Info */}
      {toc && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">{toc.title}</h1>
          <p className="text-sm text-default-400">
            {toc.sections.length} sections •{" "}
            {toc.sections.reduce((acc, s) => acc + s.subsections.length, 0)} subsections
          </p>
        </div>
      )}

      {/* Content */}
      {tocLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner color="primary" />
        </div>
      ) : !toc || toc.sections.length === 0 ? (
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
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <p className="text-default-500 mb-4">
            The Software Design Document will be generated during the migration process.
          </p>
          <Button
            color="primary"
            variant="flat"
            onPress={() => router.push(`/dashboard/project/${projectId}/migration`)}
          >
            Go to Migration
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Table of Contents Overview */}
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Table of Contents</h2>
            </CardHeader>
            <Divider />
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {toc.sections.map((section) => (
                  <div
                    key={section.number}
                    className="p-3 rounded-lg bg-default-50 dark:bg-default-100/10"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-primary">
                        {section.number}
                      </span>
                      <span className="font-medium">{section.title}</span>
                    </div>
                    <p className="text-xs text-default-500 line-clamp-2">
                      {section.description}
                    </p>
                    {section.subsections.length > 0 && (
                      <p className="text-xs text-default-400 mt-1">
                        {section.subsections.length} subsection
                        {section.subsections.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Detailed Sections */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Sections</h2>
            {toc.sections.map((section) => (
              <SectionCard key={section.number} section={section} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
