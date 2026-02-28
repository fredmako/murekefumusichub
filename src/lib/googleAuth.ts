// src/lib/googleAuth.ts
// lightweight wrapper around Google Identity Services
// borrowed from the official docs: https://developers.google.com/identity/sign-in/web/sign-in

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: () => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }

  interface ImportMeta {
    env: {
      VITE_GOOGLE_CLIENT_ID: string;
      [key: string]: any;
    };
  }
}

export interface GoogleUser {
  id: string; // same as `sub` claim
  email: string;
  name: string;
  picture?: string;
  token: string; // raw id_token
}

let current: GoogleUser | null = null;

export function initializeGoogleSignIn(onSuccess: (user: GoogleUser) => void) {
  if (typeof window === "undefined") return;
  if (!window.google || !window.google.accounts) {
    console.warn("Google Identity Services script not loaded yet");
    return;
  }

  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split(".")[1]));
        current = {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          picture: payload.picture,
          token: response.credential,
        };
        onSuccess(current);
      } catch (err) {
        console.error("failed to parse google token payload", err);
      }
    },
  });
}

export function promptGoogleSignIn() {
  if (window.google && window.google.accounts) {
    window.google.accounts.id.prompt();
  }
}

export function getGoogleToken(): string | null {
  return current?.token || null;
}

export function getCurrentGoogleUser(): GoogleUser | null {
  return current;
}
