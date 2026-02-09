"use client";

import { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";

import { FloatingInput } from "./components";

import {
  ProjectChatProvider,
  useProjectChat,
} from "@/infrastructure/context/ProjectChatContext";
import { useAuth } from "@/infrastructure/context/AuthContext";
import { useMigration } from "@/infrastructure/hooks/useMigration";
import { Navbar } from "@/components/navbar";

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
  } = useProjectChat();

  const { migration } = useMigration(projectId);

  // Hide FloatingInput on grooming and graph pages
  const isGroomingPage = pathname?.includes("/grooming");
  const isGraphPage = pathname?.includes("/graph");

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-background">
        <Navbar />
      </div>
      <div className="pt-1">{children}</div>
      {projectContext &&
        !isConfiguration &&
        !isGroomingPage &&
        !isGraphPage && (
          <FloatingInput
            chatHistory={chatHistory}
            isLoading={isChatLoading}
            migrationContext={{
              currentStep: migration?.currentStep,
              ragStoreName: migration?.ragFunctionalAndBusinessStoreName,
            }}
            migrationId={migration?.id}
            projectContext={projectContext}
            projectId={projectId}
            userId={user?.uid}
            onChatHistoryChange={handleChatHistoryChange}
            onLoadingChange={setIsChatLoading}
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
