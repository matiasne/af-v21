export interface BusinessAnalysis {
  id: string;
  fileName?: string;
  filePath?: string;
  analysisType?: string;
  analyzedAt?: number;
  businessSummary?: string;
  analysisNotes?: string;
  businessComplexity?: "low" | "medium" | "high";
  businessCriticality?: "low" | "medium" | "high";
  modernizationImpact?: "low" | "medium" | "high";
  confidence?: number;
  businessRules?: string[];
  businessDependencies?: string[];
  businessEntities?: string[];
  businessWorkflows?: string[];
  dataTransformations?: string[];
  errorHandling?: string[];
  extractedConstants?: {
    businessConstants?: string[];
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface FunctionalAnalysis {
  id: string;
  fileName?: string;
  filePath?: string;
  analysisType?: string;
  analyzedAt?: number;
  functionalSummary?: string;
  analysisNotes?: string;
  confidence?: number;
  linesOfCode?: number;
  cyclomaticComplexity?: "low" | "medium" | "high";
  maintainability?: "low" | "medium" | "high";
  testability?: "low" | "medium" | "high";
  controlFlow?: string[];
  ioOperations?: string[];
  externalDependencies?: string[];
  technicalDebt?: string[];
  functions?: FunctionInfo[];
  classes?: ClassInfo[];
  imports?: string[];
  exports?: string[];
  complexity?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface FunctionInfo {
  name: string;
  signature?: string;
  description?: string;
  parameters?: string[];
  returnType?: string;
}

export interface ClassInfo {
  name: string;
  description?: string;
  methods?: string[];
  properties?: string[];
}

export interface FDDEnrichment {
  id: string;
  createdAt?: number;
  enrichedSections?: string[];
  filePath?: string;
  validationReport?: {
    addedReferences?: string[];
    existingReferences?: string[];
    filePath?: string;
    totalSectionsReferencing?: number;
  };
}

export interface AnalyzedFile {
  id: string;
  fileName: string;
  filePath: string;
  fileType?: string;
  businessAnalysis?: BusinessAnalysis;
  functionalAnalysis?: FunctionalAnalysis;
  fddEnrichment?: FDDEnrichment;
  hasBusinessAnalysis?: boolean;
  hasFunctionalAnalysis?: boolean;
  hasUserComments?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
