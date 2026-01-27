import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { initializeApp } from "firebase/app";
import { AppUser } from "@/app/types";

/* =======================
   Firebase Initialization
      ======================= */

      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
            };

            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const provider = new GoogleAuthProvider();

            /* =======================
               Context Types
                  ======================= */

                  interface AuthContextType {
                    firebaseUser: any | null;
                      appUser: AppUser | null;
                        loading: boolean;
                          signInWithGoogle: () => Promise<void>;
                            signOut: () => Promise<void>;
                            }

                            /* =======================
                               Context
                                  ======================= */

                                  const AuthContext = createContext<AuthContextType | undefined>(undefined);

                                  export function useAuth() {
                                    const ctx = useContext(AuthContext);
                                      if (!ctx) {
                                          throw new Error("useAuth must be used inside AuthProvider");
                                            }
                                              return ctx;
                                              }

                                              /* =======================
                                                 Provider
                                                    ======================= */

                                                    export function AuthProvider({ children }: { children: React.ReactNode }) {
                                                      const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
                                                        const [appUser, setAppUser] = useState<AppUser | null>(null);
                                                          const [loading, setLoading] = useState(true);

                                                            // 🔐 Sign in
                                                              async function signInWithGoogle() {
                                                                  await signInWithPopup(auth, provider);
                                                                    }

                                                                      // 🔓 Sign out
                                                                        async function handleSignOut() {
                                                                            await signOut(auth);
                                                                                setAppUser(null);
                                                                                  }

                                                                                    // 🔁 Listen for auth changes
                                                                                      useEffect(() => {
                                                                                          const unsubscribe = onAuthStateChanged(auth, async (user) => {
                                                                                                setFirebaseUser(user);

                                                                                                      if (user) {
                                                                                                              // 🔗 Normally this comes from Supabase via backend sync
                                                                                                                      // Temporary default role = buyer
                                                                                                                              const syncedUser: AppUser = {
                                                                                                                                        id: user.uid, // replace with Supabase UUID later
                                                                                                                                                  firebaseUid: user.uid,
                                                                                                                                                            email: user.email,
                                                                                                                                                                      displayName: user.displayName,
                                                                                                                                                                                roles: ["buyer"], // backend will override this
                                                                                                                                                                                        };
                                                                                                                                                                                                setAppUser(syncedUser);
                                                                                                                                                                                                      } else {
                                                                                                                                                                                                              setAppUser(null);
                                                                                                                                                                                                                    }

                                                                                                                                                                                                                          setLoading(false);
                                                                                                                                                                                                                              });

                                                                                                                                                                                                                                  return () => unsubscribe();
                                                                                                                                                                                                                                    }, []);

                                                                                                                                                                                                                                      return (
                                                                                                                                                                                                                                          <AuthContext.Provider
                                                                                                                                                                                                                                                value={{
                                                                                                                                                                                                                                                        firebaseUser,
                                                                                                                                                                                                                                                                appUser,
                                                                                                                                                                                                                                                                        loading,
                                                                                                                                                                                                                                                                                signInWithGoogle,
                                                                                                                                                                                                                                                                                        signOut: handleSignOut,
                                                                                                                                                                                                                                                                                              }}
                                                                                                                                                                                                                                                                                                  >
                                                                                                                                                                                                                                                                                                        {children}
                                                                                                                                                                                                                                                                                                            </AuthContext.Provider>
                                                                                                                                                                                                                                                                                                              );
                                                                                                                                                                                                                                                                                                              }