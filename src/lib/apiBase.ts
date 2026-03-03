const envApiBase = String((import.meta as any).env?.VITE_API_BASE_URL || "").trim();
const isBrowser = typeof window !== "undefined";
const isDev = Boolean((import.meta as any).env?.DEV);

const defaultApiBase =
  isBrowser && !isDev ? `${window.location.origin}/api` : "http://localhost:3001/api";

export const API_BASE_URL = (envApiBase || defaultApiBase).replace(/\/+$/, "");

export function buildApiUrl(endpoint: string = ""): string {
  if (!endpoint) return API_BASE_URL;
  const normalized = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalized}`;
}
