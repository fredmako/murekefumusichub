// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/firebase"; // <-- import auth from firebase.ts
import { navbarService } from "@/services/navbarService";
import { authService } from "@/services/api";

interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
}

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  signOut: (redirect?: boolean) => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
    roleHint?: string,
  ) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    roleHint?: string,
  ) => Promise<void>;
  signInWithGoogle: (roleHint?: string) => Promise<void>;
  refreshRoles: () => Promise<void>;
  setUserRole: (role: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);

  // Refresh roles from server and update appUser
  const refreshRoles = async () => {
    try {
      if (!firebaseUser) return;
      const roles =
        (await navbarService.fetchUserRoles(firebaseUser.uid)) || [];
      setAppUser((prev) => ({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        roles,
      }));
      return roles;
    } catch (err) {
      console.warn("refreshRoles failed:", err);
      return [] as string[];
    }
  };

  // Assign a role to the current user (server-side sync) and refresh roles
  const setUserRole = async (role: string) => {
    if (!firebaseUser) return;
    try {
      await authService.syncUser(firebaseUser, role);
      await refreshRoles();
    } catch (err) {
      console.error("setUserRole failed:", err);
      throw err;
    }
  };

  // Centralized sign-in with email/password
  const signInWithEmail = async (
    email: string,
    password: string,
    roleHint?: string,
  ) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    setFirebaseUser(user);

    // Sync to backend and fetch roles (provide roleHint if caller indicates a purchase/enroll)
    const synced = await authService.syncUser(user, roleHint || "user");
    setAppUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      roles: synced?.roles || [],
    });
  };

  // Centralized sign-up
  const signUpWithEmail = async (
    email: string,
    password: string,
    roleHint?: string,
  ) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    setFirebaseUser(user);

    const synced = await authService.syncUser(user, roleHint || "user");
    setAppUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      roles: synced?.roles || [],
    });
  };

  // Centralized Google sign-in
  const signInWithGoogle = async (roleHint?: string) => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      setFirebaseUser(user);

      const synced = await authService.syncUser(user, roleHint || "user");
      setAppUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        roles: synced?.roles || [],
      });
    } catch (err: any) {
      // If popup blocked, try redirect
      if (
        err?.code === "auth/popup-blocked" ||
        err?.code === "auth/cancelled-popup-request"
      ) {
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (user) {
        try {
          // Try to sync and fetch authoritative roles
          const synced = await authService.syncUser(user, undefined);
          setAppUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            roles: synced?.roles || [],
          });
        } catch (err) {
          // fallback: try to fetch roles only
          try {
            const roles = (await navbarService.fetchUserRoles(user.uid)) || [];
            setAppUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              roles,
            });
          } catch (err2) {
            console.warn(
              "Failed to fetch roles from server, defaulting to empty roles:",
              err2,
            );
            setAppUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              roles: [],
            });
          }
        }
      } else {
        setAppUser(null);
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async (redirect = true) => {
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setAppUser(null);
      if (redirect) navigate("/");
    } catch (err) {
      console.error("Sign out failed:", err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        signOut,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        refreshRoles,
        setUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
