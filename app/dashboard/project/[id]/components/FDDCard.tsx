"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";

import { FDDTableOfContents } from "@/domain/entities/FDD";
import { fddRepository } from "@/infrastructure/repositories/FirebaseFDDRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

interface FDDCardProps {
  projectId: string;
  migrationId: string | undefined;
  onNavigateToFDD: () => void;
}

export function FDDCard({
  projectId,
  migrationId,
  onNavigateToFDD,
}: FDDCardProps) {
  const { user } = useAuth();
  const [toc, setToc] = useState<FDDTableOfContents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !projectId || !migrationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = fddRepository.subscribeTableOfContents(
      user.uid,
      projectId,
      migrationId,
      (updatedToc) => {
        setToc(updatedToc);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading FDD TOC:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, projectId, migrationId]);

  const totalSections = toc?.sections.length || 0;
  const totalSubsections = toc?.sections.reduce((acc, s) => acc + s.subsections.length, 0) || 0;
  const totalFileRefs = toc?.sections.reduce((acc, s) => {
    const sectionRefs = s.fileReferences.length;
    const subsectionRefs = s.subsections.reduce(
      (subAcc, sub) => subAcc + sub.fileReferences.length,
      0
    );
    return acc + sectionRefs + subsectionRefs;
  }, 0) || 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary-100 dark:bg-secondary-900/30">
            <svg
              className="h-5 w-5 text-secondary"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Current Application Knowledge</h3>
            <p className="text-xs text-default-500">Functional Design Document</p>
          </div>
        </div>
        {totalSections > 0 && (
          <span className="text-sm text-default-500">
            {totalSections} section{totalSections !== 1 ? "s" : ""}
          </span>
        )}
      </CardHeader>
      <Divider />
      <CardBody className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner color="secondary" />
          </div>
        ) : !toc || totalSections === 0 ? (
          <div className="text-center py-6">
            <div className="mb-4">
              <svg
                className="h-12 w-12 mx-auto text-default-300"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                />
              </svg>
            </div>
            <p className="text-default-500 mb-4">
              FDD will be generated during the code analysis process.
            </p>
          </div>
        ) : (
          <>
            {/* FDD Overview */}
            <div className="space-y-3">
              <div className="bg-secondary-50 dark:bg-secondary-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-secondary-600 dark:text-secondary-400 font-medium">
                    Functional Design
                  </span>
                  <span className="text-xs text-secondary-500">v{toc.version}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-secondary-700 dark:text-secondary-300">
                      {totalSections}
                    </p>
                    <p className="text-xs text-secondary-500">Sections</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary-700 dark:text-secondary-300">
                      {totalSubsections}
                    </p>
                    <p className="text-xs text-secondary-500">Subsections</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-secondary-700 dark:text-secondary-300">
                      {totalFileRefs}
                    </p>
                    <p className="text-xs text-secondary-500">File Refs</p>
                  </div>
                </div>
              </div>

              {/* Preview of top sections */}
              {toc.sections.slice(0, 3).map((section) => (
                <div
                  key={section.number}
                  className="flex items-center gap-2 text-sm text-default-600 dark:text-default-400"
                >
                  <span className="text-xs font-mono text-default-400">{section.number}</span>
                  <span className="truncate">{section.title}</span>
                </div>
              ))}
              {toc.sections.length > 3 && (
                <p className="text-xs text-default-400">
                  +{toc.sections.length - 3} more sections
                </p>
              )}
            </div>

            {/* View FDD Button */}
            <Button
              color="secondary"
              variant="flat"
              fullWidth
              onPress={onNavigateToFDD}
            >
              View Full Document
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
