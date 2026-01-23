"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

import { User } from "@/domain/entities/User";
import { AuthRepository } from "@/domain/repositories/AuthRepository";
import { FirebaseAuthRepository } from "@/infrastructure/repositories/FirebaseAuthRepository";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<User>;
  signUpWithEmail: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authRepository: AuthRepository = new FirebaseAuthRepository();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = authRepository.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (
    email: string,
    password: string,
  ): Promise<User> => {
    const user = await authRepository.signInWithEmail(email, password);

    setUser(user);

    return user;
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
  ): Promise<User> => {
    const user = await authRepository.signUpWithEmail(email, password);

    setUser(user);

    return user;
  };

  const signInWithGoogle = async (): Promise<User> => {
    const user = await authRepository.signInWithGoogle();

    setUser(user);

    return user;
  };

  const signOut = async (): Promise<void> => {
    await authRepository.signOut();
    setUser(null);
  };

  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    await authRepository.sendPasswordResetEmail(email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOut,
        sendPasswordResetEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
