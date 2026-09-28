/**
 * Cloudflare-native auth + API client for Murekefu Music Hub.
 *
 * Replaces the Supabase JS client. All auth state, user data, and DB
 * operations go through the same-origin /api endpoints served by the
 * Cloudflare Worker (JWT auth + D1 backend).
 */

const TOKEN_KEY = "murekefu_auth_token";
const REFRESH_KEY = "murekefu_refresh_token";
const EXPIRY_KEY = "murekefu_token_expiry";
const USER_KEY = "murekefu_user";

function nowSecs(): number {
  return Math.floor(Date.now() / 1000);
}

function isExpired(): boolean {
  const exp = parseInt(localStorage.getItem(EXPIRY_KEY) || "0", 10);
  return exp === 0 || nowSecs() >= exp;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  if (isExpired()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
  if (typeof window === "undefined") return;
  const expiry = nowSecs() + Math.max(1, expiresIn);
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(EXPIRY_KEY, String(expiry));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(USER_KEY);
}

export interface MwUser {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  roles: string[];
}

let cachedUser: MwUser | null = null;

export function getUser(): MwUser | null {
  if (typeof window === "undefined") return null;
  if (cachedUser) return cachedUser;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { cachedUser = JSON.parse(raw); return cachedUser; } catch { return null; }
}

export function setUser(user: MwUser): void {
  if (typeof window === "undefined") return;
  cachedUser = user;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  cachedUser = null;
  clearAuth();
}

const API_BASE = typeof window !== "undefined" ? window.location.origin + "/api" : "";

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const url = API_BASE + path;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as Record<string, string> || {}),
  };
  const token = getAuthToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  return fetch(url, { ...opts, headers });
}

export interface SignInResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: MwUser;
}

export async function signInWithEmail(email: string, password: string): Promise<SignInResult> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Login failed (${res.status})`);
  }
  const data = await res.json();
  setAuthTokens(data.access_token, data.refresh_token || "", data.expires_in || 86400);
  if (data.user) setUser(data.user);
  return data;
}

export async function registerUser(
  email: string,
  password: string,
  displayName: string | null,
): Promise<SignInResult> {
  const res = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Registration failed (${res.status})`);
  }
  const data = await res.json();
  setAuthTokens(data.access_token, data.refresh_token || "", data.expires_in || 86400);
  if (data.user) setUser(data.user);
  return data;
}

export async function getCurrentUser(): Promise<MwUser | null> {
  const cached = getUser();
  if (cached && !isExpired()) return cached;
  const token = getAuthToken();
  if (!token) return null;
  const res = await apiFetch("/users/me", { method: "GET" });
  if (!res.ok) {
    if (res.status === 401) { clearUser(); return null; }
    throw new Error("Failed to fetch user profile");
  }
  const user = await res.json();
  setUser(user);
  return user;
}

export async function refreshSession(): Promise<boolean> {
  const refreshToken = typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;
  if (!refreshToken) return false;
  const res = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) { clearAuth(); clearUser(); return false; }
  const data = await res.json();
  setAuthTokens(data.access_token, data.refresh_token || refreshToken, data.expires_in || 86400);
  if (data.user) setUser(data.user);
  return true;
}

type AuthChangeHandler = (event: "SIGNED_IN" | "SIGNED_OUT" | "TIMESTAMP_UPDATED", session: MwUser | null) => void;
const handlers = new Set<AuthChangeHandler>();

export function onAuthStateChange(handler: AuthChangeHandler): { unsubscribe: () => void } {
  handlers.add(handler);
  return { unsubscribe: () => handlers.delete(handler) };
}

function notifyAuthChange(event: "SIGNED_IN" | "SIGNED_OUT" | "TIMESTAMP_UPDATED", session: MwUser | null): void {
  for (const h of handlers) { try { h(event, session); } catch {} }
}

export const supabase = {
  auth: {
    getSession: async () => {
      const token = getAuthToken();
      if (!token || isExpired()) {
        const ok = await refreshSession();
        if (!ok) return { data: { session: null }, error: null };
      }
      const user = getUser();
      return { data: { session: user ? { access_token: token!, user } : null }, error: null };
    },
    getUser: async () => {
      const user = await getCurrentUser();
      if (!user) return { data: { user: null }, error: { message: "Not authenticated" } };
      return { data: { user }, error: null };
    },
    signInWithPassword: async (opts: { email: string; password: string }) => {
      const result = await signInWithEmail(opts.email, opts.password);
      return { data: { session: result.user, user: result.user }, error: null };
    },
    signUp: async (opts: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      const result = await registerUser(opts.email, opts.password, opts.options?.data?.display_name as string || null);
      return { data: { session: result.user, user: result.user }, error: null };
    },
    refreshSession: async () => {
      const ok = await refreshSession();
      if (!ok) return { data: { session: null }, error: { message: "Refresh failed" } };
      const user = getUser();
      return { data: { session: user ? { access_token: getAuthToken()!, user } : null }, error: null };
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      const unsub = onAuthStateChange((ev, sess) => {
        callback(ev === "SIGNED_IN" ? "INITIAL_SESSION" : ev === "SIGNED_OUT" ? "SIGNED_OUT" : "TOKEN_REFRESHED", sess);
      });
      const user = getUser();
      if (user && !isExpired()) callback("INITIAL_SESSION", { user });
      return { unsubscribe: unsub.unsubscribe };
    },
  },
  from: function (table: string) {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === "select" || prop === "insert" || prop === "update" || prop === "delete" || prop === "remove") {
          return new Proxy({}, {
            get(_, subprop) {
              if (["eq", "single", "order", "maybeSingle", "returns"].includes(String(subprop))) {
                return () => Promise.reject(new Error(
                  `Direct DB access via supabase.from() removed. Use apiService (${table}) instead. See src/services/api.ts.`
                ));
              }
              return () => Promise.reject(new Error(`Direct DB access via supabase.from() removed.`));
            },
            apply(_, __, args) {
              return Promise.reject(new Error(`Direct DB access via supabase.from() removed.`));
            }
          });
        }
        return () => Promise.reject(new Error(`Direct DB access via supabase.from() removed.`));
      },
      apply(_, __, args) {
        return Promise.reject(new Error(`Direct DB access via supabase.from() removed.`));
      }
    });
  },
  storage: {
    from: function (bucket: string) {
      return {
        upload: async () => Promise.reject(new Error(`Supabase Storage (${bucket}) removed. Use /api/upload/${bucket} via storageService.`)),
        remove: async () => Promise.reject(new Error("Supabase Storage removed. Use /api/upload/community via storageService.")),
        getPublicUrl: () => ({ data: { publicUrl: "" }, error: { message: "Not available" } }),
        createSignedUrl: async () => Promise.reject(new Error("Signed URLs not available")),
      };
    },
  },
  channel: function (name: string) {
    const subscribers = new Set<(payload: any) => void>();
    return {
      subscribe: async () => ({ error: null }),
      unsubscribe: async () => { subscribers.clear(); return { error: null }; },
      send: async () => ({ error: null }),
      on: (_event: string, callback: (payload: any) => void) => {
        subscribers.add(callback);
        return { unsubscribe: () => subscribers.delete(callback) };
      },
      removeChannel: () => { subscribers.clear(); },
    };
  },
} as const;

export default supabase;
