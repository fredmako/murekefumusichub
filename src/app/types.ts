// src/app/types.ts

export type UserRole = "buyer" | "composer" | "admin";

export interface Composition {
  id: string;
    title: string;
      composerName: string;
        price: number;
          category?: string;
          }

          export interface CartItem {
            composition: Composition;
              quantity: number;
              }

              export interface AppUser {
                id: string;              // Supabase user ID
                  firebaseUid: string;     // Firebase UID
                    email: string | null;
                      displayName: string | null;
                        roles: UserRole[];       // ["buyer"], ["composer"], ["admin"]
                        }