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
  where,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { db, storage } from "../firebase/config";
import { Project, ConfigChatMessage, ProjectShare, ProjectDocument } from "@/domain/entities/Project";
import { ProjectRepository } from "@/domain/repositories/ProjectRepository";

export class FirebaseProjectRepository implements ProjectRepository {
  private getProjectsCollection(userId: string) {
    return collection(db, "users", userId, "projects");
  }

  private getProjectDoc(userId: string, projectId: string) {
    return doc(db, "users", userId, "projects", projectId);
  }

  private getConfigChatMessagesCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "configChatMessages"
    );
  }

  private getGeneralChatMessagesCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "generalChatMessages"
    );
  }

  private getLegacyFilesCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "legacy-files"
    );
  }

  async getProjects(userId: string): Promise<Project[]> {
    const q = query(
      this.getProjectsCollection(userId),
      orderBy("createdAt", "desc"),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Project,
    );
  }

  async getProject(userId: string, projectId: string): Promise<Project | null> {
    const docRef = this.getProjectDoc(userId, projectId);
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
    const docRef = await addDoc(this.getProjectsCollection(userId), {
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

    // Create migration-planner-module subcollection with pending action
    const plannerModuleCol = collection(
      db,
      "users",
      userId,
      "projects",
      docRef.id,
      "migration-planner-module"
    );
    await addDoc(plannerModuleCol, {
      action: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Create migration-executor-module subcollection with pending action
    const executorModuleCol = collection(
      db,
      "users",
      userId,
      "projects",
      docRef.id,
      "migration-executor-module"
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
    const docRef = this.getProjectDoc(userId, projectId);

    await updateDoc(docRef, {
      ...data,
      updatedAt: Date.now(),
    });
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const docRef = this.getProjectDoc(userId, projectId);

    await deleteDoc(docRef);
  }

  async getConfigChatMessages(
    userId: string,
    projectId: string
  ): Promise<ConfigChatMessage[]> {
    const q = query(
      this.getConfigChatMessagesCollection(userId, projectId),
      orderBy("timestamp", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as ConfigChatMessage);
  }

  async addConfigChatMessage(
    userId: string,
    projectId: string,
    message: Omit<ConfigChatMessage, "timestamp">
  ): Promise<string> {
    const docRef = await addDoc(
      this.getConfigChatMessagesCollection(userId, projectId),
      {
        ...message,
        timestamp: Date.now(),
      }
    );

    return docRef.id;
  }

  async clearConfigChatMessages(
    userId: string,
    projectId: string
  ): Promise<void> {
    const querySnapshot = await getDocs(
      this.getConfigChatMessagesCollection(userId, projectId)
    );

    const batch = writeBatch(db);
    querySnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  async getGeneralChatMessages(
    userId: string,
    projectId: string
  ): Promise<ConfigChatMessage[]> {
    const q = query(
      this.getGeneralChatMessagesCollection(userId, projectId),
      orderBy("timestamp", "asc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((doc) => doc.data() as ConfigChatMessage);
  }

  async addGeneralChatMessage(
    userId: string,
    projectId: string,
    message: Omit<ConfigChatMessage, "timestamp">
  ): Promise<string> {
    const docRef = await addDoc(
      this.getGeneralChatMessagesCollection(userId, projectId),
      {
        ...message,
        timestamp: Date.now(),
      }
    );

    return docRef.id;
  }

  async getLegacyFilesCount(
    userId: string,
    projectId: string
  ): Promise<number> {
    const querySnapshot = await getDocs(
      this.getLegacyFilesCollection(userId, projectId)
    );

    return querySnapshot.size;
  }

  async updateExecutorModel(
    userId: string,
    projectId: string,
    executorModel: string
  ): Promise<void> {
    console.log("[FirebaseProjectRepository] updateExecutorModel called:", {
      userId,
      projectId,
      executorModel,
    });

    const docRef = this.getProjectDoc(userId, projectId);

    console.log("[FirebaseProjectRepository] Document path:", docRef.path);

    try {
      await updateDoc(docRef, {
        executorModel,
        updatedAt: Date.now(),
      });
      console.log("[FirebaseProjectRepository] Document updated successfully");
    } catch (error) {
      console.error("[FirebaseProjectRepository] Error updating document:", error);
      throw error;
    }
  }

  async getSharedProjects(userId: string): Promise<Project[]> {
    // Query all users' projects where the current user is in the sharedWith array
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);

    const sharedProjects: Project[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const projectsRef = collection(db, "users", userDoc.id, "projects");
      const q = query(projectsRef, orderBy("createdAt", "desc"));
      const projectsSnapshot = await getDocs(q);

      projectsSnapshot.docs.forEach((doc) => {
        const project = { id: doc.id, ...doc.data() } as Project;
        // Check if current user is in sharedWith array
        if (project.sharedWith?.some(share => share.userId === userId)) {
          sharedProjects.push(project);
        }
      });
    }

    return sharedProjects;
  }

  async shareProject(
    userId: string,
    projectId: string,
    share: Omit<ProjectShare, "sharedAt" | "sharedBy">
  ): Promise<void> {
    const docRef = this.getProjectDoc(userId, projectId);

    const projectShare: ProjectShare = {
      ...share,
      sharedAt: Date.now(),
      sharedBy: userId,
    };

    await updateDoc(docRef, {
      sharedWith: arrayUnion(projectShare),
      updatedAt: Date.now(),
    });
  }

  async unshareProject(
    userId: string,
    projectId: string,
    sharedUserId: string
  ): Promise<void> {
    const docRef = this.getProjectDoc(userId, projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Project not found");
    }

    const project = docSnap.data() as Project;
    const updatedShares = (project.sharedWith || []).filter(
      share => share.userId !== sharedUserId
    );

    await updateDoc(docRef, {
      sharedWith: updatedShares,
      updatedAt: Date.now(),
    });
  }

  async updateShareRole(
    userId: string,
    projectId: string,
    sharedUserId: string,
    role: ProjectShare["role"]
  ): Promise<void> {
    const docRef = this.getProjectDoc(userId, projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error("Project not found");
    }

    const project = docSnap.data() as Project;
    const updatedShares = (project.sharedWith || []).map(share =>
      share.userId === sharedUserId ? { ...share, role } : share
    );

    await updateDoc(docRef, {
      sharedWith: updatedShares,
      updatedAt: Date.now(),
    });
  }

  subscribeToProject(
    userId: string,
    projectId: string,
    onUpdate: (project: Project | null) => void
  ): Unsubscribe {
    const docRef = this.getProjectDoc(userId, projectId);

    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        onUpdate({ id: docSnap.id, ...docSnap.data() } as Project);
      } else {
        onUpdate(null);
      }
    });
  }

  async startCodeAnalysis(
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void> {
    const codeAnalysisCol = collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module"
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
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void> {
    const codeAnalysisCol = collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module"
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
    userId: string,
    projectId: string,
    migrationId: string
  ): Promise<void> {
    console.log("[FirebaseProjectRepository] resumeCodeAnalysis called:", { userId, projectId, migrationId });

    const codeAnalysisCol = collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "code-analysis-module"
    );

    // Query for existing code-analysis-module document
    const querySnapshot = await getDocs(codeAnalysisCol);
    console.log("[FirebaseProjectRepository] querySnapshot empty:", querySnapshot.empty);

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
  private getDocumentsCollection(userId: string, projectId: string) {
    return collection(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "documents"
    );
  }

  async getProjectDocuments(
    userId: string,
    projectId: string
  ): Promise<ProjectDocument[]> {
    const q = query(
      this.getDocumentsCollection(userId, projectId),
      orderBy("uploadedAt", "desc")
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as ProjectDocument
    );
  }

  async uploadDocument(
    userId: string,
    projectId: string,
    file: File
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
      this.getDocumentsCollection(userId, projectId),
      docData
    );

    return {
      id: docRef.id,
      ...docData,
    };
  }

  async deleteDocument(
    userId: string,
    projectId: string,
    documentId: string
  ): Promise<void> {
    // Get the document to find storage reference
    const docRef = doc(
      db,
      "users",
      userId,
      "projects",
      projectId,
      "documents",
      documentId
    );
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
    onUpdate: (documents: ProjectDocument[]) => void
  ): Unsubscribe {
    const q = query(
      this.getDocumentsCollection(userId, projectId),
      orderBy("uploadedAt", "desc")
    );

    return onSnapshot(q, (querySnapshot) => {
      const documents = querySnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() }) as ProjectDocument
      );
      onUpdate(documents);
    });
  }
}
