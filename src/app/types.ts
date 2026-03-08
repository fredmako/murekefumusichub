// src/app/types.ts

import { ReactNode } from "node_modules/react-resizable-panels/dist/declarations/src/vendor/react";

export type UserRole = "buyer" | "composer" | "admin";

export interface Composition {
  voiceParts?: any;
  difficulty?: ReactNode;
  id: string;
  title: string;
  composerName: string;
  price: number;
  priceCurrency?: string | null;
  category?: string;
  description?: string;
  duration?: string;
  language?: string;
  accompaniment?: string | string[];
  pdfUrl?: string;
  createdAt?: string;
  stats?: {
    views: number;
    purchases: number;
  };
}

export interface CartItem {
  composition: Composition;
  quantity: number;
}

export interface AppUser {
  id: string; // Supabase user ID
  authUid: string; // Supabase auth UID
  email: string | null;
  displayName: string | null;
  roles: UserRole[]; // ["buyer"], ["composer"], ["admin"]
}
