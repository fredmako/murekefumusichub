const envApiBase = String(
  (import.meta as any).env?.VITE_API_BASE_URL || "",
).trim();
const isBrowser = typeof window !== "undefined";
const isDev = Boolean((import.meta as any).env?.DEV);

const defaultApiBase =
  isBrowser && !isDev
    ? `${window.location.origin}/api`
    : "http://localhost:3001/api";

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

const hasApiBasePath = (pathname: string) => {
  const normalized = String(pathname || "")
    .replace(/\/+$/, "")
    .toLowerCase();
  return normalized === "/api" || normalized.startsWith("/api/");
};

const shouldRejectEnvApiBase = (candidate: string): boolean => {
  if (!candidate || !isBrowser) return false;

  // Relative values like `/api` are valid in all environments.
  if (!/^https?:\/\//i.test(candidate)) return false;

  try {
    const apiUrl = new URL(candidate);
    const appUrl = new URL(window.location.origin);

    // In production domains, never use a loopback API URL.
    if (!isLoopbackHost(appUrl.hostname) && isLoopbackHost(apiUrl.hostname)) {
      return true;
    }
  } catch {
    // Ignore parse failures and let normal fallback rules handle it.
  }

  return false;
};

const resolveApiBaseFromEnv = (candidate: string): string => {
  if (!candidate) return defaultApiBase;

  // Relative path config
  if (/^\//.test(candidate)) {
    const normalizedRelative = candidate.replace(/\/+$/, "");
    if (hasApiBasePath(normalizedRelative)) {
      return normalizedRelative;
    }
    return "/api";
  }

  // Absolute URL config
  try {
    const parsed = new URL(candidate);
    const parsedPath = parsed.pathname || "/";

    if (hasApiBasePath(parsedPath)) {
      return parsed.toString().replace(/\/+$/, "");
    }

    // Same-origin absolute values without /api are usually misconfigured in Vercel env vars.
    if (isBrowser) {
      const appOrigin = new URL(window.location.origin).origin;
      if (parsed.origin === appOrigin) {
        return `${appOrigin}/api`;
      }
    }

    // Remote absolute URL without path: append /api for this backend contract.
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/api`;
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return defaultApiBase;
  }
};

const resolvedApiBase =
  envApiBase && !shouldRejectEnvApiBase(envApiBase)
    ? resolveApiBaseFromEnv(envApiBase)
    : defaultApiBase;

if (isBrowser && envApiBase && resolvedApiBase !== envApiBase) {
  // Minimal diagnostic to explain production fallback behavior.
  console.warn(
    "[apiBase] Normalized VITE_API_BASE_URL for current origin/backend contract.",
  );
}

export const API_BASE_URL = resolvedApiBase.replace(/\/+$/, "");

export function buildApiUrl(endpoint: string = ""): string {
  if (!endpoint) return API_BASE_URL;
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalized}`;
}
