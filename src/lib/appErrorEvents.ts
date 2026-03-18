export const APP_ERROR_EVENT = "choral:app-error";

export type AppErrorAction = "ok" | "refresh" | "exit" | "report";

export interface AppErrorDetail {
  id?: string;
  title?: string;
  message: string;
  rawMessage?: string;
  status?: number;
  actions?: AppErrorAction[];
  exitTo?: string;
  reportable?: boolean;
  source?: string;
}

const APP_ERROR_DEDUP_MS = 4000;
let lastAppErrorAt = 0;
let lastAppErrorKey = "";

export function dispatchAppError(detail: AppErrorDetail) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const key = `${detail.status || ""}:${detail.message || ""}`.slice(0, 220);
  if (key === lastAppErrorKey && now - lastAppErrorAt < APP_ERROR_DEDUP_MS) return;

  lastAppErrorAt = now;
  lastAppErrorKey = key;

  window.dispatchEvent(
    new CustomEvent<AppErrorDetail>(APP_ERROR_EVENT, { detail }),
  );
}
