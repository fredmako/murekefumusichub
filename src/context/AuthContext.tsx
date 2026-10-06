// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api-client";
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
  avatar_url: string | null;
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
    // Check if user has any compositions (implies composer profile)
    try {
      const res = await fetch(`${API_BASE_URL}/compositions/composer/${encodeURIComponent(userId)}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        if (res.status === 404) return false;
        console.warn("[hasActiveComposerProfile] fetch failed:", res.status);
        return false;
      }
      const data = await res.json() as { results?: Array<{ id: string }> };
      return Array.isArray(data.results) && data.results.length > 0;
    } catch (err) {
      console.warn("[hasActiveComposerProfile] error:", err);
      return false;
    }
  };

  const withTimeout = async <T,>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string,
  ): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  };

  const fetchServerRoles = async (authUid: string): Promise<string[]> => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/roles/${encodeURIComponent(authUid)}`, {
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

    // Fetch roles from the Worker API (reads from D1 user_roles table)
    try {
      const res = await fetch(`${API_BASE_URL}/user/roles/${encodeURIComponent(userId)}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const apiRoles = await res.json() as string[];
        if (Array.isArray(apiRoles)) {
          for (const r of apiRoles) {
            if (r && !roles.includes(r)) roles.push(r);
          }
        }
      }
    } catch (err) {
      console.warn("[resolveFallbackRoles] roles API lookup failed:", err);
    }

    // Check if user has composer profile
    try {
      const composerActive = await hasActiveComposerProfile(userId);
      if (composerActive && !roles.includes("composer")) roles.push("composer");
    } catch (err) {
      console.warn("[resolveFallbackRoles] composer lookup failed:", err);
    }

    // Check if user is an admin by email
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (normalizedEmail && ADMIN_IDENTIFIERS.includes(normalizedEmail)) {
      if (!roles.includes("admin")) roles.push("admin");
      return roles;
    }

    if (!normalizedEmail) return roles;

    // Fallback admin check via API (if endpoint exists)
    try {
      const res = await fetch(`${API_BASE_URL}/admin/emails/${encodeURIComponent(normalizedEmail)}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        if (!roles.includes("admin")) roles.push("admin");
      }
    } catch (err) {
      // silently ignore
    }

    return roles;
  };

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

      // Try to fetch existing user row by auth_uid via API
      let finalUser: any = undefined;
      try {
        const res = await fetch(`${API_BASE_URL}/users/by-auth-uid/${encodeURIComponent(authUid)}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          finalUser = await res.json();
        } else {
          console.warn("[syncUserProfile] backend profile fetch by auth_uid failed:", res.status);
        }
      } catch (fetchErr) {
        console.warn("[syncUserProfile] backend profile fetch by auth_uid error:", fetchErr);
      }

      if (!finalUser) {
        // If no user row exists, ask the server to ensure the user
        try {
          const { data: authUser, error: authErr } =
            await api.auth.getUser();
          if (authErr) throw authErr;

          const email = authUser?.user?.email ?? null;
          const displayName =
            (authUser?.user?.user_metadata as any)?.name ?? null;
          const avatarUrl =
            (authUser?.user?.user_metadata as any)?.picture ?? null;

          // Call server endpoint to ensure a users row exists
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

          // Fetch the user row by auth_uid
          try {
            const res = await fetch(`${API_BASE_URL}/users/by-auth-uid/${encodeURIComponent(authUid)}`, {
              headers: { "Content-Type": "application/json" },
            });
            if (res.ok) {
              finalUser = await res.json();
            } else {
              console.warn("[syncUserProfile] failed to fetch user row after ensure:", res.status);
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
      console.error("[syncUserProfile] unexpected error:", err);
    }
  };

  // Sign in with email/password
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const { data, error } = await api.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user) throw error;

      // Sync user profile from backend
      await syncUserProfile(data.user.id);
    } catch (err: any) {
      console.error("[signInWithEmail] error:", err);
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

  // Sign up with email/password
  const signUpWithEmail = async (email: string, password: string) => {
    try {
      const emailRedirectTo = buildAuthRedirectUrl("/login");
      const { data, error } = await api.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error || !data.user) throw error;

      if (data.session) {
        await api.auth.signOut().catch(() => null);
      }
    } catch (err: any) {
      console.error("[signUpWithEmail] error:", err);
      throw mapAuthNetworkError(err);
    }
  };

  // Sign in with Google
  const signInWithGoogle = async (nextPath?: string | null) => {
    try {
      const sanitizedNextPath = sanitizeRedirectPath(nextPath);
      const callbackPath = sanitizedNextPath
        ? `/auth/callback?next=${encodeURIComponent(sanitizedNextPath)}`
        : "/auth/callback";
      const redirectTo = buildAuthRedirectUrl(callbackPath);
      const { error } = await api.auth.signInWithOAuth({
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

  // Sign out
  const signOut = async (redirect?: boolean) => {
    try {
      await api.auth.signOut();
      setAppUser(null);
      setIsLoading(false);
      if (redirect) {
        navigate("/login", { replace: true });
      }
    } catch (err) {
      console.error("[signOut] error:", err);
    }
  };

  // Get auth token
  const getAuthToken = async (): Promise<string | null> => {
    return localStorage.getItem("murekefu_auth_token");
  };

  // Refresh roles
  const refreshRoles = async () => {
    if (!appUser) return;
    try {
      const res = await fetch(`${API_BASE_URL}/user/roles/${encodeURIComponent(appUser.auth_uid)}`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const roles = await res.json() as string[];
        if (Array.isArray(roles) && roles.length > 0) {
          setAppUser((prev) =>
            prev
              ? {
                  ...prev,
                  roles,
                  isComposer: roles.includes("composer"),
                }
              : null,
          );
        }
      }
    } catch (err) {
      console.error("[refreshRoles] error:", err);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      const { error } = await api.auth.resetPasswordForEmail(email, {
        redirectTo: buildAuthRedirectUrl("/reset-password"),
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("[resetPassword] error:", err);
      throw mapAuthNetworkError(err);
    }
  };

  // Update password
  const updatePassword = async (password: string) => {
    try {
      const { error } = await api.auth.updateUser({ password });
      if (error) throw error;
    } catch (err: any) {
      console.error("[updatePassword] error:", err);
      throw mapAuthNetworkError(err);
    }
  };

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Verify the token with the backend and reuse that response as the
        // profile source.
        //
        // NOTE: this used to pass `token` (the raw JWT) into syncUserProfile,
        // which put a 300-character bearer token into the URL:
        //   /api/users/by-auth-uid/eyJhbGciOi...
        // That 404'd, so the profile never loaded and the app silently degraded
        // to an empty user. The parameter is a USER ID — the token's `sub`.
        // The previous code also called /auth/verify twice; it is called once
        // here and the verified id is passed on.
        const verified = await fetch(`${API_BASE_URL}/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);

        const verifiedId = verified?.user?.id;
        if (!verifiedId) {
          localStorage.removeItem("murekefu_auth_token");
          setIsLoading(false);
          return;
        }

        await syncUserProfile(verifiedId);
      } catch (err) {
        console.error("[initAuth] error:", err);
        localStorage.removeItem("murekefu_auth_token");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes (e.g., after Google OAuth callback stores token).
    // Without this, AuthContext never knows a token was set and keeps appUser=null,
    // causing a redirect to /login (the "double sign in" bug).
    const { data: authState } = api.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session?.user?.id) {
          await syncUserProfile(session.user.id);
        }
        if (event === "SIGNED_OUT") {
          setAppUser(null);
        }
      },
    );

    return () => {
      authState.subscription.unsubscribe();
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
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
