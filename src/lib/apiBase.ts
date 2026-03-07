const envApiBase = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim();
const isBrowser = typeof window !== "undefined";
const isDev = Boolean((import.meta as any).env?.DEV);

const defaultApiBase =
  isBrowser && !isDev ? `${window.location.origin}/api` : "http://localhost:3001/api";

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1";

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

const resolvedApiBase =
  envApiBase && !shouldRejectEnvApiBase(envApiBase) ? envApiBase : defaultApiBase;

if (isBrowser && envApiBase && resolvedApiBase !== envApiBase) {
  // Minimal diagnostic to explain production fallback behavior.
  console.warn(
    "[apiBase] Ignoring loopback VITE_API_BASE_URL on non-localhost origin; using same-origin /api instead.",
  );
}

export const API_BASE_URL = resolvedApiBase.replace(/\/+$/, "");

export function buildApiUrl(endpoint: string = ""): string {
  if (!endpoint) return API_BASE_URL;
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalized}`;
}
