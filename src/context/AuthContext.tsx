// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../lib/firebase"; // <-- import auth from firebase.ts

interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);

      if (user) {
        const roles: string[] = [];
        if (user.email?.endsWith("@composer.com")) roles.push("composer");
        else roles.push("buyer");

        setAppUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          roles,
        });
      } else {
        setAppUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setAppUser(null);
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, appUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};