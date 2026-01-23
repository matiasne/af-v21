"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Spinner } from "@heroui/spinner";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Chip } from "@heroui/chip";
import { Accordion, AccordionItem } from "@heroui/accordion";

import { useAuth } from "@/infrastructure/context/AuthContext";
import { useProjects } from "@/infrastructure/hooks/useProjects";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { useProjectChat } from "@/infrastructure/context/ProjectChatContext";
import { Project } from "@/domain/entities/Project";
import {
  FDDTableOfContents,
  FDDSection,
  FDDSubsection,
  getSectionFilename,
  getSubsectionFilename,
} from "@/domain/entities/FDD";
import { fddRepository } from "@/infrastructure/repositories/FirebaseFDDRepository";
import { Link } from "@heroui/link";
import { FDDSidebar, FileAnalysisModal } from "./components";

function FileReferencesChip({
  files,
  userId,
  projectId,
  migrationId,
}: {
  files: string[];
  userId: string;
  projectId: string;
  migrationId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  if (files.length === 0) return null;

  const displayedFiles = expanded ? files : files.slice(0, 5);

  const handleFileClick = (filePath: string) => {
    // Extract filename from path for display
    const fileName = filePath.split("/").pop() || "";
    // The fileId in Firebase uses underscores instead of slashes
    // e.g., "common/ACCEPT_NUMERIC.C" becomes "common_ACCEPT_NUMERIC.C"
    const fileId = filePath.replace(/\//g, "_");

    console.log("FileReferencesChip: Clicked file", { filePath, fileName, fileId });
    setSelectedFileId(fileId);
    setSelectedFileName(fileName);
  };

  return (
    <>
      <div className="flex flex-wrap gap-1 mt-2">
        {displayedFiles.map((file) => (
          <Chip
            key={file}
            size="sm"
            variant="bordered"
            className="text-xs cursor-pointer hover:border-primary transition-colors"
            onClick={() => handleFileClick(file)}
          >
            {file.split("/").pop()}
          </Chip>
        ))}
        {!expanded && files.length > 5 && (
          <Chip
            size="sm"
            variant="flat"
            color="default"
            className="cursor-pointer hover:bg-default-200 transition-colors"
            onClick={() => setExpanded(true)}
          >
            +{files.length - 5} more
          </Chip>
        )}
        {expanded && files.length > 5 && (
          <Chip
            size="sm"
            variant="flat"
            color="default"
            className="cursor-pointer hover:bg-default-200 transition-colors"
            onClick={() => setExpanded(false)}
          >
            Show less
          </Chip>
        )}
      </div>

      {selectedFileId && (
        <FileAnalysisModal
          isOpen={!!selectedFileId}
          onClose={() => {
            setSelectedFileId(null);
            setSelectedFileName("");
          }}
          userId={userId}
          projectId={projectId}
          migrationId={migrationId}
          fileId={selectedFileId}
          fileName={selectedFileName}
        />
      )}
    </>
  );
}

function DocumentLink({
  projectId,
  processId,
  section,
  subsection,
}: {
  projectId: string;
  processId: string;
  section: FDDSection;
  subsection?: FDDSubsection;
}) {
  const title = subsection ? subsection.title : section.title;
  const sectionNumber = subsection ? subsection.number : section.number;

  // Generate filename from section/subsection number and title
  const fileName = subsection
    ? getSubsectionFilename(subsection)
    : getSectionFilename(section);

  // Construct the storage path using projectId and processId
  // Storage path format: "legacy_fdd/{projectId}/{processId}"
  const storagePath = `legacy_fdd/${projectId}/${processId}`;

  // Construct the full storage URL
  // Firebase Storage URL format: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded_path}?alt=media
  const fullPath = `${storagePath}/${fileName}`;
  const encodedPath = encodeURIComponent(fullPath);
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
  const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media`;

  const href = `/dashboard/project/${projectId}/fdd/doc?url=${encodeURIComponent(fileUrl)}&title=${encodeURIComponent(title)}&section=${encodeURIComponent(sectionNumber)}`;

  return (
    <Link
      href={href}
      size="sm"
      color="secondary"
      showAnchorIcon
      className="text-xs"
    >
      View Document
    </Link>
  );
}

function SectionCard({
  section,
  projectId,
  processId,
  subsectionRefs,
  userId,
  migrationId,
}: {
  section: FDDSection;
  projectId: string;
  processId: string;
  subsectionRefs?: (number: string) => (el: HTMLDivElement | null) => void;
  userId: string;
  migrationId: string;
}) {
  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2 w-full justify-between">
          <div className="flex items-center gap-2">
            <Chip size="sm" color="secondary" variant="flat">
              {section.number}
            </Chip>
            <h3 className="text-lg font-semibold">{section.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            {section.fileReferences.length > 0 && (
              <Chip size="sm" variant="flat" color="default">
                {section.fileReferences.length} files
              </Chip>
            )}
            <DocumentLink projectId={projectId} processId={processId} section={section} />
          </div>
        </div>
        {section.description && (
          <p className="text-sm text-default-500">{section.description}</p>
        )}
        {section.businessSummary && (
          <p className="text-sm text-default-600 italic mt-1">
            {section.businessSummary}
          </p>
        )}
        <FileReferencesChip
          files={section.fileReferences}
          userId={userId}
          projectId={projectId}
          migrationId={migrationId}
        />
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
                    <div
                      ref={subsectionRefs?.(subsection.number)}
                      className="flex items-center gap-2 w-full"
                    >
                      <span className="text-sm font-mono text-default-400">
                        {subsection.number}
                      </span>
                      <span className="font-medium">{subsection.title}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        {subsection.fileReferences.length > 0 && (
                          <Chip size="sm" variant="flat" color="default">
                            {subsection.fileReferences.length} files
                          </Chip>
                        )}
                        <DocumentLink
                          projectId={projectId}
                          processId={processId}
                          section={section}
                          subsection={subsection}
                        />
                      </div>
                    </div>
                  }
                >
                  {subsection.description && (
                    <p className="text-sm text-default-600 pb-2">
                      {subsection.description}
                    </p>
                  )}
                  {subsection.businessSummary && (
                    <p className="text-sm text-default-500 italic pb-2">
                      {subsection.businessSummary}
                    </p>
                  )}
                  <FileReferencesChip
                    files={subsection.fileReferences}
                    userId={userId}
                    projectId={projectId}
                    migrationId={migrationId}
                  />
                </AccordionItem>
              ))}
            </Accordion>
          </CardBody>
        </>
      )}
    </Card>
  );
}

export default function FDDPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { setProjectContext, setCurrentProjectId, setIsConfiguration, setPageTitle, projectOwnerId } =
    useProjectChat();
  const [project, setProject] = useState<Project | null>(null);
  const [toc, setToc] = useState<FDDTableOfContents | null>(null);
  const [tocLoading, setTocLoading] = useState(true);
  const [selectedSectionNumber, setSelectedSectionNumber] = useState<string | undefined>();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const projectId = params.id as string;
  const { migration, initializing: migrationInitializing } = useMigration(projectId, projectOwnerId);

  // Scroll to section when selected from sidebar
  const scrollToSection = useCallback((sectionNumber: string) => {
    const element = sectionRefs.current.get(sectionNumber);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setSelectedSectionNumber(sectionNumber);
    }
  }, []);

  const handleSelectSection = useCallback(
    (section: FDDSection) => {
      scrollToSection(section.number);
    },
    [scrollToSection]
  );

  const handleSelectSubsection = useCallback(
    (section: FDDSection, subsection: FDDSubsection) => {
      scrollToSection(subsection.number);
    },
    [scrollToSection]
  );

  const setSectionRef = useCallback(
    (number: string) => (el: HTMLDivElement | null) => {
      if (el) {
        sectionRefs.current.set(number, el);
      } else {
        sectionRefs.current.delete(number);
      }
    },
    []
  );

  // Set page title
  useEffect(() => {
    setPageTitle("Functional Design Document");
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

  // Set configuration mode to false for FDD page
  useEffect(() => {
    setIsConfiguration(false);
  }, [setIsConfiguration]);

  // Subscribe to FDD Table of Contents
  useEffect(() => {
    if (!user?.uid || !projectId || !migration?.id) {
      setToc(null);
      setTocLoading(false);
      return;
    }

    setTocLoading(true);

    const unsubscribe = fddRepository.subscribeTableOfContents(
      user.uid,
      projectId,
      migration.id,
      (updatedToc) => {
        setToc(updatedToc);
        setTocLoading(false);
      },
      (error) => {
        console.error("Error subscribing to FDD TOC:", error);
        setTocLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [user?.uid, projectId, migration?.id]);

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

  // Calculate stats
  const totalFileRefs = toc
    ? toc.sections.reduce((acc, s) => {
        const sectionRefs = s.fileReferences.length;
        const subsectionRefs = s.subsections.reduce(
          (subAcc, sub) => subAcc + sub.fileReferences.length,
          0
        );
        return acc + sectionRefs + subsectionRefs;
      }, 0)
    : 0;

  const totalSubsections = toc
    ? toc.sections.reduce((acc, s) => acc + s.subsections.length, 0)
    : 0;

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      {toc && toc.sections.length > 0 && (
        <>
          {/* Sidebar Toggle Button (visible when sidebar is closed) */}
          {!isSidebarOpen && (
            <Button
              size="sm"
              variant="flat"
              isIconOnly
              className="fixed left-4 top-20 z-10"
              onPress={() => setIsSidebarOpen(true)}
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
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </Button>
          )}

          {/* Sidebar */}
          <div
            className={`shrink-0 transition-all duration-300 ${
              isSidebarOpen ? "w-72" : "w-0"
            } overflow-hidden`}
          >
            <div className="w-72 h-full relative">
              <FDDSidebar
                toc={toc}
                onSelectSection={handleSelectSection}
                onSelectSubsection={handleSelectSubsection}
                selectedSectionNumber={selectedSectionNumber}
              />
              {/* Close Sidebar Button */}
              <Button
                size="sm"
                variant="light"
                isIconOnly
                className="absolute top-2 right-2 min-w-6 w-6 h-6"
                onPress={() => setIsSidebarOpen(false)}
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
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-5xl px-4 py-8 pb-24">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-medium text-default-500">{project.name}</h2>
            {toc && (
              <div className="flex items-center gap-2">
                {migration && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={
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
                          d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
                        />
                      </svg>
                    }
                    onPress={() => router.push(`/dashboard/project/${projectId}/files-analysis`)}
                  >
                    View Files
                  </Button>
                )}
                <Chip size="sm" variant="flat" color="secondary">
                  v{toc.version}
                </Chip>
                {toc.metadata?.enrichmentCount !== undefined && toc.metadata.enrichmentCount > 0 && (
                  <Chip size="sm" variant="flat">
                    {toc.metadata.enrichmentCount} enrichments
                  </Chip>
                )}
              </div>
            )}
          </div>

          {/* Document Info */}
          {toc && (
            <div className="mb-8">
              <h1 className="text-2xl font-bold mb-2">{toc.title}</h1>
              <p className="text-sm text-default-400">
                {toc.sections.length} sections • {totalSubsections} subsections •{" "}
                {totalFileRefs} file references
              </p>
            </div>
          )}

          {/* Content */}
          {tocLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner color="primary" />
            </div>
          ) : !migration ? (
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
                No migration found. Start a migration to generate the Functional Design Document.
              </p>
              <Button
                color="primary"
                variant="flat"
                onPress={() => router.push(`/dashboard/project/${projectId}/migration`)}
              >
                Go to Migration
              </Button>
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
                The Functional Design Document will be generated during the migration process.
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
              {/* Detailed Sections */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Sections</h2>
                {toc.sections.map((section) => (
                  <div key={section.number} ref={setSectionRef(section.number)}>
                    <SectionCard
                      section={section}
                      projectId={projectId}
                      processId={migration!.id}
                      subsectionRefs={setSectionRef}
                      userId={user.uid}
                      migrationId={migration!.id}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
