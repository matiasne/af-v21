"use client";

import { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const projectId = params.id as string;
  const { user } = useAuth();

  const {
    projectContext,
    chatHistory,
    handleChatHistoryChange,
    isChatLoading,
    setIsChatLoading,
    isConfiguration,
    projectOwnerId,
  } = useProjectChat();

  const { migration } = useMigration(projectId, projectOwnerId);

  // Hide FloatingInput on grooming page (it has its own chat)
  const isGroomingPage = pathname?.includes("/grooming");

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-background">
        <Navbar />
      </div>
      <div className="pt-12">{children}</div>
      {projectContext && !isConfiguration && !isGroomingPage && (
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
