import { supabase } from "@/lib/supabase";
import { buildApiUrl } from "@/lib/apiBase";
import { dispatchSessionExpired } from "@/lib/sessionEvents";
import { dispatchAppError } from "@/lib/appErrorEvents";

const ACCESS_TOKEN_SESSION_TIMEOUT_MS = 8000;
const ACCESS_TOKEN_REFRESH_TIMEOUT_MS = 12000;
const AUTH_REFRESH_BASE_BACKOFF_MS = 4000;
const AUTH_REFRESH_MAX_BACKOFF_MS = 45000;
const AUTH_TOKEN_DIAGNOSTIC_DEDUP_MS = 12000;

let authRefreshFailures = 0;
let authRefreshCooldownUntil = 0;
let lastAuthTokenDiagnosticAt = 0;
let lastAuthTokenDiagnosticKey = "";

type AccessTokenResolution =
  | { status: "ok"; token: string }
  | { status: "no_session"; reason: string }
  | { status: "transient_failure"; reason: string; statusCode: 408 | 503 };
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
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
}

function isTransientAuthNetworkError(err: any): boolean {
  if (!err) return false;
  const name = String(err?.name || "");
  const message = String(err?.message || "").toLowerCase();
  return (
    name === "TypeError" ||
    name === "AuthRetryableFetchError" ||
    name === "NavigatorLockAcquireTimeoutError" ||
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("network changed") ||
    message.includes("err_network_changed") ||
    message.includes("navigator lock") ||
    message.includes("lockacquiretimeout") ||
    message.includes("timeout") ||
    message.includes("timed out")
  );
}

function isTimeoutLikeError(err: any): boolean {
  if (!err) return false;
  const name = String(err?.name || "");
  const message = String(err?.message || "").toLowerCase();
  return (
    name === "AbortError" ||
    name === "NavigatorLockAcquireTimeoutError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("lockacquiretimeout")
  );
}

function isSessionMissingError(err: any): boolean {
  if (!err) return false;
  const message = String(err?.message || "").toLowerCase();
  return (
    message.includes("auth session missing") ||
    message.includes("session missing") ||
    message.includes("missing refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("invalid refresh token") ||
    message.includes("session not found")
  );
}

function getTransientStatusCode(err: any): 408 | 503 {
  return isTimeoutLikeError(err) ? 408 : 503;
}

function logAccessTokenDiagnostic(
  status: "no_session" | "transient_failure",
  reason: string,
) {
  const key = `${status}:${reason}`;
  const now = Date.now();
  if (
    key === lastAuthTokenDiagnosticKey &&
    now - lastAuthTokenDiagnosticAt < AUTH_TOKEN_DIAGNOSTIC_DEDUP_MS
  ) {
    return;
  }
  lastAuthTokenDiagnosticAt = now;
  lastAuthTokenDiagnosticKey = key;
  console.warn(`[auth-token] ${status} (${reason})`);
}

function canAttemptRefreshNow(): boolean {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (!online) return false;
  return Date.now() >= authRefreshCooldownUntil;
}

function registerRefreshFailure() {
  authRefreshFailures += 1;
  const backoffMs = Math.min(
    AUTH_REFRESH_MAX_BACKOFF_MS,
    AUTH_REFRESH_BASE_BACKOFF_MS * Math.max(1, authRefreshFailures),
  );
  authRefreshCooldownUntil = Date.now() + backoffMs;
}

function registerRefreshSuccess() {
  authRefreshFailures = 0;
  authRefreshCooldownUntil = 0;
}

async function refreshSessionSafely(
  reason: string,
  timeoutMs: number = ACCESS_TOKEN_REFRESH_TIMEOUT_MS,
): Promise<AccessTokenResolution> {
  if (!canAttemptRefreshNow()) {
    logAccessTokenDiagnostic("transient_failure", `${reason}:refresh_cooldown`);
    return {
      status: "transient_failure",
      reason: "refresh_cooldown",
      statusCode: 503,
    };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.auth.refreshSession(),
      timeoutMs,
      reason,
    );
    if (error) {
      registerRefreshFailure();
      if (isSessionMissingError(error)) {
        logAccessTokenDiagnostic("no_session", `${reason}:refresh_error`);
        return { status: "no_session", reason: "refresh_error_no_session" };
      }
      logAccessTokenDiagnostic("transient_failure", `${reason}:refresh_error`);
      return {
        status: "transient_failure",
        reason: "refresh_error",
        statusCode: getTransientStatusCode(error),
      };
    }

    if (!data?.session?.access_token) {
      registerRefreshFailure();
      logAccessTokenDiagnostic("no_session", `${reason}:refresh_no_session`);
      return { status: "no_session", reason: "refresh_no_session" };
    }

    registerRefreshSuccess();
    return { status: "ok", token: data.session.access_token };
  } catch (err: any) {
    registerRefreshFailure();
    if (isSessionMissingError(err)) {
      logAccessTokenDiagnostic("no_session", `${reason}:refresh_exception`);
      return { status: "no_session", reason: "refresh_exception_no_session" };
    }
    if (isTransientAuthNetworkError(err)) {
      logAccessTokenDiagnostic("transient_failure", `${reason}:refresh_exception`);
      return {
        status: "transient_failure",
        reason: "refresh_exception",
        statusCode: getTransientStatusCode(err),
      };
    }
    logAccessTokenDiagnostic("transient_failure", `${reason}:refresh_unknown`);
    return { status: "transient_failure", reason: "refresh_unknown", statusCode: 503 };
  }
}

async function getAccessToken(): Promise<AccessTokenResolution> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      ACCESS_TOKEN_SESSION_TIMEOUT_MS,
      "Session lookup",
    );

    if (error) {
      if (isSessionMissingError(error)) {
        logAccessTokenDiagnostic("no_session", "get_session_error_no_session");
        return { status: "no_session", reason: "get_session_error_no_session" };
      }
      if (isTransientAuthNetworkError(error)) {
        const refreshed = await refreshSessionSafely(
          "Session refresh after getSession error",
        );
        if (refreshed.status === "ok") return refreshed;
        logAccessTokenDiagnostic("transient_failure", "get_session_transient_error");
        return {
          status: "transient_failure",
          reason: "get_session_transient_error",
          statusCode: getTransientStatusCode(error),
        };
      }
      logAccessTokenDiagnostic("transient_failure", "get_session_error_unknown");
      return {
        status: "transient_failure",
        reason: "get_session_error_unknown",
        statusCode: 503,
      };
    }

    if (!data?.session) {
      const refreshed = await refreshSessionSafely("Session refresh");
      if (refreshed.status === "ok") return refreshed;
      if (refreshed.status === "transient_failure") {
        logAccessTokenDiagnostic("transient_failure", "session_missing_refresh_failed");
        return refreshed;
      }
      logAccessTokenDiagnostic("no_session", "no_active_session");
      return { status: "no_session", reason: "no_active_session" };
    }

    const session = data.session;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;

    // Refresh shortly before expiry to avoid edge-case 401s on slow requests.
    if (expiresAt - now <= 30) {
      try {
        const refreshed = await refreshSessionSafely(
          "Proactive session refresh",
        );
        if (refreshed.status === "ok") return refreshed;
      } catch {
        // Ignore refresh failures and return existing token as best effort.
      }
    }

    return { status: "ok", token: session.access_token };
  } catch (err: any) {
    if (isSessionMissingError(err)) {
      logAccessTokenDiagnostic("no_session", "get_session_exception_no_session");
      return { status: "no_session", reason: "get_session_exception_no_session" };
    }
    if (isTransientAuthNetworkError(err)) {
      logAccessTokenDiagnostic("transient_failure", "get_session_exception_transient");
      return {
        status: "transient_failure",
        reason: "get_session_exception_transient",
        statusCode: getTransientStatusCode(err),
      };
    }
    logAccessTokenDiagnostic("transient_failure", "get_session_exception_unknown");
    return {
      status: "transient_failure",
      reason: "get_session_exception_unknown",
      statusCode: 503,
    };
  }
}

function isRetriableNetworkError(err: any): boolean {
  if (!err) return false;
  const name = String(err?.name || "");
  const message = String(err?.message || "").toLowerCase();
  if (name === "AbortError") return true;
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("network changed") ||
    message.includes("err_network_changed") ||
    message.includes("load failed") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function shouldRetryRequest(method: string): boolean {
  const m = String(method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

async function readResponsePayload(
  response: Response,
): Promise<{ text: string; json: any | null }> {
  try {
    const text = await response.text();
    if (!text) return { text: "", json: null };

    try {
      return { text, json: JSON.parse(text) };
    } catch {
      return { text, json: null };
    }
  } catch {
    return { text: "", json: null };
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number; requiresAuth?: boolean } = {},
): Promise<T> {
  const { timeoutMs = 20000, requiresAuth = false, ...requestOptions } = options;
  const tokenResult = await getAccessToken();
  const token = tokenResult.status === "ok" ? tokenResult.token : null;

  if (requiresAuth && tokenResult.status !== "ok") {
    if (tokenResult.status === "no_session") {
      dispatchSessionExpired({
        endpoint,
        status: 401,
        message: "No bearer token provided",
      });
      const err = new Error("Your session has expired. Please log in again.");
      (err as any).status = 401;
      (err as any).reason = tokenResult.reason;
      throw err;
    }

    const statusCode = tokenResult.statusCode || 503;
    const transientMessage =
      statusCode === 408
        ? "Authentication timed out. Please check your connection and try again."
        : "Authentication is temporarily unavailable. Please retry in a moment.";
    dispatchAppError({
      title: "Connection issue",
      message: transientMessage,
      status: statusCode,
      actions: ["refresh", "ok"],
    });
    const err = new Error(transientMessage);
    (err as any).status = statusCode;
    (err as any).reason = tokenResult.reason;
    throw err;
  }

  const baseHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {}),
  };

  const url = buildApiUrl(endpoint);
  const externalSignal = requestOptions.signal;

  const executeFetch = async (bearerToken: string | null): Promise<Response> => {
    const headers: HeadersInit = {
      ...baseHeaders,
    };
    if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;

    const controller = new AbortController();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(url, {
        ...requestOptions,
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const method = String(requestOptions.method || "GET").toUpperCase();
  const maxAttempts = shouldRetryRequest(method) ? 2 : 1;
  let response: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await executeFetch(token);
      break;
    } catch (err: any) {
      const isLastAttempt = attempt >= maxAttempts;
      const retriable = isRetriableNetworkError(err);

      if (!isLastAttempt && retriable) {
        const backoffMs = 350 * attempt;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }

      if (err?.name === "AbortError") {
        const timeoutError = new Error(
          "Request timed out. Please check your connection and try again.",
        );
        (timeoutError as any).status = 408;
        throw timeoutError;
      }

      if (retriable) {
        const networkError = new Error(
          "Network changed or unavailable. Please reconnect and try again.",
        );
        (networkError as any).status = 503;
        throw networkError;
      }

      throw err;
    }
  }

  if (!response) {
    throw new Error("Request failed before receiving a response");
  }

  // If the access token is stale, refresh and retry once automatically.
  if (response.status === 401 && token) {
    try {
      const refreshed = await refreshSessionSafely(
        "401 response session refresh",
        10000,
      );

      if (refreshed.status === "ok" && refreshed.token !== token) {
        response = await executeFetch(refreshed.token);
      }
    } catch {
      // Keep original 401 response path.
    }
  }

  if (!response.ok) {
    const payload = await readResponsePayload(response);
    const errorBody: any =
      payload.json ?? { message: payload.text || response.statusText };

    const message =
      errorBody?.message ||
      errorBody?.error ||
      errorBody?.details ||
      "API request failed";

    const authMessage = String(message || "").toLowerCase();
    const looksLikeExpiredSession =
      authMessage.includes("expired") ||
      authMessage.includes("invalid token") ||
      authMessage.includes("invalid or expired token") ||
      authMessage.includes("jwt") ||
      authMessage.includes("no bearer token");

    // Only emit global session-expired when we had a token and server indicates
    // the token/session is actually invalid. This avoids false logouts caused by
    // transient token lookup/network issues.
    if (response.status === 401 && token && looksLikeExpiredSession) {
      dispatchSessionExpired({
        endpoint,
        status: 401,
        message,
      });
    }

    if ((response.status >= 500) || response.status === 503 || response.status === 408) {
      dispatchAppError({
        title: response.status >= 500 ? "Server error" : "Connection issue",
        message: message || "A request failed.",
        status: response.status,
        actions: response.status >= 500 ? ["refresh", "exit", "ok"] : ["refresh", "ok"],
      });
    }

    const err = new Error(message);
    (err as any).status = response.status;
    (err as any).body = errorBody;
    throw err;
  }

  const payload = await readResponsePayload(response);
  if (payload.json !== null) {
    return payload.json as T;
  }
  if (payload.text) {
    return payload.text as unknown as T;
  }
  return undefined as unknown as T;
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
    return await apiRequest<any[]>(endpoint, {
      method: "GET",
      timeoutMs: 45000,
    });
  },

  async getById(id: string) {
    return await apiRequest(`/compositions/${id}`, { method: "GET" });
  },

  async create(compositionData: {
    title: string;
    description: string;
    category_id?: number;
    price: number;
    price_currency?: string;
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
      price_currency: string;
      is_published: boolean;
      difficulty: string | null;
      duration: string | null;
      language: string | null;
      accompaniment: string | null;
      voice_parts: string[] | null;
      pdf_url: string | null;
      thumbnail_url: string | null;
    }>,
  ) {
    return await apiRequest(`/compositions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  async delete(id: string) {
    await apiRequest(`/compositions/${id}?hard=true`, {
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
      requiresAuth: true,
    });
  },

  async getByBuyer(_buyerId?: string) {
    return await apiRequest(`/purchases`, { method: "GET", requiresAuth: true });
  },

  async getDownloadLink(purchaseId: string) {
    return await apiRequest<{
      purchaseId: string;
      compositionId: string;
      fileName: string;
      downloadUrl: string;
    }>(`/purchases/${purchaseId}/download`, {
      method: "GET",
      requiresAuth: true,
      timeoutMs: 25000,
    });
  },

  async discard(purchaseId: string) {
    await apiRequest(`/purchases/${purchaseId}`, {
      method: "DELETE",
      requiresAuth: true,
    });
  },
};

export const checkoutService = {
  async submitManualPayment(payload: {
    mpesaCode: string;
    items: Array<{ composition_id: string }>;
  }) {
    return await apiRequest<{
      success: boolean;
      checkoutBatchId: string;
      totalAmount: number;
      mpesa?: {
        businessNumber?: string;
        accountNo?: string;
        businessName?: string;
        paymentUrl?: string;
      };
      submitted: Array<{
        id: string;
        composition_id: string;
        amount: number;
        status: string;
      }>;
      skipped?: {
        alreadyPurchased?: string[];
        alreadyPending?: string[];
      };
    }>(`/checkout/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 25000,
      requiresAuth: true,
    });
  },

  async getMyCheckoutStatus() {
    return await apiRequest<any[]>(`/checkout/status`, {
      method: "GET",
      requiresAuth: true,
    });
  },
};

export const fypService = {
  async getRecommendations(_buyerId: string, limit: number = 20) {
    return await apiRequest(`/purchases/recommendations?limit=${limit}`, {
      method: "GET",
      requiresAuth: true,
    });
  },

  async updatePreferences(_buyerId: string, categoryId: number, weight: number) {
    await apiRequest(`/purchases/preferences`, {
      method: "PUT",
      body: JSON.stringify({
        category_id: categoryId,
        weight,
      }),
      requiresAuth: true,
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

export const enrollmentService = {
  async submit(payload: {
    full_name: string;
    email: string;
    music_class: string;
    skill_level: string;
    notes?: string;
  }) {
    return await apiRequest<{
      success: boolean;
      message: string;
      enrollment: any;
    }>(`/enrollments`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 30000,
    });
  },

  async getMine(limit: number = 100) {
    return await apiRequest<any[]>(`/enrollments/my?limit=${limit}`, {
      method: "GET",
      timeoutMs: 30000,
    });
  },
};

export const registrationService = {
  async getRegulations() {
    return await apiRequest<{
      enrollmentFee: number;
      composerRequestFee: number;
      bankName: string;
      bankAccountNumber: string;
      accountName: string;
      controllingAdminIdentifier?: string;
      updatedAt?: string | null;
    }>(`/registration/regulations`, {
      method: "GET",
      timeoutMs: 20000,
    });
  },

  async getMyPayments(type?: "enrollment" | "composer_request") {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    return await apiRequest<any[]>(
      `/registration/payments/my${params.toString() ? `?${params.toString()}` : ""}`,
      {
        method: "GET",
        timeoutMs: 20000,
      },
    );
  },

  async submitPayment(payload: {
    registrationType: "enrollment" | "composer_request";
    paymentRef: string;
  }) {
    return await apiRequest<{
      success: boolean;
      message: string;
      submission: any;
      regulations?: any;
    }>(`/registration/payments/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 25000,
      requiresAuth: true,
    });
  },
};

export const mediaService = {
  async getLandingImages(options?: {
    query?: string;
    perPage?: number;
    mode?: "instruments" | "mixed";
    queries?: string[];
  }) {
    const query = options?.query || "choir music performance";
    const perPage = options?.perPage ?? 12;
    const mode = options?.mode || "instruments";
    const params = new URLSearchParams();
    params.set("query", query);
    params.set("perPage", String(perPage));
    params.set("mode", mode);
    if (Array.isArray(options?.queries) && options.queries.length > 0) {
      params.set("queries", options.queries.join(","));
    }
    return await apiRequest<{
      source: string;
      mode?: string;
      items: Array<{
        id: number;
        photographer: string;
        width?: number;
        height?: number;
        alt?: string;
        src: {
          large2x?: string | null;
          large?: string | null;
          landscape?: string | null;
          medium?: string | null;
        };
        url?: string | null;
      }>;
    }>(`/media/landing-images?${params.toString()}`, { method: "GET" });
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
    options?: { timeoutMs?: number },
  ): Promise<string> {
    const tokenResult = await getAccessToken();
    if (tokenResult.status !== "ok") {
      if (tokenResult.status === "no_session") {
        const err = new Error("Your session has expired. Please log in again.");
        (err as any).status = 401;
        throw err;
      }
      const err = new Error(
        tokenResult.statusCode === 408
          ? "Authentication timed out. Please check your connection and try again."
          : "Authentication is temporarily unavailable. Please retry in a moment.",
      );
      (err as any).status = tokenResult.statusCode || 503;
      throw err;
    }
    const token = tokenResult.token;

    if (!file) {
      throw new Error("No file selected for upload");
    }

    if (bucket === "avatars" && file.size > 8 * 1024 * 1024) {
      throw new Error("Avatar file is too large. Please use an image under 8MB.");
    }

    if (
      (bucket === "avatars" || bucket === "thumbnails") &&
      !String(file.type || "").startsWith("image/")
    ) {
      throw new Error("Only image files are allowed for avatar and thumbnail uploads.");
    }

    if (
      bucket === "compositions" &&
      !["application/pdf", "application/octet-stream"].includes(
        String(file.type || "").toLowerCase(),
      )
    ) {
      throw new Error("Only PDF files are allowed for composition uploads.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const url = buildApiUrl(`/upload/${bucket}`);
    const timeoutMs = Math.max(5000, options?.timeoutMs ?? 30000);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error("Upload timed out. Please check your network and try again.");
      }
      throw new Error(
        error?.message || "Upload failed due to a network error. Please try again.",
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

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
  checkout: checkoutService,
  fyp: fypService,
  categories: categoryService,
  enrollments: enrollmentService,
  registration: registrationService,
  media: mediaService,
  reports: reportService,
  storage: storageService,
  analytics: analyticsService,
};

export default api;
