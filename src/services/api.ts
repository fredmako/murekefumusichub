import { supabase } from "@/lib/supabase";

const API_BASE_URL =
  (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session) return null;

  const session = data.session;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;

  // Refresh shortly before expiry to avoid edge-case 401s on slow requests.
  if (expiresAt - now <= 30) {
    try {
      const { data: refreshData, error: refreshErr } =
        await supabase.auth.refreshSession();
      if (!refreshErr && refreshData?.session?.access_token) {
        return refreshData.session.access_token;
      }
    } catch {
      // Ignore refresh failures and return existing token as best effort.
    }
  }

  return session.access_token;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const url = `${API_BASE_URL.replace(/\/+$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let errorBody: any = { message: response.statusText };
    try {
      errorBody = await response.json();
    } catch {
      try {
        errorBody = { message: await response.text() };
      } catch {
        // ignore parse failures
      }
    }

    const message =
      errorBody?.message ||
      errorBody?.error ||
      errorBody?.details ||
      "API request failed";
    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).body = errorBody;
    throw err;
  }

  try {
    return await response.json();
  } catch {
    return (await response.text()) as unknown as T;
  }
}

export const authService = {
  async syncUser(authUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }) {
    const ensured = await apiRequest<any>("/users/ensure", {
      method: "POST",
      body: JSON.stringify({
        auth_uid: authUser.id,
        email: authUser.email ?? null,
        display_name: authUser.user_metadata?.name || null,
        avatar_url: authUser.user_metadata?.picture || null,
      }),
    });

    const roles = await apiRequest<string[]>(`/user/roles/${authUser.id}`, {
      method: "GET",
    }).catch(() => []);

    return {
      ...ensured,
      roles: roles || [],
    };
  },

  async getUserRole(authUid: string): Promise<string | null> {
    if (!authUid) return null;
    const roles = await apiRequest<string[]>(`/user/roles/${authUid}`, {
      method: "GET",
    }).catch(() => []);
    return roles.length > 0 ? roles[0] : null;
  },

  async logAudit(userId: string, action: string, payload: any) {
    try {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        action,
        payload,
      });
    } catch (error) {
      console.error("Error logging audit:", error);
    }
  },
};

export const compositionService = {
  async getAll(filters?: {
    category?: string;
    search?: string;
    sortBy?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.category) params.set("category", String(filters.category));
    if (filters?.search) params.set("search", String(filters.search));

    const endpoint = `/compositions${params.toString() ? `?${params.toString()}` : ""}`;
    return await apiRequest<any[]>(endpoint, { method: "GET" });
  },

  async getById(id: string) {
    return await apiRequest(`/compositions/${id}`, { method: "GET" });
  },

  async create(compositionData: {
    title: string;
    description: string;
    category_id?: number;
    price: number;
    pdf_url: string;
    thumbnail_url?: string;
    duration?: string;
    accompaniment?: string;
    voice_parts?: string[];
    composer_id: string;
  }) {
    return await apiRequest(`/compositions`, {
      method: "POST",
      body: JSON.stringify(compositionData),
    });
  },

  async update(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      category_id: number;
      price: number;
      is_published: boolean;
    }>,
  ) {
    return await apiRequest(`/compositions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    await apiRequest(`/compositions/${id}`, {
      method: "DELETE",
    });
  },

  async getByComposer(composerId: string) {
    return await apiRequest(`/compositions/composer/${composerId}`, {
      method: "GET",
    });
  },
};

export const purchaseService = {
  async create(purchaseData: {
    buyer_id: string;
    composition_id: string;
    price_paid: number;
    payment_ref: string;
  }) {
    return await apiRequest(`/purchases`, {
      method: "POST",
      body: JSON.stringify({
        composition_id: purchaseData.composition_id,
        price_paid: purchaseData.price_paid,
        payment_ref: purchaseData.payment_ref,
      }),
    });
  },

  async getByBuyer(_buyerId?: string) {
    return await apiRequest(`/purchases`, { method: "GET" });
  },

  async discard(purchaseId: string) {
    await apiRequest(`/purchases/${purchaseId}`, {
      method: "DELETE",
    });
  },
};

export const fypService = {
  async getRecommendations(_buyerId: string, limit: number = 20) {
    return await apiRequest(`/purchases/recommendations?limit=${limit}`, {
      method: "GET",
    });
  },

  async updatePreferences(_buyerId: string, categoryId: number, weight: number) {
    await apiRequest(`/purchases/preferences`, {
      method: "PUT",
      body: JSON.stringify({
        category_id: categoryId,
        weight,
      }),
    });
  },
};

export const categoryService = {
  async getAll() {
    return await apiRequest(`/categories`, { method: "GET" });
  },

  async create(name: string, description?: string) {
    return await apiRequest(`/categories`, {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  },
};

export const reportService = {
  async create(reportData: {
    reported_by: string;
    composition_id: string;
    reason: string;
    details?: string;
  }) {
    const { data, error } = await supabase
      .from("reports")
      .insert(reportData)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getAll(status?: string) {
    let query = supabase
      .from("reports")
      .select(
        `
          *,
          users!reported_by(display_name, email),
          compositions(title, composer_id)
        `,
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async resolve(
    reportId: string,
    adminNotes: string,
    deleteComposition: boolean = false,
  ) {
    const { error: updateError } = await supabase
      .from("reports")
      .update({
        status: "resolved",
        admin_notes: adminNotes,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    if (updateError) throw updateError;

    if (deleteComposition) {
      const { data: report } = await supabase
        .from("reports")
        .select("composition_id")
        .eq("id", reportId)
        .maybeSingle();

      if (report) {
        await compositionService.delete(report.composition_id);
      }
    }
  },
};

export const storageService = {
  async uploadFile(
    bucket: "compositions" | "thumbnails" | "avatars",
    file: File,
    _userId: string,
  ): Promise<string> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("No authentication token available");
    }

    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_BASE_URL.replace(/\/+$/, "")}/upload/${bucket}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = `Upload failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // ignore parsing failures
      }
      throw new Error(errorMessage);
    }

    const result: any = await response.json();
    if (!result.success || !result.url) {
      throw new Error("Server upload returned no URL");
    }

    return result.url;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  },
};

export const analyticsService = {
  async getComposerStats(composerId: string) {
    const { data: compositions, error: compError } = await supabase
      .from("compositions")
      .select(
        `
          id,
          title,
          price,
          composition_stats(views, purchases)
        `,
      )
      .eq("composer_id", composerId)
      .eq("deleted", false);

    if (compError) throw compError;

    const totalCompositions = compositions.length;
    const totalViews = compositions.reduce(
      (sum, c) => sum + (c.composition_stats?.views || 0),
      0,
    );
    const totalPurchases = compositions.reduce(
      (sum, c) => sum + (c.composition_stats?.purchases || 0),
      0,
    );
    const totalRevenue = compositions.reduce(
      (sum, c) => sum + (c.composition_stats?.purchases || 0) * c.price,
      0,
    );

    return {
      totalCompositions,
      totalViews,
      totalPurchases,
      totalRevenue,
      compositions,
    };
  },

  async getAdminStats() {
    const [
      { count: totalUsers },
      { count: totalCompositions },
      { count: totalPurchases },
      { count: pendingReports },
    ] = await Promise.all([
      supabase.from("users").select("*", { count: "exact", head: true }),
      supabase
        .from("compositions")
        .select("*", { count: "exact", head: true })
        .eq("deleted", false),
      supabase
        .from("purchases")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    return {
      totalUsers: totalUsers || 0,
      totalCompositions: totalCompositions || 0,
      totalPurchases: totalPurchases || 0,
      pendingReports: pendingReports || 0,
    };
  },
};

export { getAccessToken };

export const api = {
  auth: authService,
  compositions: compositionService,
  purchases: purchaseService,
  fyp: fypService,
  categories: categoryService,
  reports: reportService,
  storage: storageService,
  analytics: analyticsService,
};

export default api;
