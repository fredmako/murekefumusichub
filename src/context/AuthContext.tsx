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
import { supabase } from "../lib/supabase"; // <-- import supabase
import { navbarService } from "@/services/navbarService";
import { authService } from "@/services/api";

interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  isComposer?: boolean;
  supabaseId?: string; // UUID from Supabase users table
}

interface AuthContextType {
  firebaseUser: User | null;
  appUser: AppUser | null;
  signOut: (redirect?: boolean) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

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

  // Fetch complete user profile from Supabase by Firebase UID
  const fetchSupabaseUserProfile = async (firebaseUid: string) => {
    try {
      const base =
        (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";
      const response = await fetch(`${base}/users/by-firebase/${firebaseUid}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("User not found in Supabase");
      return await response.json();
    } catch (err) {
      console.warn("Failed to fetch Supabase user profile:", err);
      return null;
    }
  };

  // Check if user is a composer by querying composers table
  const checkComposerStatus = async (
    supabaseUserId: string,
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("composers")
        .select("id")
        .eq("user_id", supabaseUserId)
        .maybeSingle();

      if (error) {
        console.warn("Failed to check composer status:", error);
        return false;
      }
      return !!data;
    } catch (err) {
      console.warn("Error checking composer status:", err);
      return false;
    }
  };

  // Centralized sign-in with email/password
  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    setFirebaseUser(user);

    // Sync to backend and fetch roles (all users default to 'user' role)
    const synced = await authService.syncUser(user);

    // Check composer status
    const isComposer = synced?.id
      ? await checkComposerStatus(synced.id)
      : false;

    setAppUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      roles: synced?.roles || [],
      isComposer,
      supabaseId: synced?.id,
    });

    setIsFirstLogin(true);
  };

  // Centralized sign-up
  const signUpWithEmail = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    setFirebaseUser(user);

    const synced = await authService.syncUser(user);

    const isComposer = synced?.id
      ? await checkComposerStatus(synced.id)
      : false;

    setAppUser({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      roles: synced?.roles || [],
      isComposer,
      supabaseId: synced?.id,
    });

    setIsFirstLogin(true);
  };

  // Centralized Google sign-in
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      setFirebaseUser(user);

      const synced = await authService.syncUser(user);

      const isComposer = synced?.id
        ? await checkComposerStatus(synced.id)
        : false;

      setAppUser({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        roles: synced?.roles || [],
        isComposer,
        supabaseId: synced?.id,
      });

      setIsFirstLogin(true);
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
          // First, try to fetch complete Supabase user profile
          let supabaseUser = await fetchSupabaseUserProfile(user.uid);

          // If user doesn't exist in Supabase, sync them first
          if (!supabaseUser) {
            console.log(
              "[AuthContext] User not found in Supabase, syncing with backend...",
            );
            const base =
              (import.meta as any).VITE_API_BASE_URL ||
              "http://localhost:3001/api";
            const syncRes = await fetch(`${base}/sync-user`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                firebaseUid: user.uid,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.photoURL,
              }),
            });

            if (syncRes.ok) {
              supabaseUser = await syncRes.json();
              console.log(
                "[AuthContext] User synced successfully:",
                supabaseUser,
              );
            } else {
              const errData = await syncRes.json().catch(() => ({}));
              console.warn("[AuthContext] Sync failed:", errData);
            }
          }

          // Fetch roles from server
          const roles = (await navbarService.fetchUserRoles(user.uid)) || [];

          // Check if user is a composer
          const isComposer = supabaseUser
            ? await checkComposerStatus(supabaseUser.id)
            : false;

          // Use Supabase displayName if available, otherwise fall back to Firebase displayName
          setAppUser({
            uid: user.uid,
            email: supabaseUser?.email || user.email,
            displayName: supabaseUser?.display_name || user.displayName,
            roles,
            isComposer,
            supabaseId: supabaseUser?.id,
          });
        } catch (err) {
          console.warn(
            "Failed to fetch user profile from server, using Firebase data:",
            err,
          );
          // Fallback to Firebase data if Supabase fetch fails
          setAppUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            roles: [],
          });
        }
      } else {
        setAppUser(null);
        setIsFirstLogin(false);
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
