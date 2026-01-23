export interface FDDSubsection {
  number: string;
  title: string;
  description?: string;
  businessSummary?: string;
  fileReferences: string[];
  documentLink?: string;
  fileName?: string;
  fileUrl?: string;
}

export interface FDDSection {
  number: string;
  title: string;
  description?: string;
  businessSummary?: string;
  subsections: FDDSubsection[];
  fileReferences: string[];
  documentLink?: string;
  fileName?: string;
  fileUrl?: string;
}

export interface FDDMetadata {
  generatedAt?: number;
  enrichmentCount: number;
  filesProcessed: number;
  lastFileProcessed?: string;
  sanitizedAt?: number;
  sectionsRemoved: number;
  sectionsMerged: number;
  totalSections: number;
  totalSubsections: number;
  legacyFddStoragePath?: string;
}

export interface FDDTableOfContents {
  id: string;
  title: string;
  version: string;
  sections: FDDSection[];
  metadata?: FDDMetadata;
  createdAt?: number;
  updatedAt?: number;
}

// Helper function to sanitize filename (matching backend logic)
export function sanitizeFilename(name: string): string {
  let filename = name.toLowerCase();
  filename = filename.replace(/ /g, "_");
  filename = filename.replace(/,/g, "");
  filename = filename.replace(/\./g, "");
  filename = filename.replace(/:/g, "");
  filename = filename.replace(/\//g, "_");
  filename = filename.replace(/\\/g, "_");
  filename = filename.replace(/\(/g, "");
  filename = filename.replace(/\)/g, "");
  filename = filename.replace(/&/g, "and");
  return filename;
}

// Generate filename for a section
export function getSectionFilename(section: FDDSection): string {
  const paddedNumber = section.number.padStart(2, "0");
  return `${paddedNumber}_${sanitizeFilename(section.title)}.md`;
}

// Generate filename for a subsection
export function getSubsectionFilename(subsection: FDDSubsection): string {
  const normalizedNumber = subsection.number.replace(/\./g, "_");
  return `${normalizedNumber}_${sanitizeFilename(subsection.title)}.md`;
}
