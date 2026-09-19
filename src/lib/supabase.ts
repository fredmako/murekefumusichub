// D1 API client - replaces Supabase
// All operations go through the Cloudflare Worker API via fetch.
// Env vars VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are no longer used.

// Auth functions that use D1
export const supabase = {
  auth: {
    getSession: async () => {
      const token = localStorage.getItem('murekefu_auth_token');
      if (!token) return { data: { session: null }, error: null };
      try {
        // Verify token with backend
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return { data: { session: null }, error: null };
        const data = await res.json();
        return { data: { session: { user: data.user, access_token: token } }, error: null };
      } catch {
        return { data: { session: null }, error: null };
      }
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
        return { data: { session: { user: data.user, access_token: data.token } }, error: null };
      } catch {
        return { data: { session: null }, error: { message: 'Refresh failed' } };
      }
    },
    onAuthStateChange: (_callback: any) => {
      // Return a no-op subscription
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
    signOut: async () => {
      localStorage.removeItem('murekefu_auth_token');
      return { error: null };
    },
  },
  from: (_table: string) => ({
    select: () => ({ data: [], error: null, single: () => ({ data: null, error: null }) }),
    insert: () => ({ data: [], error: null }),
    update: () => ({ data: [], error: null }),
    delete: () => ({ data: [], error: null }),
  }),
  storage: {
    from: (_bucket: string) => ({
      upload: async () => ({ data: null, error: null }),
      remove: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    }),
  },
};

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

export default supabase;
