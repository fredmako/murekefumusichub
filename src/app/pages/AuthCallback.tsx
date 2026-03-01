import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const safeNavigate = (path: string) => {
      if (mounted) navigate(path, { replace: true });
    };

    const handleAuth = async () => {
      try {
        // Avoid immediate lock contention with AuthContext startup.
        await new Promise((resolve) => setTimeout(resolve, 250));
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("OAuth callback error:", error);
          safeNavigate("/login");
          return;
        }

        safeNavigate(data?.session ? "/" : "/login");
      } catch (err: any) {
        if (err?.name === "NavigatorLockAcquireTimeoutError") {
          // Let AuthContext resolve auth state via listener after lock contention.
          safeNavigate("/");
          return;
        }
        console.error("Callback handling failed:", err);
        safeNavigate("/login");
      }
    };

    const { data: authState } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          safeNavigate("/");
          return;
        }
        if (event === "SIGNED_OUT") {
          safeNavigate("/login");
          return;
        }
        if (event === "INITIAL_SESSION" && session) {
          safeNavigate("/");
        }
      },
    );

    handleAuth();

    return () => {
      mounted = false;
      authState.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}
