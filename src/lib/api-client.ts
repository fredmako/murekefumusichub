// API client for Murekefu Music Hub — wraps Cloudflare Worker REST endpoints via fetch.
// Replaces the old Supabase client. All DB operations go through /api/* endpoints;
// auth calls /api/auth/*.

// Decode the JWT payload locally.
//
// CRITICAL: `getSession()` must return a real `expires_at`. api.ts reads
// `session.expires_at` and, when it is missing/0, evaluates
// `expiresAt - now <= 30` as ALWAYS TRUE — so every single API call fired a
// redundant refresh round-trip. That doubled latency, and the added
// /api/auth/me + /api/auth/refresh pair of requests, is what produced the
// recurring `[auth-token] transient_failure (get_session_exception_transient)`
// warning and made protected features like "my purchases" fail on a perfectly
// valid token. The expiry is already in the token; there is no reason to make a
// network call to discover it.
function decodeJwtPayload(token: string | null): Record<string, any> | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function sessionFromToken(token: string | null, user: any = null) {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  return {
    user: user || { id: payload.sub, email: payload.email, roles: payload.roles || [] },
    access_token: token,
    expires_at: typeof payload.exp === 'number' ? payload.exp : 0,
    roles: payload.roles || [],
  };
}

export const api = {
  auth: {
    getSession: async () => {
      const token = localStorage.getItem('murekefu_auth_token');
      if (!token) return { data: { session: null }, error: null };

      // Decode locally first. If the token is expired we can say so without
      // any network call, which is the common case and must stay cheap.
      const local = sessionFromToken(token);
      if (!local) return { data: { session: null }, error: null };
      if (local.expires_at && local.expires_at <= Math.floor(Date.now() / 1000)) {
        return { data: { session: null }, error: null };
      }

      // A still-valid token is returned WITHOUT hitting the network. Callers
      // only need the token string; /api/auth/me is not on the hot path.
      return { data: { session: local }, error: null };
    },
    refreshSession: async () => {
      const token = localStorage.getItem('murekefu_auth_token');
      if (!token) return { data: { session: null }, error: { message: 'No token' } };
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { data: { session: null }, error: { message: 'Refresh failed' } };
        const data = await res.json();
        if (data.token) localStorage.setItem('murekefu_auth_token', data.token);
        const session = sessionFromToken(data.token, data.user);
        if (!session) return { data: { session: null }, error: { message: 'Refresh returned no token' } };
        return { data: { session }, error: null };
      } catch {
        return { data: { session: null }, error: { message: 'Refresh failed' } };
      }
    },
    onAuthStateChange: (_callback: any) => {
      return { data: { subscription: { unsubscribe: () => {} } }, error: null };
    },
    signInWithPassword: async ({ email, password }: any) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return { data: { session: null }, error: { message: 'Login failed' } };
      const data = await res.json();
      if (data.token) localStorage.setItem('murekefu_auth_token', data.token);
      return { data: { session: { user: data.user, access_token: data.token } }, error: null };
    },
    signUp: async ({ email, password }: any) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return { data: { session: null }, error: { message: 'Signup failed' } };
      const data = await res.json();
      if (data.token) localStorage.setItem('murekefu_auth_token', data.token);
      return { data: { session: { user: data.user, access_token: data.token } }, error: null };
    },
    signInWithOAuth: async ({ provider, options }: { provider: string; options?: { redirectTo?: string } }) => {
      if (provider !== 'google') return { error: { message: 'Only Google OAuth is supported' } };
      try {
        const redirectTo = options?.redirectTo || '/auth/callback';
        const redirectUri = typeof window !== 'undefined'
          ? window.location.origin + redirectTo
          : 'http://localhost:5173' + redirectTo;

        // Get the Google OAuth URL from the worker (keeps client_id server-side)
        const res = await fetch('/api/auth/oauth/google', {
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => 'Failed to get OAuth URL');
          return { error: { message: msg } };
        }
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          return { error: { message: 'No OAuth URL returned' } };
        }
        return { error: null };
      } catch (err: any) {
        return { error: { message: err.message || 'OAuth initiation failed' } };
      }
    },
    exchangeCode: async (code: string, redirectUri: string) => {
      try {
        const res = await fetch('/api/auth/oauth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Code exchange failed' }));
          return { data: null, error: { message: data.error || 'Code exchange failed' } };
        }
        const data = await res.json();
        if (data.token) localStorage.setItem('murekefu_auth_token', data.token);
        return { data: { session: { user: data.user, access_token: data.token } }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Code exchange failed' } };
      }
    },
    signOut: async () => {
      const token = localStorage.getItem('murekefu_auth_token');
      if (token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      localStorage.removeItem('murekefu_auth_token');
      return { error: null };
    },
  },

  // Table operations — route through the API where supported, no-op elsewhere
  from: (_table: string) => ({
    select: () => ({ data: [], error: null, single: () => ({ data: null, error: null }) }),
    insert: () => ({ data: [], error: null }),
    update: () => ({ data: [], error: null }),
    delete: () => ({ data: [], error: null }),
  }),

  // Storage shim — unused; uploads now go through /api/upload/* endpoints
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
};

export default api;

// Types for database tables
export interface User {
  id: string;
  auth_uid: string | null;
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
}

export interface Role {
  id: number;
  name: 'buyer' | 'composer' | 'admin';
}

export interface Composition {
  id: string;
  composer_id: string;
  title: string;
  description: string | null;
  category_id: number | null;
  price: number;
  file_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  is_published: boolean;
  deleted: boolean;
}

export interface Purchase {
  id: string;
  buyer_id: string;
  composition_id: string;
  purchased_at: string;
  price_paid: number;
  payment_ref: string | null;
  is_active: boolean;
  metadata: any | null;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}
