import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

import { auth, db } from "../firebase/config";

import { AuthRepository } from "@/domain/repositories/AuthRepository";
import { User } from "@/domain/entities/User";

const mapFirebaseUser = (firebaseUser: FirebaseUser): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
  emailVerified: firebaseUser.emailVerified,
});

const createOrUpdateUserDocument = async (
  firebaseUser: FirebaseUser,
): Promise<void> => {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      createdAt: Date.now(),
      projects: [],
    });
  }
};

export class FirebaseAuthRepository implements AuthRepository {
  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(auth, email, password);

    return mapFirebaseUser(result.user);
  }

  async signUpWithEmail(email: string, password: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    await createOrUpdateUserDocument(result.user);

    return mapFirebaseUser(result.user);
  }

  async signInWithGoogle(): Promise<User> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);

    await createOrUpdateUserDocument(result.user);

    return mapFirebaseUser(result.user);
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  getCurrentUser(): User | null {
    const user = auth.currentUser;

    return user ? mapFirebaseUser(user) : null;
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return firebaseOnAuthStateChanged(auth, (firebaseUser) => {
      callback(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
    });
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    await firebaseSendPasswordResetEmail(auth, email);
  }

  async setPassword(password: string): Promise<void> {
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      throw new Error("No user is currently signed in or user has no email");
    }

    const credential = EmailAuthProvider.credential(
      currentUser.email,
      password,
    );

    await linkWithCredential(currentUser, credential);
  }

  hasPasswordProvider(): boolean {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return false;
    }

    return currentUser.providerData.some(
      (provider) => provider.providerId === "password",
    );
  }
}
