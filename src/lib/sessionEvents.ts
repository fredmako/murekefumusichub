export const SESSION_EXPIRED_EVENT = "choral:session-expired";

export interface SessionExpiredDetail {
  at: string;
  endpoint?: string;
  status?: number;
  message?: string;
}

const SESSION_EXPIRED_DEDUP_MS = 4000;
let lastSessionExpiredDispatchAt = 0;

export function dispatchSessionExpired(
  detail: Omit<SessionExpiredDetail, "at"> = {},
) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  if (now - lastSessionExpiredDispatchAt < SESSION_EXPIRED_DEDUP_MS) return;
  lastSessionExpiredDispatchAt = now;

  const payload: SessionExpiredDetail = {
    at: new Date(now).toISOString(),
    ...detail,
  };

  window.dispatchEvent(
    new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, {
      detail: payload,
    }),
  );
}

