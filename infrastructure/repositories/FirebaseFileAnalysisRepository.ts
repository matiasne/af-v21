import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  addDoc,
  deleteDoc,
  query,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebase/config";

import {
  AnalyzedFile,
  BusinessAnalysis,
  FunctionalAnalysis,
  FDDEnrichment,
} from "@/domain/entities/FileAnalysis";
import { FileAnalysisRepository } from "@/domain/repositories/FileAnalysisRepository";

export class FirebaseFileAnalysisRepository implements FileAnalysisRepository {
  // Path: projects/{projectId}/code-analysis-module/{migrationId}/files
  private getFilesCollection(projectId: string, migrationId: string) {
    return collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "files",
    );
  }

  private getFileDoc(projectId: string, migrationId: string, fileId: string) {
    return doc(
      db,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "files",
      fileId,
    );
  }

  private toBusinessAnalysis(
    id: string,
    data: Record<string, unknown>,
  ): BusinessAnalysis {
    return {
      id,
      fileName: data.fileName as string | undefined,
      filePath: data.filePath as string | undefined,
      analysisType: data.analysisType as string | undefined,
      analyzedAt: data.analyzedAt as number | undefined,
      businessSummary: data.businessSummary as string | undefined,
      analysisNotes: data.analysisNotes as string | undefined,
      businessComplexity: data.businessComplexity as
        | "low"
        | "medium"
        | "high"
        | undefined,
      businessCriticality: data.businessCriticality as
        | "low"
        | "medium"
        | "high"
        | undefined,
      modernizationImpact: data.modernizationImpact as
        | "low"
        | "medium"
        | "high"
        | undefined,
      confidence: data.confidence as number | undefined,
      businessRules: data.businessRules as string[] | undefined,
      businessDependencies: data.businessDependencies as string[] | undefined,
      businessEntities: data.businessEntities as string[] | undefined,
      businessWorkflows: data.businessWorkflows as string[] | undefined,
      dataTransformations: data.dataTransformations as string[] | undefined,
      errorHandling: data.errorHandling as string[] | undefined,
      extractedConstants: data.extractedConstants as
        | { businessConstants?: string[] }
        | undefined,
      createdAt: data.createdAt as number | undefined,
      updatedAt: data.updatedAt as number | undefined,
    };
  }

  private toFunctionalAnalysis(
    id: string,
    data: Record<string, unknown>,
  ): FunctionalAnalysis {
    return {
      id,
      fileName: data.fileName as string | undefined,
      filePath: data.filePath as string | undefined,
      analysisType: data.analysisType as string | undefined,
      analyzedAt: data.analyzedAt as number | undefined,
      functionalSummary: data.functionalSummary as string | undefined,
      analysisNotes: data.analysisNotes as string | undefined,
      confidence: data.confidence as number | undefined,
      linesOfCode: data.linesOfCode as number | undefined,
      cyclomaticComplexity: data.cyclomaticComplexity as
        | "low"
        | "medium"
        | "high"
        | undefined,
      maintainability: data.maintainability as
        | "low"
        | "medium"
        | "high"
        | undefined,
      testability: data.testability as "low" | "medium" | "high" | undefined,
      controlFlow: data.controlFlow as string[] | undefined,
      ioOperations: data.ioOperations as string[] | undefined,
      externalDependencies: data.externalDependencies as string[] | undefined,
      technicalDebt: data.technicalDebt as string[] | undefined,
      functions: data.functions as any[] | undefined,
      classes: data.classes as any[] | undefined,
      imports: data.imports as string[] | undefined,
      exports: data.exports as string[] | undefined,
      complexity: data.complexity as number | undefined,
      createdAt: data.createdAt as number | undefined,
      updatedAt: data.updatedAt as number | undefined,
    };
  }

  private toFDDEnrichment(
    id: string,
    data: Record<string, unknown>,
  ): FDDEnrichment {
    return {
      id,
      createdAt: data.createdAt as number | undefined,
      enrichedSections: data.enrichedSections as string[] | undefined,
      filePath: data.filePath as string | undefined,
      validationReport: data.validationReport as
        | {
            addedReferences?: string[];
            existingReferences?: string[];
            filePath?: string;
            totalSectionsReferencing?: number;
          }
        | undefined,
    };
  }

  private toAnalyzedFile(
    id: string,
    data: Record<string, unknown>,
  ): AnalyzedFile {
    // Don't fetch enrichment here to avoid 587 async calls
    // Enrichment will be fetched on-demand when needed
    return {
      id,
      fileName: (data.fileName as string) || id,
      filePath: (data.filePath as string) || "",
      fileType: data.fileType as string | undefined,
      createdAt: data.createdAt as number | undefined,
      updatedAt: data.updatedAt as number | undefined,
    };
  }

  private async checkHasBusinessAnalysis(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<boolean> {
    try {
      const businessCol = collection(
        db,
        "projects",
        projectId,
        "code-analysis-module",
        migrationId,
        "files",
        fileId,
        "business_analysis",
      );
      const businessSnap = await getDocs(businessCol);

      return !businessSnap.empty;
    } catch (error) {
      return false;
    }
  }

  private async checkHasFunctionalAnalysis(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<boolean> {
    try {
      const functionalCol = collection(
        db,
        "projects",
        projectId,
        "code-analysis-module",
        migrationId,
        "files",
        fileId,
        "functional_analysis",
      );
      const functionalSnap = await getDocs(functionalCol);

      return !functionalSnap.empty;
    } catch (error) {
      return false;
    }
  }

  private async checkHasUserComments(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<boolean> {
    try {
      const commentsCol = this.getCommentsCollection(
        projectId,
        migrationId,
        fileId,
      );
      const commentsSnap = await getDocs(commentsCol);

      return !commentsSnap.empty;
    } catch (error) {
      return false;
    }
  }

  private async getFileEnrichment(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<FDDEnrichment | undefined> {
    try {
      // Path: projects/{projectId}/code-analysis-module/{migrationId}/files/{fileId}/fdd_enrichment
      // This is a subcollection, so we need to get all documents and take the first one
      const enrichmentCol = collection(
        db,
        "projects",
        projectId,
        "code-analysis-module",
        migrationId,
        "files",
        fileId,
        "fdd_enrichment",
      );
      const enrichmentSnap = await getDocs(enrichmentCol);

      if (!enrichmentSnap.empty) {
        const enrichmentDoc = enrichmentSnap.docs[0];

        return this.toFDDEnrichment(
          enrichmentDoc.id,
          enrichmentDoc.data() as Record<string, unknown>,
        );
      }
    } catch (error) {
      console.error("Error fetching FDD enrichment:", error);
    }

    return undefined;
  }

  async getFiles(
    projectId: string,
    migrationId: string,
  ): Promise<AnalyzedFile[]> {
    const filesCol = this.getFilesCollection(projectId, migrationId);

    // Don't use orderBy to avoid Firebase index requirement
    // We'll sort in memory instead
    const snapshot = await getDocs(filesCol);

    const files: AnalyzedFile[] = [];

    for (const docSnap of snapshot.docs) {
      const file = this.toAnalyzedFile(
        docSnap.id,
        docSnap.data() as Record<string, unknown>,
      );

      files.push(file);
    }

    // Sort manually by fileName
    files.sort((a, b) => a.fileName.localeCompare(b.fileName));

    return files;
  }

  subscribeFiles(
    projectId: string,
    migrationId: string,
    onUpdate: (files: AnalyzedFile[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const filesCol = this.getFilesCollection(projectId, migrationId);

    console.log(
      "FirebaseFileAnalysisRepository: Subscribing to collection path:",
      `projects/${projectId}/code-analysis-module/${migrationId}/files`,
    );

    // Don't use orderBy to avoid Firebase index requirement
    // We'll sort in memory instead
    const handleSnapshot = async (snapshot: any) => {
      console.log(
        "FirebaseFileAnalysisRepository: Snapshot received, docs count:",
        snapshot.docs.length,
      );

      // Process files and fetch enrichment status for each
      const filePromises = snapshot.docs.map(async (docSnap: any) => {
        const file = this.toAnalyzedFile(
          docSnap.id,
          docSnap.data() as Record<string, unknown>,
        );

        // Fetch enrichment status and analysis flags in parallel
        const [
          enrichment,
          hasBusinessAnalysis,
          hasFunctionalAnalysis,
          hasUserComments,
        ] = await Promise.all([
          this.getFileEnrichment(projectId, migrationId, docSnap.id),
          this.checkHasBusinessAnalysis(projectId, migrationId, docSnap.id),
          this.checkHasFunctionalAnalysis(projectId, migrationId, docSnap.id),
          this.checkHasUserComments(projectId, migrationId, docSnap.id),
        ]);

        if (enrichment) {
          file.fddEnrichment = enrichment;
        }
        file.hasBusinessAnalysis = hasBusinessAnalysis;
        file.hasFunctionalAnalysis = hasFunctionalAnalysis;
        file.hasUserComments = hasUserComments;

        return file;
      });

      const files = await Promise.all(filePromises);

      // Sort manually by fileName
      files.sort((a, b) => a.fileName.localeCompare(b.fileName));
      console.log(
        "FirebaseFileAnalysisRepository: Total files processed:",
        files.length,
      );
      onUpdate(files);
    };

    const handleError = (error: any) => {
      console.error("Error subscribing to files:", error);
      if (onError) {
        onError(error);
      }
    };

    const unsubscribe = onSnapshot(filesCol, handleSnapshot, handleError);

    return unsubscribe;
  }

  async getFileWithAnalyses(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<{
    file: AnalyzedFile;
    businessAnalysis?: BusinessAnalysis;
    functionalAnalysis?: FunctionalAnalysis;
  } | null> {
    console.log(
      "FirebaseFileAnalysisRepository: getFileWithAnalyses called with fileId:",
      fileId,
    );
    console.log(
      "FirebaseFileAnalysisRepository: Full path:",
      `projects/${projectId}/code-analysis-module/${migrationId}/files/${fileId}`,
    );

    const fileDocRef = this.getFileDoc(projectId, migrationId, fileId);
    const fileSnap = await getDoc(fileDocRef);

    if (!fileSnap.exists()) {
      console.log(
        "FirebaseFileAnalysisRepository: File document does not exist for fileId:",
        fileId,
      );

      return null;
    }

    console.log(
      "FirebaseFileAnalysisRepository: File document found:",
      fileSnap.data(),
    );

    const file = this.toAnalyzedFile(
      fileSnap.id,
      fileSnap.data() as Record<string, unknown>,
    );

    // Fetch enrichment on-demand
    const fddEnrichment = await this.getFileEnrichment(
      projectId,
      migrationId,
      fileId,
    );

    if (fddEnrichment) {
      file.fddEnrichment = fddEnrichment;
    }

    // Get business analysis from subcollection
    let businessAnalysis: BusinessAnalysis | undefined;

    try {
      const businessCol = collection(
        db,
        "projects",
        projectId,
        "code-analysis-module",
        migrationId,
        "files",
        fileId,
        "business_analysis",
      );
      const businessSnap = await getDocs(businessCol);

      if (!businessSnap.empty) {
        const businessDoc = businessSnap.docs[0];

        businessAnalysis = this.toBusinessAnalysis(
          businessDoc.id,
          businessDoc.data() as Record<string, unknown>,
        );
      }
    } catch (error) {
      console.error("Error fetching business analysis:", error);
    }

    // Get functional analysis from subcollection
    let functionalAnalysis: FunctionalAnalysis | undefined;

    try {
      const functionalCol = collection(
        db,
        "projects",
        projectId,
        "code-analysis-module",
        migrationId,
        "files",
        fileId,
        "functional_analysis",
      );
      const functionalSnap = await getDocs(functionalCol);

      if (!functionalSnap.empty) {
        const functionalDoc = functionalSnap.docs[0];

        functionalAnalysis = this.toFunctionalAnalysis(
          functionalDoc.id,
          functionalDoc.data() as Record<string, unknown>,
        );
      }
    } catch (error) {
      console.error("Error fetching functional analysis:", error);
    }

    return {
      file,
      businessAnalysis,
      functionalAnalysis,
    };
  }

  async skipFile(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<void> {
    const enrichmentCol = collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "files",
      fileId,
      "fdd_enrichment",
    );

    await addDoc(enrichmentCol, {
      action: "skipped",
      createdAt: Date.now(),
    });
  }

  private getCommentsCollection(
    projectId: string,
    migrationId: string,
    fileId: string,
  ) {
    return collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "files",
      fileId,
      "user-comments",
    );
  }

  async addComment(
    projectId: string,
    migrationId: string,
    fileId: string,
    comment: string,
  ): Promise<string> {
    const commentsCol = this.getCommentsCollection(
      projectId,
      migrationId,
      fileId,
    );
    const docRef = await addDoc(commentsCol, {
      comment,
      createdAt: Date.now(),
    });

    return docRef.id;
  }

  async getComments(
    projectId: string,
    migrationId: string,
    fileId: string,
  ): Promise<Array<{ id: string; comment: string; createdAt: number }>> {
    const commentsCol = this.getCommentsCollection(
      projectId,
      migrationId,
      fileId,
    );
    const q = query(commentsCol, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      comment: docSnap.data().comment as string,
      createdAt: docSnap.data().createdAt as number,
    }));
  }

  subscribeComments(
    projectId: string,
    migrationId: string,
    fileId: string,
    onUpdate: (
      comments: Array<{ id: string; comment: string; createdAt: number }>,
    ) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const commentsCol = this.getCommentsCollection(
      projectId,
      migrationId,
      fileId,
    );
    const q = query(commentsCol, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const comments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          comment: docSnap.data().comment as string,
          createdAt: docSnap.data().createdAt as number,
        }));

        onUpdate(comments);
      },
      (error) => {
        console.error("Error subscribing to comments:", error);
        if (onError) {
          onError(error);
        }
      },
    );

    return unsubscribe;
  }

  async deleteComment(
    projectId: string,
    migrationId: string,
    fileId: string,
    commentId: string,
  ): Promise<void> {
    const commentDoc = doc(
      db,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "files",
      fileId,
      "user-comments",
      commentId,
    );

    await deleteDoc(commentDoc);
  }
}

export const fileAnalysisRepository = new FirebaseFileAnalysisRepository();
