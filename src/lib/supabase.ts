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

// Decode the `exp` claim from our own JWT.
//
// The Worker returns `{ token, user }` — it does NOT return `expires_in`, and
// nothing ever wrote the EXPIRY_KEY. So `isExpired()` saw no expiry key, parsed
// it as 0, and returned TRUE — which made getAuthToken() DELETE the token and
// return null on the very next read. That is why a successful login appeared to
// work, then every subsequent request failed with an auth error. Fall back to
// the token's own `exp` claim, which is always present.
function tokenExpiry(token: string | null): number {
  if (!token) return 0;
  try {
    const part = token.split(".")[1];
    if (!part) return 0;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp : 0;
  } catch {
    return 0;
  }
}

function isExpired(): boolean {
  const stored = parseInt(localStorage.getItem(EXPIRY_KEY) || "0", 10);
  // Prefer the stored expiry; otherwise read it off the token itself.
  const exp = stored > 0 ? stored : tokenExpiry(localStorage.getItem(TOKEN_KEY));
  // An unparseable/absent expiry must NOT be treated as expired — that
  // silently logs the user out. Only a real, passed expiry counts.
  if (!exp) return false;
  return nowSecs() >= exp;
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

// The Worker returns `{ token, user }`, NOT `{ access_token, refresh_token,
// expires_in }`. Reading `data.access_token` yielded undefined, so the token was
// never stored under TOKEN_KEY and the session appeared to log itself out.
function persistSession(data: any) {
  const token = data.token || data.access_token;
  if (!token) return;
  const expiresIn = Number(data.expires_in) > 0
    ? Number(data.expires_in)
    : Math.max(60, tokenExpiry(token) - nowSecs() || 86400);
  setAuthTokens(token, data.refresh_token || "", expiresIn);
  if (data.user) setUser(data.user);
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
  persistSession(data);
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
  const regToken = data.token || data.access_token || "";
  const regExp = Number(data.expires_in) > 0
    ? Number(data.expires_in)
    : Math.max(60, tokenExpiry(regToken) - nowSecs() || 86400);
  setAuthTokens(regToken, data.refresh_token || "", regExp);
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
  const token = data.token || data.access_token || "";
  const refExp = Number(data.expires_in) > 0
    ? Number(data.expires_in)
    : Math.max(60, tokenExpiry(token) - nowSecs() || 86400);
  setAuthTokens(token, data.refresh_token || refreshToken, refExp);
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
      if (!token) return { data: { session: null }, error: null };
      if (isExpired()) {
        const ok = await refreshSession();
        if (!ok) return { data: { session: null }, error: null };
      }
      const user = getUser();
      // expires_at is REQUIRED: api.ts computes
      // `session.expires_at - now <= 30` to decide whether to refresh, and a
      // missing value (undefined -> 0) makes that true on EVERY request.
      const live = getAuthToken();
      const exp = tokenExpiry(live);
      return {
        data: {
          session: {
            access_token: live ?? token,
            user,
            expires_at: exp || nowSecs() + 86400,
          },
        },
        error: null,
      };
    },
    getUser: async () => {
      const user = await getCurrentUser();
      if (!user) return { data: { user: null }, error: { message: "Not authenticated" } };
      return { data: { user }, error: null };
    },
    signInWithPassword: async (opts: { email: string; password: string }) => {
      const result = await signInWithEmail(opts.email, opts.password);
      // `session` must be a SESSION object, not the user — api.ts reads
      // `data.session.access_token` and `data.session.expires_at`.
      return {
        data: {
          session: {
            access_token: getAuthToken() ?? "",
            user: result.user,
            expires_at: tokenExpiry(getAuthToken()) || nowSecs() + 86400,
          },
          user: result.user,
        },
        error: null,
      };
    },
    signUp: async (opts: { email: string; password: string; options?: { data?: Record<string, unknown> } }) => {
      const result = await registerUser(opts.email, opts.password, opts.options?.data?.display_name as string || null);
      return {
        data: {
          session: {
            access_token: getAuthToken() ?? "",
            user: result.user,
            expires_at: tokenExpiry(getAuthToken()) || nowSecs() + 86400,
          },
          user: result.user,
        },
        error: null,
      };
    },
    refreshSession: async () => {
      const ok = await refreshSession();
      if (!ok) return { data: { session: null }, error: { message: "Refresh failed" } };
      const user = getUser();
      const live = getAuthToken();
      return {
        data: {
          session: {
            access_token: live ?? "",
            user,
            expires_at: tokenExpiry(live) || nowSecs() + 86400,
          },
        },
        error: null,
      };
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
