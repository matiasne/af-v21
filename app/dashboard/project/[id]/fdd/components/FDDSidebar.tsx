"use client";

import { useState, useCallback } from "react";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";

import {
  FDDTableOfContents,
  FDDSection,
  FDDSubsection,
} from "@/domain/entities/FDD";

interface FDDSidebarProps {
  toc: FDDTableOfContents;
  onSelectSection: (section: FDDSection) => void;
  onSelectSubsection: (section: FDDSection, subsection: FDDSubsection) => void;
  selectedSectionNumber?: string;
}

interface TreeItemProps {
  section: FDDSection;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectSection: (section: FDDSection) => void;
  onSelectSubsection: (section: FDDSection, subsection: FDDSubsection) => void;
  selectedSectionNumber?: string;
}

function TreeItem({
  section,
  isExpanded,
  onToggle,
  onSelectSection,
  onSelectSubsection,
  selectedSectionNumber,
}: TreeItemProps) {
  const hasSubsections = section.subsections.length > 0;
  const isSelected = selectedSectionNumber === section.number;

  return (
    <div className="w-full">
      {/* Section Item */}
      <div
        className={`flex items-center gap-1 w-full rounded-lg transition-colors ${
          isSelected
            ? "bg-secondary-100 dark:bg-secondary-900/30"
            : "hover:bg-default-100"
        }`}
      >
        {/* Expand/Collapse Button */}
        {hasSubsections ? (
          <Button
            isIconOnly
            className="min-w-6 w-6 h-6"
            size="sm"
            variant="light"
            onPress={onToggle}
          >
            <svg
              className={`h-3 w-3 text-default-500 transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        ) : (
          <div className="w-6" />
        )}

        {/* Section Content */}
        <button
          className="flex-1 flex items-center gap-2 py-1.5 px-1 text-left min-w-0"
          onClick={() => onSelectSection(section)}
        >
          <span className="text-xs font-mono text-secondary shrink-0">
            {section.number}
          </span>
          <Tooltip content={section.title} delay={500}>
            <span className="text-sm truncate">{section.title}</span>
          </Tooltip>
        </button>
      </div>

      {/* Subsections */}
      {hasSubsections && isExpanded && (
        <div className="ml-6 pl-2 border-l border-default-200 dark:border-default-700 mt-1 space-y-0.5">
          {section.subsections.map((subsection) => {
            const isSubSelected = selectedSectionNumber === subsection.number;

            return (
              <button
                key={subsection.number}
                className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-left transition-colors ${
                  isSubSelected
                    ? "bg-secondary-100 dark:bg-secondary-900/30"
                    : "hover:bg-default-100"
                }`}
                onClick={() => onSelectSubsection(section, subsection)}
              >
                <span className="text-xs font-mono text-default-400 shrink-0">
                  {subsection.number}
                </span>
                <Tooltip content={subsection.title} delay={500}>
                  <span className="text-sm truncate text-default-600">
                    {subsection.title}
                  </span>
                </Tooltip>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FDDSidebar({
  toc,
  onSelectSection,
  onSelectSubsection,
  selectedSectionNumber,
}: FDDSidebarProps) {
  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(toc.sections.map((s) => s.number)),
  );

  const toggleSection = useCallback((sectionNumber: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);

      if (next.has(sectionNumber)) {
        next.delete(sectionNumber);
      } else {
        next.add(sectionNumber);
      }

      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedSections(new Set(toc.sections.map((s) => s.number)));
  }, [toc.sections]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const totalSubsections = toc.sections.reduce(
    (acc, s) => acc + s.subsections.length,
    0,
  );

  return (
    <div className="h-full flex flex-col bg-content1 border-r border-default-200 dark:border-default-700">
      {/* Header */}
      <div className="p-3 border-b border-default-200 dark:border-default-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Contents</h3>
          <div className="flex items-center gap-1">
            <Tooltip content="Expand All">
              <Button
                isIconOnly
                className="min-w-6 w-6 h-6"
                size="sm"
                variant="light"
                onPress={expandAll}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </Tooltip>
            <Tooltip content="Collapse All">
              <Button
                isIconOnly
                className="min-w-6 w-6 h-6"
                size="sm"
                variant="light"
                onPress={collapseAll}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M4.5 15.75l7.5-7.5 7.5 7.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip color="secondary" size="sm" variant="flat">
            {toc.sections.length} sections
          </Chip>
          <Chip size="sm" variant="flat">
            {totalSubsections} subsections
          </Chip>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {toc.sections.map((section) => (
          <TreeItem
            key={section.number}
            isExpanded={expandedSections.has(section.number)}
            section={section}
            selectedSectionNumber={selectedSectionNumber}
            onSelectSection={onSelectSection}
            onSelectSubsection={onSelectSubsection}
            onToggle={() => toggleSection(section.number)}
          />
        ))}
      </div>
    </div>
  );
}
