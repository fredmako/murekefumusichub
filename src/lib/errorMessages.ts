const HTML_TAG_RE = /<[^>]+>/g;

function stripHtml(raw: string) {
  return raw
    .replace(HTML_TAG_RE, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function simplifyErrorMessage(message: string, status?: number) {
  const raw = String(message || "").trim();
  const cleaned = stripHtml(raw);
  const lower = cleaned.toLowerCase();

  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }
  if (status === 403) {
    return "You do not have permission to complete that action.";
  }
  if (status === 404) {
    return "That item could not be found. Please refresh and try again.";
  }
  if (status === 408 || lower.includes("timeout")) {
    return "This request took too long. Check your connection and try again.";
  }
  if (status === 503 || lower.includes("network") || lower.includes("failed to fetch")) {
    return "We could not reach the server. Please check your connection and try again.";
  }
  if (status && status >= 500) {
    return "The server hit an error. Please try again or refresh the page.";
  }
  if (
    lower.includes("cannot post") ||
    lower.includes("unexpected token") ||
    lower.includes("<!doctype") ||
    raw.includes("<html")
  ) {
    return "The server sent an unexpected response. Please refresh and try again.";
  }

  if (!cleaned) {
    return "Something went wrong. Please try again.";
  }

  return cleaned.length > 260 ? `${cleaned.slice(0, 260)}...` : cleaned;
}

export function shouldOfferReport(message: string, status?: number) {
  const raw = String(message || "");
  const cleaned = stripHtml(raw);
  if (status && status >= 500) return true;
  if (HTML_TAG_RE.test(raw)) return true;
  if (cleaned.length > 160) return true;
  if (cleaned.toLowerCase().includes("unexpected")) return true;
  return false;
}

export function buildErrorReportMessage(detail: {
  title?: string;
  message?: string;
  status?: number;
  source?: string;
}) {
  const lines = [
    "User reported an application error.",
    "",
    `Title: ${detail.title || "Unknown error"}`,
    `Status: ${detail.status || "Unknown"}`,
    `Message: ${String(detail.message || "").trim() || "No message"}`,
    `Source: ${detail.source || "app"}`,
    `Page: ${typeof window !== "undefined" ? window.location.href : "unknown"}`,
    `Time: ${new Date().toISOString()}`,
  ];
  return lines.join("\n");
}
