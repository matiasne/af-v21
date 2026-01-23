import { User } from "../entities/User";

export interface AuthRepository {
  signInWithEmail(email: string, password: string): Promise<User>;
  signUpWithEmail(email: string, password: string): Promise<User>;
  signInWithGoogle(): Promise<User>;
  signOut(): Promise<void>;
  getCurrentUser(): User | null;
  onAuthStateChanged(callback: (user: User | null) => void): () => void;
  sendPasswordResetEmail(email: string): Promise<void>;
}
