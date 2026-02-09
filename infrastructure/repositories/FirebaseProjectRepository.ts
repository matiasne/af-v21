import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  writeBatch,
  onSnapshot,
  Unsubscribe,
  setDoc,
  arrayUnion,
  arrayRemove,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, deleteObject } from "firebase/storage";

import { db, storage } from "../firebase/config";

import {
  Project,
  ConfigChatMessage,
  ProjectDocument,
  UserProjectReference,
} from "@/domain/entities/Project";
import { ProjectRepository } from "@/domain/repositories/ProjectRepository";

export class FirebaseProjectRepository implements ProjectRepository {
  // Top-level projects collection
  private getProjectsCollection() {
    return collection(db, "projects");
  }

  private getProjectDoc(projectId: string) {
    return doc(db, "projects", projectId);
  }

  // User document for storing project references
  private getUserDoc(userId: string) {
    return doc(db, "users", userId);
  }

  private getConfigChatMessagesCollection(projectId: string) {
    return collection(db, "projects", projectId, "configChatMessages");
  }

  private getGeneralChatMessagesCollection(projectId: string) {
    return collection(db, "projects", projectId, "generalChatMessages");
  }

  private getLegacyFilesCollection(projectId: string) {
    return collection(db, "projects", projectId, "legacy-files");
  }

  async getProjects(userId: string): Promise<Project[]> {
    // Get user document to fetch project references
    const userDocRef = this.getUserDoc(userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return [];
    }

    const userData = userDocSnap.data();
    const projectRefs: UserProjectReference[] = userData.projects || [];

    if (projectRefs.length === 0) {
      return [];
    }

    // Fetch all projects in parallel
    const projectPromises = projectRefs.map(async (ref) => {
      const projectDocRef = this.getProjectDoc(ref.projectId);
      const projectDocSnap = await getDoc(projectDocRef);

      if (!projectDocSnap.exists()) {
        return null;
      }

      return { id: projectDocSnap.id, ...projectDocSnap.data() } as Project;
    });

    const projects = await Promise.all(projectPromises);

    // Filter out nulls and sort by createdAt descending
    return projects
      .filter((p): p is Project => p !== null)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const docRef = this.getProjectDoc(projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as Project;
  }

  async createProject(
    userId: string,
    project: Omit<Project, "id" | "createdAt" | "updatedAt" | "status">,
  ): Promise<string> {
    const now = Date.now();

    // Create project in top-level projects collection
    const docRef = await addDoc(this.getProjectsCollection(), {
      ...project,
      ownerId: userId,
      sharedWith: [],
      status: {
        step: "queue",
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Update with taskRAGStore using the project ID
    await updateDoc(docRef, {
      taskRAGStore: `${docRef.id}-tasks-rag`,
    });

    // Add project reference to user document with owner role
    const userDocRef = this.getUserDoc(userId);
    const userDocSnap = await getDoc(userDocRef);

    const projectRef: UserProjectReference = {
      projectId: docRef.id,
      role: "owner",
      addedAt: now,
    };

    if (userDocSnap.exists()) {
      // Update existing user document
      await updateDoc(userDocRef, {
        projects: arrayUnion(projectRef),
      });
    } else {
      // Create user document if it doesn't exist
      await setDoc(userDocRef, {
        projects: [projectRef],
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create migration-planner-module subcollection with pending action
    const plannerModuleCol = collection(
      db,
      "projects",
      docRef.id,
      "migration-planner-module",
    );

    await addDoc(plannerModuleCol, {
      action: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create migration-executor-module subcollection with pending action
    const executorModuleCol = collection(
      db,
      "projects",
      docRef.id,
      "migration-executor-module",
    );

    await addDoc(executorModuleCol, {
      action: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return docRef.id;
  }

  async updateProject(
    userId: string,
    projectId: string,
    data: Partial<Project>,
  ): Promise<void> {
    const docRef = this.getProjectDoc(projectId);

    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now(),
    });
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const docRef = this.getProjectDoc(projectId);

    // Remove project reference from user document
    const userDocRef = this.getUserDoc(userId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      const projectRefs: UserProjectReference[] = userData.projects || [];
      const projectRefToRemove = projectRefs.find(
        (ref) => ref.projectId === projectId,
      );

      if (projectRefToRemove) {
        await updateDoc(userDocRef, {
          projects: arrayRemove(projectRefToRemove),
        });
      }
    }

    // Delete the project document
    await deleteDoc(docRef);
  }

  async getConfigChatMessages(
    userId: string,
    projectId: string,
  ): Promise<ConfigChatMessage[]> {
    const q = query(
      this.getConfigChatMessagesCollection(projectId),
      orderBy("timestamp", "asc"),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as ConfigChatMessage);
  }

  async addConfigChatMessage(
    userId: string,
    projectId: string,
    message: Omit<ConfigChatMessage, "timestamp">,
  ): Promise<string> {
    const docRef = await addDoc(
      this.getConfigChatMessagesCollection(projectId),
      {
        ...message,
        timestamp: Date.now(),
      },
    );

    return docRef.id;
  }

  async clearConfigChatMessages(
    userId: string,
    projectId: string,
  ): Promise<void> {
    const querySnapshot = await getDocs(
      this.getConfigChatMessagesCollection(projectId),
    );

    const batch = writeBatch(db);

    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  async getGeneralChatMessages(
    userId: string,
    projectId: string,
  ): Promise<ConfigChatMessage[]> {
    const q = query(
      this.getGeneralChatMessagesCollection(projectId),
      orderBy("timestamp", "asc"),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as ConfigChatMessage);
  }

  async addGeneralChatMessage(
    userId: string,
    projectId: string,
    message: Omit<ConfigChatMessage, "timestamp">,
  ): Promise<string> {
    const docRef = await addDoc(
      this.getGeneralChatMessagesCollection(projectId),
      {
        ...message,
        timestamp: Date.now(),
      },
    );

    return docRef.id;
  }

  async getLegacyFilesCount(
    userId: string,
    projectId: string,
  ): Promise<number> {
    const querySnapshot = await getDocs(
      this.getLegacyFilesCollection(projectId),
    );

    return querySnapshot.size;
  }

  async updateExecutorModel(
    userId: string,
    projectId: string,
    executorModel: string,
  ): Promise<void> {
    console.log("[FirebaseProjectRepository] updateExecutorModel called:", {
      userId,
      projectId,
      executorModel,
    });

    const docRef = this.getProjectDoc(projectId);

    console.log("[FirebaseProjectRepository] Document path:", docRef.path);

    try {
      await updateDoc(docRef, {
        executorModel,
        updatedAt: Date.now(),
      });
      console.log("[FirebaseProjectRepository] Document updated successfully");
    } catch (error) {
      console.error(
        "[FirebaseProjectRepository] Error updating document:",
        error,
      );
      throw error;
    }
  }

  subscribeToProject(
    userId: string,
    projectId: string,
    onUpdate: (project: Project | null) => void,
  ): Unsubscribe {
    const docRef = this.getProjectDoc(projectId);

    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate({ id: docSnap.id, ...docSnap.data() } as Project);
      } else {
        onUpdate(null);
      }
    });
  }

  async startCodeAnalysis(
    projectId: string,
    migrationId: string,
  ): Promise<void> {
    const codeAnalysisCol = collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
    );

    // Query for existing code-analysis-module document
    const querySnapshot = await getDocs(codeAnalysisCol);

    const now = Date.now();

    if (querySnapshot.empty) {
      // Create new document if none exists
      await addDoc(codeAnalysisCol, {
        action: "start",
        migrationId,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing document - set action to "start"
      const docRef = querySnapshot.docs[0].ref;

      await updateDoc(docRef, {
        action: "start",
        updatedAt: now,
      });
    }
  }

  async stopCodeAnalysis(
    projectId: string,
    migrationId: string,
  ): Promise<void> {
    const codeAnalysisCol = collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
    );

    // Query for existing code-analysis-module document
    const querySnapshot = await getDocs(codeAnalysisCol);

    if (!querySnapshot.empty) {
      // Update existing document - set action to "stop"
      const docRef = querySnapshot.docs[0].ref;

      await updateDoc(docRef, {
        action: "stop",
        updatedAt: Date.now(),
      });
    }
  }

  async resumeCodeAnalysis(
    projectId: string,
    migrationId: string,
  ): Promise<void> {
    console.log("[FirebaseProjectRepository] resumeCodeAnalysis called:", {
      projectId,
      migrationId,
    });

    const codeAnalysisCol = collection(
      db,
      "projects",
      projectId,
      "code-analysis-module",
    );

    // Query for existing code-analysis-module document
    const querySnapshot = await getDocs(codeAnalysisCol);

    console.log(
      "[FirebaseProjectRepository] querySnapshot empty:",
      querySnapshot.empty,
    );

    if (!querySnapshot.empty) {
      // Update existing document - set action to "resume"
      const docRef = querySnapshot.docs[0].ref;

      console.log("[FirebaseProjectRepository] Updating doc:", docRef.path);
      await updateDoc(docRef, {
        action: "resume",
        updatedAt: Date.now(),
      });
      console.log("[FirebaseProjectRepository] Update complete");
    }
  }

  // Document methods for "Start from Documentation" projects
  private getDocumentsCollection(projectId: string) {
    return collection(db, "projects", projectId, "documents");
  }

  async getProjectDocuments(
    userId: string,
    projectId: string,
  ): Promise<ProjectDocument[]> {
    const q = query(
      this.getDocumentsCollection(projectId),
      orderBy("uploadedAt", "desc"),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as ProjectDocument,
    );
  }

  async uploadDocument(
    userId: string,
    projectId: string,
    file: File,
  ): Promise<ProjectDocument> {
    const now = Date.now();
    const fileName = `${now}_${file.name}`;
    const storagePath = `projects/${projectId}/documents/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // Upload file to Firebase Storage
    await uploadBytes(storageRef, file);

    // Create document metadata in Firestore
    const docData = {
      name: file.name,
      fileName: fileName,
      size: file.size,
      type: file.type,
      storageRef: storagePath,
      uploadedAt: now,
    };

    const docRef = await addDoc(
      this.getDocumentsCollection(projectId),
      docData,
    );

    return {
      id: docRef.id,
      ...docData,
    };
  }

  async deleteDocument(
    userId: string,
    projectId: string,
    documentId: string,
  ): Promise<void> {
    // Get the document to find storage reference
    const docRef = doc(db, "projects", projectId, "documents", documentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data() as ProjectDocument;

      // Delete from Firebase Storage
      const storageRef = ref(storage, data.storageRef);

      try {
        await deleteObject(storageRef);
      } catch (error) {
        console.warn("Failed to delete file from storage:", error);
      }

      // Delete from Firestore
      await deleteDoc(docRef);
    }
  }

  subscribeToDocuments(
    userId: string,
    projectId: string,
    onUpdate: (documents: ProjectDocument[]) => void,
  ): Unsubscribe {
    const q = query(
      this.getDocumentsCollection(projectId),
      orderBy("uploadedAt", "desc"),
    );

    return onSnapshot(q, (querySnapshot) => {
      const documents = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ProjectDocument,
      );

      onUpdate(documents);
    });
  }

  private getExecutorModuleCollection(projectId: string) {
    return collection(db, "projects", projectId, "migration-executor-module");
  }

  subscribeToExecutorModule(
    userId: string,
    projectId: string,
    onUpdate: (
      data: {
        boilerplateDone?: boolean;
        action?: string;
        error?: string;
      } | null,
    ) => void,
  ): Unsubscribe {
    const colRef = this.getExecutorModuleCollection(projectId);

    return onSnapshot(colRef, (querySnapshot) => {
      if (querySnapshot.empty) {
        onUpdate(null);
      } else {
        const docData = querySnapshot.docs[0].data();

        onUpdate({
          boilerplateDone: docData.boilerplateDone,
          action: docData.action,
          error: docData.error,
        });
      }
    });
  }

  async startBoilerplate(userId: string, projectId: string): Promise<void> {
    const colRef = this.getExecutorModuleCollection(projectId);
    const querySnapshot = await getDocs(colRef);

    const now = Date.now();

    if (querySnapshot.empty) {
      // Create new document if none exists
      await addDoc(colRef, {
        action: "start",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing document - set action to "start"
      const docRef = querySnapshot.docs[0].ref;

      await updateDoc(docRef, {
        action: "start",
        updatedAt: now,
      });
    }
  }

  async restartExecutorModule(
    userId: string,
    projectId: string,
  ): Promise<void> {
    const colRef = this.getExecutorModuleCollection(projectId);
    const querySnapshot = await getDocs(colRef);

    const now = Date.now();

    if (querySnapshot.empty) {
      // Create new document if none exists
      await addDoc(colRef, {
        action: "restart",
        boilerplateDone: false,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Update existing document - set action to "restart" and boilerplateDone to false
      const docRef = querySnapshot.docs[0].ref;

      await updateDoc(docRef, {
        action: "restart",
        boilerplateDone: false,
        updatedAt: now,
      });
    }
  }

  async inviteUserToProject(
    inviterId: string,
    projectId: string,
    inviteeEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const now = Date.now();

      // Find user by email in the users collection
      const usersCollection = collection(db, "users");
      const userQuery = query(
        usersCollection,
        where("email", "==", inviteeEmail),
      );
      const userSnapshot = await getDocs(userQuery);

      if (userSnapshot.empty) {
        return { success: false, error: "User not found with this email" };
      }

      const inviteeDoc = userSnapshot.docs[0];
      const inviteeId = inviteeDoc.id;

      // Check if user is already invited or has access to the project
      const inviteeData = inviteeDoc.data();
      const existingProjects: UserProjectReference[] =
        inviteeData.projects || [];
      const alreadyHasAccess = existingProjects.some(
        (p) => p.projectId === projectId,
      );

      if (alreadyHasAccess) {
        return {
          success: false,
          error: "User already has access to this project",
        };
      }

      // Get project to verify it exists and add to sharedWith
      const projectDoc = await getDoc(this.getProjectDoc(projectId));

      if (!projectDoc.exists()) {
        return { success: false, error: "Project not found" };
      }

      // Add project reference to invitee's user document with role "invited"
      const projectRef: UserProjectReference = {
        projectId: projectId,
        role: "invited",
        addedAt: now,
      };

      await updateDoc(inviteeDoc.ref, {
        projects: arrayUnion(projectRef),
      });

      // Add invitee to project's sharedWith array
      const projectData = projectDoc.data();
      const sharedWith = projectData.sharedWith || [];

      // Check if already in sharedWith
      const alreadyShared = sharedWith.some(
        (s: { userId: string }) => s.userId === inviteeId,
      );

      if (!alreadyShared) {
        await updateDoc(this.getProjectDoc(projectId), {
          sharedWith: arrayUnion({
            userId: inviteeId,
            email: inviteeEmail,
            role: "invited",
            sharedAt: now,
            sharedBy: inviterId,
          }),
          updatedAt: now,
        });
      }

      return { success: true };
    } catch (error) {
      console.error("[FirebaseProjectRepository] Error inviting user:", error);

      return { success: false, error: "Failed to invite user" };
    }
  }

  async removeUserFromProject(
    removerId: string,
    projectId: string,
    userIdToRemove: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the project to find the user's share info
      const projectDoc = await getDoc(this.getProjectDoc(projectId));

      if (!projectDoc.exists()) {
        return { success: false, error: "Project not found" };
      }

      const projectData = projectDoc.data();
      const sharedWith = projectData.sharedWith || [];

      // Find the share entry to remove
      const shareToRemove = sharedWith.find(
        (s: { userId: string }) => s.userId === userIdToRemove,
      );

      if (!shareToRemove) {
        return { success: false, error: "User not found in project" };
      }

      // Remove from project's sharedWith array
      await updateDoc(this.getProjectDoc(projectId), {
        sharedWith: arrayRemove(shareToRemove),
        updatedAt: Date.now(),
      });

      // Remove project reference from user's document
      const userDocRef = this.getUserDoc(userIdToRemove);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const projectRefs: UserProjectReference[] = userData.projects || [];
        const projectRefToRemove = projectRefs.find(
          (ref) => ref.projectId === projectId,
        );

        if (projectRefToRemove) {
          await updateDoc(userDocRef, {
            projects: arrayRemove(projectRefToRemove),
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error("[FirebaseProjectRepository] Error removing user:", error);

      return { success: false, error: "Failed to remove user" };
    }
  }
}
