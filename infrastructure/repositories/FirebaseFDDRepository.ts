import { doc, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";

import { db } from "../firebase/config";
import {
  FDDTableOfContents,
  FDDSection,
  FDDSubsection,
  FDDMetadata,
} from "@/domain/entities/FDD";
import { FDDRepository } from "@/domain/repositories/FDDRepository";

export class FirebaseFDDRepository implements FDDRepository {
  // Path: users/{userId}/projects/{projectId}/code-analysis-module/{migrationId}/fdd/toc
  private getTocDoc(userId: string, projectId: string, migrationId: string) {
    return doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module",
      migrationId,
      "fdd",
      "toc"
    );
  }

  private toSubsection(data: Record<string, unknown>): FDDSubsection {
    return {
      number: (data.number as string) || "",
      title: (data.title as string) || "",
      description: data.description as string | undefined,
      businessSummary: data.businessSummary as string | undefined,
      fileReferences: (data.fileReferences as string[]) || [],
      documentLink: data.documentLink as string | undefined,
      fileName: data.fileName as string | undefined,
      fileUrl: data.fileUrl as string | undefined,
    };
  }

  private toSection(data: Record<string, unknown>): FDDSection {
    const subsectionsData = (data.subsections as Record<string, unknown>[]) || [];
    return {
      number: (data.number as string) || "",
      title: (data.title as string) || "",
      description: data.description as string | undefined,
      businessSummary: data.businessSummary as string | undefined,
      subsections: subsectionsData.map((sub) => this.toSubsection(sub)),
      fileReferences: (data.fileReferences as string[]) || [],
      documentLink: data.documentLink as string | undefined,
      fileName: data.fileName as string | undefined,
      fileUrl: data.fileUrl as string | undefined,
    };
  }

  private toMetadata(data: Record<string, unknown>): FDDMetadata {
    return {
      generatedAt: data.generatedAt as number | undefined,
      enrichmentCount: (data.enrichmentCount as number) || 0,
      filesProcessed: (data.filesProcessed as number) || 0,
      lastFileProcessed: data.lastFileProcessed as string | undefined,
      sanitizedAt: data.sanitizedAt as number | undefined,
      sectionsRemoved: (data.sectionsRemoved as number) || 0,
      sectionsMerged: (data.sectionsMerged as number) || 0,
      totalSections: (data.totalSections as number) || 0,
      totalSubsections: (data.totalSubsections as number) || 0,
      legacyFddStoragePath: data.legacyFddStoragePath as string | undefined,
    };
  }

  private toTableOfContents(
    id: string,
    data: Record<string, unknown>
  ): FDDTableOfContents {
    const sectionsData = (data.sections as Record<string, unknown>[]) || [];
    const metadataData = data.metadata as Record<string, unknown> | undefined;

    return {
      id,
      title: (data.title as string) || "Functional Design Document",
      version: (data.version as string) || "1.0",
      sections: sectionsData.map((sec) => this.toSection(sec)),
      metadata: metadataData ? this.toMetadata(metadataData) : undefined,
      createdAt: data.createdAt as number | undefined,
      updatedAt: data.updatedAt as number | undefined,
    };
  }

  async getTableOfContents(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<FDDTableOfContents | null> {
    const docRef = this.getTocDoc(userId, projectId, migrationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.toTableOfContents(docSnap.id, docSnap.data() as Record<string, unknown>);
  }

  subscribeTableOfContents(
    userId: string,
    projectId: string,
    migrationId: string,
    onUpdate: (toc: FDDTableOfContents | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    const docRef = this.getTocDoc(userId, projectId, migrationId);

    const unsubscribe: Unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          onUpdate(null);
          return;
        }

        onUpdate(
          this.toTableOfContents(docSnap.id, docSnap.data() as Record<string, unknown>)
        );
      },
      (error) => {
        console.error("Error subscribing to FDD TOC:", error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }
}

export const fddRepository = new FirebaseFDDRepository();
