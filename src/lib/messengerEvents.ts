export const MESSENGER_INBOX_UPDATED_EVENT = "messenger:inbox-updated";

export function emitMessengerInboxUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MESSENGER_INBOX_UPDATED_EVENT));
}

