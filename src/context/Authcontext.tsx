// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut, User } from "firebase/auth";
import { getStorage } from "firebase/storage";

// --- Hard-coded Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyCwI4aE5-p-NYm60p97IG0aKijccPI0sxI",
  authDomain: "prime-media-7216b.firebaseapp.com",
  projectId: "prime-media-7216b",
  storageBucket: "prime-media-7216b.appspot.com",
  messagingSenderId: "497607749297",
  appId: "1:497607749297:web:d113e9a79fd1799f803c90",
  measurementId: "G-NFG3EB5Q7F",
};

// --- Initialize Firebase ---
let app;
let auth;
let storage;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  storage = getStorage(app);
} catch (err) {
  console.error("Firebase initialization failed:", err);
}

// --- Types ---
interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: string[]; // e.g., ['buyer', 'composer', 'admin']
}

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  signOut: () => Promise<void>;
}

// --- Create Context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);

      // Example: map firebase user to app roles
      if (user) {
        const roles: string[] = []; // customize roles assignment logic
        // e.g., if email includes 'composer', push 'composer'
        if (user.email?.endsWith("@composer.com")) roles.push("composer");
        else roles.push("buyer"); // default role

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
    if (!auth) return;
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

// --- Hook to use AuthContext ---
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};