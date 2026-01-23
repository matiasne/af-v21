"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";

import { SDDTableOfContents } from "@/domain/entities/SDD";
import { sddRepository } from "@/infrastructure/repositories/FirebaseSDDRepository";
import { useAuth } from "@/infrastructure/context/AuthContext";

interface SDDCardProps {
  projectId: string;
  onNavigateToSDD: () => void;
}

export function SDDCard({
  projectId,
  onNavigateToSDD,
}: SDDCardProps) {
  const { user } = useAuth();
  const [toc, setToc] = useState<SDDTableOfContents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = sddRepository.subscribeTableOfContents(
      user.uid,
      projectId,
      (updatedToc) => {
        setToc(updatedToc);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading SDD TOC:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, projectId]);

  const totalSections = toc?.sections.length || 0;
  const totalSubsections = toc?.sections.reduce((acc, s) => acc + s.subsections.length, 0) || 0;

  return (
    <Card className="w-full">
      <CardHeader className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Software Design Document</h3>
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
            <Spinner color="primary" />
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
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <p className="text-default-500 mb-4">
              SDD will be generated during the migration process.
            </p>
          </div>
        ) : (
          <>
            {/* SDD Overview */}
            <div className="space-y-3">
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-primary-600 dark:text-primary-400 font-medium">
                    {toc.standard}
                  </span>
                  <span className="text-xs text-primary-500">v{toc.version}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                      {totalSections}
                    </p>
                    <p className="text-xs text-primary-500">Sections</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                      {totalSubsections}
                    </p>
                    <p className="text-xs text-primary-500">Subsections</p>
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

            {/* View SDD Button */}
            <Button
              color="primary"
              variant="flat"
              fullWidth
              onPress={onNavigateToSDD}
            >
              View Full Document
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  );
}
