export const POST_LOGIN_REDIRECT_KEY = "post_login_redirect";

const AUTH_PATH_PREFIXES = ["/login", "/auth/callback"];

const isAuthPath = (path: string): boolean =>
  AUTH_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`),
  );

const normalizeAbsoluteInternalUrl = (value: string): string | null => {
  try {
    const parsed = new URL(value);
    if (typeof window !== "undefined" && parsed.origin !== window.location.origin) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

export const sanitizeRedirectPath = (
  value: string | null | undefined,
  options: { allowAuthPath?: boolean } = {},
): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? normalizeAbsoluteInternalUrl(trimmed)
      : trimmed;

  if (!normalized) return null;
  if (!normalized.startsWith("/") || normalized.startsWith("//")) return null;
  if (!options.allowAuthPath && isAuthPath(normalized)) return null;

  return normalized;
};

export const getCurrentPathWithQuery = (): string => {
  if (typeof window === "undefined") return "/";
  const { pathname, search, hash } = window.location;
  return `${pathname || "/"}${search || ""}${hash || ""}`;
};

export const readPostLoginRedirect = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    return sanitizeRedirectPath(raw);
  } catch {
    return null;
  }
};

export const persistPostLoginRedirect = (
  path: string | null | undefined,
): string | null => {
  const sanitized = sanitizeRedirectPath(path);
  if (!sanitized) return null;
  if (typeof window === "undefined") return sanitized;
  try {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, sanitized);
  } catch {
    // ignore storage failures
  }
  return sanitized;
};

export const clearPostLoginRedirect = () => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // ignore storage failures
  }
};

export const resolvePostLoginRedirect = (options: {
  queryNext?: string | null;
  consume?: boolean;
} = {}): string | null => {
  const fromQuery = sanitizeRedirectPath(options.queryNext);
  const fromStorage = readPostLoginRedirect();
  const resolved = fromQuery || fromStorage;
  if (options.consume !== false) {
    clearPostLoginRedirect();
  }
  return resolved;
};

export const buildLoginPath = (options: {
  nextPath?: string | null;
  reason?: string | null;
  intent?: string | null;
} = {}): string => {
  const params = new URLSearchParams();
  const nextPath = sanitizeRedirectPath(options.nextPath);
  if (nextPath) params.set("next", nextPath);
  if (options.reason) params.set("reason", options.reason);
  if (options.intent) params.set("intent", options.intent);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
};

