"use client";

import { ReactNode } from "react";
import { useParams } from "next/navigation";

import {
  ProjectChatProvider,
  useProjectChat,
} from "@/infrastructure/context/ProjectChatContext";
import { useAuth } from "@/infrastructure/context/AuthContext";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { Navbar } from "@/components/navbar";
import { FloatingInput } from "./components";

function ProjectLayoutContent({ children }: { children: ReactNode }) {
  const params = useParams();
  const projectId = params.id as string;
  const { user } = useAuth();

  const {
    projectContext,
    chatHistory,
    handleChatHistoryChange,
    isChatLoading,
    setIsChatLoading,
    pageTitle,
    breadcrumbs,
    backUrl,
    isConfiguration,
    projectOwnerId,
  } = useProjectChat();

  const { migration } = useMigration(projectId, projectOwnerId);

  return (
    <>
      {pageTitle && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <Navbar
            pageTitle={pageTitle}
            projectName={projectContext?.name}
            backUrl={backUrl || `/dashboard/project/${projectId}`}
            breadcrumbs={breadcrumbs}
          />
        </div>
      )}
      <div className={pageTitle ? "" : "pb-24"}>{children}</div>
      {projectContext && !isConfiguration && (
        <FloatingInput
          projectContext={projectContext}
          projectId={projectId}
          userId={user?.uid}
          migrationId={migration?.id}
          chatHistory={chatHistory}
          onChatHistoryChange={handleChatHistoryChange}
          isLoading={isChatLoading}
          onLoadingChange={setIsChatLoading}
          migrationContext={{
            currentStep: migration?.currentStep,
            ragStoreName: migration?.ragFunctionalAndBusinessStoreName,
          }}
        />
      )}
    </>
  );
}

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return (
    <ProjectChatProvider>
      <ProjectLayoutContent>{children}</ProjectLayoutContent>
    </ProjectChatProvider>
  );
}
