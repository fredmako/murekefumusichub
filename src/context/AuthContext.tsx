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
import { normalizeAvatarUrl } from "../lib/avatarUrl";
import { API_BASE_URL } from "@/lib/apiBase";
import type {
  ThemeDarkHue,
  ThemeIconScale,
  ThemeLayoutDensity,
  ThemeMode,
  ThemePreset,
  ThemeSurfaceStyle,
  ThemeUiScale,
} from "./ThemeContext";
import { sanitizeRedirectPath } from "@/lib/authRedirect";

const AUTH_SESSION_TIMEOUT_MS = 12000;
const AUTH_PROFILE_SYNC_TIMEOUT_MS = 15000;
const AUTH_INIT_WATCHDOG_MS = 25000;

export interface AppUser {
  id: string;
  auth_uid: string;
  email: string | null;
  display_name: string | null;
  phone?: string | null;
  avatar_url: string | null; // ✅ ADD THIS
  theme_settings?: {
    preset?: ThemePreset;
    mode?: ThemeMode;
    darkHue?: ThemeDarkHue;
    uiScale?: ThemeUiScale;
    iconScale?: ThemeIconScale;
    layoutDensity?: ThemeLayoutDensity;
    surfaceStyle?: ThemeSurfaceStyle;
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
  signInWithGoogle: (nextPath?: string | null) => Promise<void>;
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
  const ADMIN_IDENTIFIERS = String(
    (import.meta as any).env?.VITE_ADMIN_IDENTIFIERS || "",
  )
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const AUTH_REDIRECT_BASE = String(
    (import.meta as any).env?.VITE_AUTH_REDIRECT_BASE_URL || "",
  ).trim();

  const getAuthRedirectBase = (): string => {
    const candidates: string[] = [];
    if (AUTH_REDIRECT_BASE) candidates.push(AUTH_REDIRECT_BASE);
    if (typeof window !== "undefined" && window.location?.origin) {
      candidates.push(window.location.origin);
    }
    candidates.push("http://localhost:5173");

    for (const raw of candidates) {
      try {
        const parsed = new URL(raw);
        return parsed.origin;
      } catch {
        // try next candidate
      }
    }

    return "http://localhost:5173";
  };

  const buildAuthRedirectUrl = (path: string): string => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getAuthRedirectBase()}${normalizedPath}`;
  };

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

  const isMissingComposerActivationColumnError = (err: any): boolean => {
    const code = String(err?.code || "").toUpperCase();
    const message = String(err?.message || "").toLowerCase();
    return (
      code === "42703" ||
      code === "PGRST204" ||
      code === "PGRST205" ||
      message.includes("is_active")
    );
  };

  const hasActiveComposerProfile = async (userId: string): Promise<boolean> => {
    const activeQuery = await supabase
      .from("composers")
      .select("id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (activeQuery.error && isMissingComposerActivationColumnError(activeQuery.error)) {
      const fallback = await supabase
        .from("composers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      return Boolean(fallback.data);
    }

    if (activeQuery.error) throw activeQuery.error;
    return Boolean(activeQuery.data);
  };

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
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
      const composerActive = await hasActiveComposerProfile(userId);
      if (composerActive && !roles.includes("composer")) roles.push("composer");
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
      // Prefer backend profile endpoint so avatar URLs can be refreshed/signed server-side.
      try {
        const encodedAuthUid = encodeURIComponent(authUid);
        const resp = await fetch(`${API_BASE_URL}/users/by-auth-uid/${encodedAuthUid}`, {
          headers: { "Content-Type": "application/json" },
        });

        if (resp.ok) {
          const serverUser = await resp.json();
          let roles = Array.isArray(serverUser?.roles) ? serverUser.roles : [];
          if (!roles.length) {
            roles = await resolveFallbackRoles(
              serverUser?.id || "",
              serverUser?.email || null,
            );
          }

          setAppUser({
            id: serverUser.id,
            auth_uid: serverUser.auth_uid,
            email: serverUser.email,
            display_name: serverUser.display_name,
            phone: serverUser.phone ?? null,
            avatar_url: normalizeAvatarUrl(serverUser.avatar_url),
            theme_settings: serverUser.theme_settings || null,
            roles,
            isComposer: roles.includes("composer"),
          });
          return;
        }
      } catch (serverFetchErr) {
        console.warn("[syncUserProfile] backend profile fetch failed:", serverFetchErr);
      }

      // Try to fetch existing user row by auth_uid
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, auth_uid, email, display_name, phone, avatar_url, theme_settings")
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

          // Call server endpoint to ensure a users row exists (server uses service role key)
          try {
            const resp = await fetch(`${API_BASE_URL}/users/ensure`, {
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
              .select("id, auth_uid, email, display_name, phone, avatar_url, theme_settings")
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
      const normalizedAvatarUrl = normalizeAvatarUrl(finalUser.avatar_url);

      setAppUser({
        id: finalUser.id,
        auth_uid: finalUser.auth_uid,
        email: finalUser.email,
        display_name: finalUser.display_name,
        phone: (finalUser as any).phone ?? null,
        avatar_url: normalizedAvatarUrl,
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
      const emailRedirectTo = buildAuthRedirectUrl("/login");
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error || !data.user) throw error;

      // Keep signup flow on sign-in state; user should verify email then sign in.
      if (data.session) {
        await supabase.auth.signOut().catch(() => null);
      }
    } catch (err: any) {
      console.error("[signUpWithEmail] error:", err);
      throw mapAuthNetworkError(err);
    }
  };

  /**
   * Sign in with Google via Supabase OAuth
   */
  const signInWithGoogle = async (nextPath?: string | null) => {
    try {
      const sanitizedNextPath = sanitizeRedirectPath(nextPath);
      const callbackPath = sanitizedNextPath
        ? `/auth/callback?next=${encodeURIComponent(sanitizedNextPath)}`
        : "/auth/callback";
      const redirectTo = buildAuthRedirectUrl(callbackPath);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
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
        redirectTo: buildAuthRedirectUrl("/reset-password"),
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
      const { error } = await withTimeout(
        supabase.auth.signOut(),
        8000,
        "Global sign out",
      );
      if (error) throw error;
    } catch (err: any) {
      console.warn(
        "[signOut] global sign out failed; attempting local sign out:",
        err,
      );
      try {
        await withTimeout(
          supabase.auth.signOut({ scope: "local" } as any),
          4000,
          "Local sign out",
        );
      } catch (localErr: any) {
        console.warn("[signOut] local sign out fallback failed:", localErr);
      }
    } finally {
      // Always clear local auth state to avoid UI flicker/redirect loops when
      // network is unstable during sign-out.
      setAppUser(null);
      if (redirect) navigate("/login", { replace: true });
    }
  };

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    let mounted = true;
    let subscriptionUnsubscribe: (() => void) | null = null;
    let authInitWatchdog: ReturnType<typeof setTimeout> | null = null;

    const initAuth = async () => {
      authInitWatchdog = setTimeout(() => {
        if (!mounted) return;
        console.warn(
          `[initAuth] watchdog reached ${AUTH_INIT_WATCHDOG_MS}ms; forcing auth loading state to false.`,
        );
        setIsLoading(false);
      }, AUTH_INIT_WATCHDOG_MS);

      try {
        // Retry getSession with exponential backoff to handle navigator lock timeouts
        let retries = 0;
        const maxRetries = 3;
        let lastError: any = null;

        while (retries < maxRetries) {
          try {
            const { data, error } = await withTimeout(
              supabase.auth.getSession(),
              AUTH_SESSION_TIMEOUT_MS,
              "Auth session lookup",
            );

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
                try {
                  await withTimeout(
                    syncUserProfile(data.session.user.id),
                    AUTH_PROFILE_SYNC_TIMEOUT_MS,
                    "Profile sync",
                  );
                } catch (profileErr: any) {
                  console.warn("[initAuth] profile sync failed:", profileErr);
                  setAppUser(null);
                }
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
        if (authInitWatchdog) {
          clearTimeout(authInitWatchdog);
          authInitWatchdog = null;
        }
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

