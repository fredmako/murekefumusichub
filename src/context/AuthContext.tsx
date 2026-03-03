// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { ThemePreset } from "./ThemeContext";

export interface AppUser {
  id: string;
  auth_uid: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null; // ✅ ADD THIS
  theme_settings?: {
    preset?: ThemePreset;
  } | null;
  roles: string[];
  isComposer?: boolean;
}

interface AuthContextType {
  appUser: AppUser | null;
  isLoading: boolean;
  signOut: (redirect?: boolean) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:3001/api";
  const ADMIN_IDENTIFIERS = String(
    (import.meta as any).env?.VITE_ADMIN_IDENTIFIERS || "",
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const isAuthNetworkError = (err: any): boolean => {
    if (!err) return false;
    const name = String(err?.name || "");
    const message = String(err?.message || "").toLowerCase();
    return (
      name === "AuthRetryableFetchError" ||
      name === "TypeError" ||
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("network request failed") ||
      message.includes("timed out") ||
      message.includes("timeout")
    );
  };

  const mapAuthNetworkError = (err: any): Error | any => {
    if (!isAuthNetworkError(err)) return err;
    return new Error(
      "Unable to reach authentication service. Check your internet connection, VPN, firewall, and system clock, then try again.",
    );
  };

  const fetchServerRoles = async (authUid: string): Promise<string[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/roles/${authUid}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return [];
      const roles = await res.json();
      return Array.isArray(roles) ? roles : [];
    } catch (err) {
      console.warn("[fetchServerRoles] error:", err);
      return [];
    }
  };

  const resolveFallbackRoles = async (
    userId: string,
    email: string | null,
  ): Promise<string[]> => {
    const roles = ["buyer"];

    try {
      const { data: composerData } = await supabase
        .from("composers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (composerData && !roles.includes("composer")) roles.push("composer");
    } catch (err) {
      console.warn("[resolveFallbackRoles] composer lookup failed:", err);
    }

    const normalizedEmail = (email || "").trim().toLowerCase();
    if (normalizedEmail && ADMIN_IDENTIFIERS.includes(normalizedEmail)) {
      if (!roles.includes("admin")) roles.push("admin");
      return roles;
    }

    if (!normalizedEmail) return roles;

    try {
      const { data: adminEmailRow, error: adminEmailErr } = await supabase
        .from("admin_emails")
        .select("id")
        .eq("email", normalizedEmail)
        .eq("is_active", true)
        .maybeSingle();
      if (adminEmailErr) throw adminEmailErr;
      if (adminEmailRow && !roles.includes("admin")) roles.push("admin");
    } catch (err) {
      console.warn("[resolveFallbackRoles] admin email lookup failed:", err);
    }

    return roles;
  };

  /**
   * Sync user profile: fetch from Supabase users table and check roles
   */
  const syncUserProfile = async (authUid: string) => {
    try {
      // Try to fetch existing user row by auth_uid
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, auth_uid, email, display_name, avatar_url, theme_settings")
        .eq("auth_uid", authUid)
        .maybeSingle();

      if (userError) throw userError;

      let finalUser = userData;

      // If no user row exists, ask the server to ensure the user (avoids client-side insert conflicts)
      if (!finalUser) {
        try {
          const { data: authUser, error: authErr } =
            await supabase.auth.getUser();
          if (authErr) throw authErr;

          const email = authUser?.user?.email ?? null;
          const displayName =
            (authUser?.user?.user_metadata as any)?.name ?? null;
          const avatarUrl =
            (authUser?.user?.user_metadata as any)?.picture ?? null;

          const base =
            (import.meta as any).env?.VITE_API_BASE_URL ||
            "http://localhost:3001/api";

          // Call server endpoint to ensure a users row exists (server uses service role key)
          try {
            const resp = await fetch(`${base}/users/ensure`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                auth_uid: authUid,
                email,
                display_name: displayName,
                avatar_url: avatarUrl,
              }),
            });

            if (!resp.ok) {
              // log non-ok but continue to try to read existing row (handles 409 conflicts)
              console.warn(
                "[syncUserProfile] ensure-user returned status:",
                resp.status,
              );
            }
          } catch (fetchErr) {
            console.warn(
              "[syncUserProfile] failed to call ensure-user endpoint:",
              fetchErr,
            );
          }

          // Whether the ensure created a row or it already existed, fetch the user row by auth_uid
          try {
            const { data: createdUser, error: fetchUserErr } = await supabase
              .from("users")
              .select("id, auth_uid, email, display_name, avatar_url, theme_settings")
              .eq("auth_uid", authUid)
              .maybeSingle();

            if (fetchUserErr) {
              console.warn(
                "[syncUserProfile] failed to fetch user row after ensure:",
                fetchUserErr,
              );
            } else {
              finalUser = createdUser || undefined;
            }
          } catch (e) {
            console.warn(
              "[syncUserProfile] error fetching user after ensure:",
              e?.message || e,
            );
          }
        } catch (e) {
          console.warn(
            "[syncUserProfile] auth lookup/create failed:",
            e?.message || e,
          );
        }
      }

      if (!finalUser) {
        console.warn(
          "[syncUserProfile] User profile not found and could not be created for auth_uid:",
          authUid,
        );
        return;
      }

      let roles = await fetchServerRoles(authUid);
      if (!Array.isArray(roles) || roles.length === 0) {
        roles = await resolveFallbackRoles(finalUser.id, finalUser.email || null);
      }
      const isComposer = roles.includes("composer");

      setAppUser({
        id: finalUser.id,
        auth_uid: finalUser.auth_uid,
        email: finalUser.email,
        display_name: finalUser.display_name,
        avatar_url: finalUser.avatar_url,
        theme_settings: finalUser.theme_settings || null,
        roles,
        isComposer,
      });
    } catch (err) {
      console.warn("[syncUserProfile] error:", err);
    }
  };

  /**
   * Get current session token
   */
  const getAuthToken = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return null;
      return data.session.access_token;
    } catch (err) {
      console.error("[getAuthToken] error:", err);
      return null;
    }
  };

  /**
   * Refresh roles from Supabase
   */
  const refreshRoles = async () => {
    try {
      if (!appUser) return;
      let roles = await fetchServerRoles(appUser.auth_uid);
      if (!Array.isArray(roles) || roles.length === 0) {
        roles = await resolveFallbackRoles(appUser.id, appUser.email || null);
      }
      const isComposer = roles.includes("composer");

      setAppUser((prev) =>
        prev
          ? {
              ...prev,
              roles,
              isComposer,
            }
          : null,
      );
    } catch (err) {
      console.warn("[refreshRoles] error:", err);
    }
  };

  /**
   * Sign in with email/password
   */
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) throw error;

      // Sync user profile from Supabase users table
      await syncUserProfile(data.user.id);
    } catch (err: any) {
      console.error("[signInWithEmail] error:", err);
      // handle unconfirmed email gracefully
      if (
        err.name === "AuthApiError" &&
        err.status === 400 &&
        typeof err.message === "string" &&
        err.message.toLowerCase().includes("email not confirmed")
      ) {
        throw new Error(
          "Email not confirmed. Please check your inbox and click the confirmation link before signing in.",
        );
      }
      throw mapAuthNetworkError(err);
    }
  };

  /**
   * Sign up with email/password
   */
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error || !data.user) throw error;

      // User created but may not be confirmed yet, try to get session
      if (data.session) {
        await syncUserProfile(data.user.id);
      } else {
        // Email confirmation required - user will verify and then login
        console.log("[signUpWithEmail] Email confirmation required");
      }
    } catch (err: any) {
      console.error("[signUpWithEmail] error:", err);
      throw mapAuthNetworkError(err);
    }
  };

  /**
   * Sign in with Google via Supabase OAuth
   */
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err: any) {
      console.error("[signInWithGoogle] error:", err);
      throw err;
    }
  };

  /**
   * Send password reset email
   */
  const resetPassword = async (email: string) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      // data contains user info maybe
    } catch (err: any) {
      console.error("[resetPassword] error:", err);
      throw err;
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    } catch (err: any) {
      console.error("[updatePassword] error:", err);
      throw err;
    }
  };

  /**
   * Sign out
   */
  const signOut = async (redirect = true) => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setAppUser(null);
      if (redirect) navigate("/login", { replace: true });
    } catch (err: any) {
      console.error("[signOut] error:", err);
      throw err;
    }
  };

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    let mounted = true;
    let subscriptionUnsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        // Retry getSession with exponential backoff to handle navigator lock timeouts
        let retries = 0;
        const maxRetries = 3;
        let lastError: any = null;

        while (retries < maxRetries) {
          try {
            const { data, error } = await supabase.auth.getSession();

            if (error) {
              lastError = error;
              retries++;
              if (retries < maxRetries) {
                await new Promise((resolve) =>
                  setTimeout(resolve, Math.pow(2, retries) * 500),
                );
                continue;
              }
              throw error;
            }

            if (data.session && data.session.user) {
              if (mounted) {
                await syncUserProfile(data.session.user.id);
              }
            } else if (mounted) {
              setAppUser(null);
            }
            break; // Success, exit retry loop
          } catch (err: any) {
            lastError = err;
            // Check if it's a navigator lock timeout error
            if (
              err?.name === "NavigatorLockAcquireTimeoutError" &&
              retries < maxRetries
            ) {
              retries++;
              await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, retries) * 500),
              );
            } else {
              throw err;
            }
          }
        }
      } catch (err: any) {
        if (err?.name === "NavigatorLockAcquireTimeoutError") {
          console.warn(
            "[initAuth] lock timeout; deferring to auth state listener:",
            err,
          );
        } else {
          console.error("[initAuth] error:", err);
        }
        if (mounted) setAppUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const setupAuthListener = () => {
      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        if (session && session.user) {
          await syncUserProfile(session.user.id);
        } else {
          setAppUser(null);
        }
      });

      subscriptionUnsubscribe = data?.subscription?.unsubscribe ?? null;
    };

    // Register listener first, then initialize session read.
    setupAuthListener();
    initAuth().catch((err) => console.warn("[initAuth] setup error:", err));

    return () => {
      mounted = false;
      subscriptionUnsubscribe?.();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        appUser,
        isLoading,
        signOut,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        refreshRoles,
        getAuthToken,
        resetPassword,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
