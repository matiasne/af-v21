import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from "firebase/firestore";

import { db } from "../firebase/config";
import { ProcessorInfo } from "@/domain/entities/ProcessorInfo";
import { ProcessorRepository } from "@/domain/repositories/ProcessorRepository";

export class FirebaseProcessorRepository implements ProcessorRepository {
  private getProcessorsCollection() {
    return collection(db, "processors");
  }

  async getProcessors(): Promise<ProcessorInfo[]> {
    const processorsRef = this.getProcessorsCollection();
    const snapshot = await getDocs(processorsRef);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      hostname: doc.data().hostname,
      ipAddress: doc.data().ipAddress,
      lastHeartbeat: doc.data().lastHeartbeat,
      pid: doc.data().pid,
      startedAt: doc.data().startedAt,
      status: doc.data().status,
    }));
  }

  async getRunningProcessors(): Promise<ProcessorInfo[]> {
    const processorsRef = this.getProcessorsCollection();
    const q = query(processorsRef, where("status", "==", "running"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      hostname: doc.data().hostname,
      ipAddress: doc.data().ipAddress,
      lastHeartbeat: doc.data().lastHeartbeat,
      pid: doc.data().pid,
      startedAt: doc.data().startedAt,
      status: doc.data().status,
    }));
  }

  subscribeProcessors(
    onUpdate: (processors: ProcessorInfo[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const processorsRef = this.getProcessorsCollection();

    const unsubscribe: Unsubscribe = onSnapshot(
      processorsRef,
      (snapshot) => {
        const processors = snapshot.docs.map((doc) => ({
          id: doc.id,
          hostname: doc.data().hostname,
          ipAddress: doc.data().ipAddress,
          lastHeartbeat: doc.data().lastHeartbeat,
          pid: doc.data().pid,
          startedAt: doc.data().startedAt,
          status: doc.data().status as ProcessorInfo["status"],
        }));
        onUpdate(processors);
      },
      (error) => {
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  }
}

export const processorRepository = new FirebaseProcessorRepository();
