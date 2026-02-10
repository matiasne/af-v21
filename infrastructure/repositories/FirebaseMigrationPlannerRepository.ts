import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  getDocs,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/config";

import {
  MigrationPlannerStatus,
  MigrationPlannerAction,
} from "@/domain/entities/MigrationPlanner";

export class FirebaseMigrationPlannerRepository {
  /**
   * Get the collection reference for migration planner module.
   * Path: projects/{projectId}/migration-planner-module
   */
  private getCollection(projectId: string) {
    return collection(
      db,
      "projects",
      projectId,
      "migration-planner-module",
    );
  }

  /**
   * Convert Firestore data to MigrationPlannerStatus entity.
   */
  private toMigrationPlannerStatus(
    id: string,
    data: Record<string, unknown>,
  ): MigrationPlannerStatus {
    return {
      id,
      action: (data.action as MigrationPlannerAction) || "start",
      currentStep: (data.currentStep as string) || null,
      description: (data.description as string) || null,
      error: (data.error as string) || null,
      logFile: (data.logFile as string) || null,
      tasksGenerated: (data.tasksGenerated as number) || 0,
      updatedAt: (data.updatedAt as number) || null,
    };
  }

  /**
   * Start the migration planner by updating the existing document with action = "start".
   */
  async startPlanning(userId: string, projectId: string): Promise<string> {
    const collectionRef = this.getCollection(projectId);
    const querySnapshot = await getDocs(collectionRef);

    const data = {
      action: "start",
      currentStep: null,
      description: "Queued for processing",
      error: null,
      logFile: null,
      tasksGenerated: 0,
      updatedAt: serverTimestamp(),
    };

    if (querySnapshot.empty) {
      const newDoc = await addDoc(collectionRef, data);

      return newDoc.id;
    }

    const docRef = querySnapshot.docs[0].ref;

    await updateDoc(docRef, data);

    return docRef.id;
  }

  /**
   * Subscribe to the latest migration planner status (most recently updated).
   * Queries the migration-planner-module collection and returns the latest document.
   * Returns an unsubscribe function.
   */
  subscribeToLatestStatus(
    userId: string,
    projectId: string,
    onUpdate: (status: MigrationPlannerStatus | null) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const collectionRef = this.getCollection(projectId);
    // Query for the most recently updated document
    const q = query(collectionRef, orderBy("updatedAt", "desc"), limit(1));

    const unsubscribe: Unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          onUpdate(null);

          return;
        }

        const doc = snapshot.docs[0];

        onUpdate(
          this.toMigrationPlannerStatus(
            doc.id,
            doc.data() as Record<string, unknown>,
          ),
        );
      },
      (error) => {
        console.error("Error subscribing to Migration Planner status:", error);
        if (onError) {
          onError(error);
        }
      },
    );

    return unsubscribe;
  }
}

export const migrationPlannerRepository =
  new FirebaseMigrationPlannerRepository();
