import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  WhereFilterOp,
} from "firebase/firestore";

import { db } from "../firebase/config";
import {
  FirestoreRepository,
  FirestoreOperator,
} from "@/domain/repositories/FirestoreRepository";

export class FirestoreRepositoryImpl<T extends { id?: string }>
  implements FirestoreRepository<T>
{
  constructor(private collectionName: string) {}

  async getById(id: string): Promise<T | null> {
    const docRef = doc(db, this.collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return { id: docSnap.id, ...docSnap.data() } as T;
  }

  async getAll(): Promise<T[]> {
    const querySnapshot = await getDocs(collection(db, this.collectionName));

    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as T,
    );
  }

  async create(data: Omit<T, "id">): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), data);

    return docRef.id;
  }

  async update(id: string, data: Partial<T>): Promise<void> {
    const docRef = doc(db, this.collectionName, id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateDoc(docRef, data as any);
  }

  async delete(id: string): Promise<void> {
    const docRef = doc(db, this.collectionName, id);

    await deleteDoc(docRef);
  }

  async query(
    field: string,
    operator: FirestoreOperator,
    value: unknown,
  ): Promise<T[]> {
    const q = query(
      collection(db, this.collectionName),
      where(field, operator as WhereFilterOp, value),
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as T,
    );
  }
}
