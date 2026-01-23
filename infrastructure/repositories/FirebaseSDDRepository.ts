import { doc, getDoc, onSnapshot, Unsubscribe } from "firebase/firestore";

import { db } from "../firebase/config";
import {
  SDDTableOfContents,
  SDDSection,
  SDDSubsection,
} from "@/domain/entities/SDD";
import { SDDRepository } from "@/domain/repositories/SDDRepository";

export class FirebaseSDDRepository implements SDDRepository {
  // Path: users/{userId}/projects/{projectId}/sdd/toc
  private getTocDoc(userId: string, projectId: string) {
    return doc(db, "users", userId, "projects", projectId, "sdd", "toc");
  }

  private toSubsection(data: Record<string, unknown>): SDDSubsection {
    return {
      number: (data.number as string) || "",
      title: (data.title as string) || "",
      description: (data.description as string) || "",
      viewpointRef: data.viewpointRef as string | undefined,
    };
  }

  private toSection(data: Record<string, unknown>): SDDSection {
    const subsectionsData = (data.subsections as Record<string, unknown>[]) || [];
    return {
      number: (data.number as string) || "",
      title: (data.title as string) || "",
      description: (data.description as string) || "",
      ieeeSection: (data.ieeeSection as string) || "",
      documentLink: data.documentLink as string | undefined,
      subsections: subsectionsData.map((sub) => this.toSubsection(sub)),
    };
  }

  private toTableOfContents(data: Record<string, unknown>): SDDTableOfContents {
    const sectionsData = (data.sections as Record<string, unknown>[]) || [];
    return {
      title: (data.title as string) || "",
      version: (data.version as string) || "",
      standard: (data.standard as string) || "",
      sections: sectionsData.map((sec) => this.toSection(sec)),
      createdAt: (data.createdAt as number) || Date.now(),
      updatedAt: (data.updatedAt as number) || Date.now(),
    };
  }

  async getTableOfContents(
    userId: string,
    projectId: string
  ): Promise<SDDTableOfContents | null> {
    const docRef = this.getTocDoc(userId, projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return this.toTableOfContents(docSnap.data() as Record<string, unknown>);
  }

  subscribeTableOfContents(
    userId: string,
    projectId: string,
    onUpdate: (toc: SDDTableOfContents | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    const docRef = this.getTocDoc(userId, projectId);

    const unsubscribe: Unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          onUpdate(null);
          return;
        }

        onUpdate(this.toTableOfContents(docSnap.data() as Record<string, unknown>));
      },
      (error) => {
        console.error("Error subscribing to SDD TOC:", error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }
}

export const sddRepository = new FirebaseSDDRepository();
