import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { resolvePostLoginRedirect } from "@/lib/authRedirect";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let mounted = true;
    let resolvedTargetPath: string | null | undefined;

    const safeNavigate = (path: string) => {
      if (mounted) navigate(path, { replace: true });
    };

    const resolveTarget = () => {
      if (resolvedTargetPath !== undefined) return resolvedTargetPath;
      resolvedTargetPath = resolvePostLoginRedirect({
        queryNext: searchParams.get("next"),
        consume: true,
      });
      return resolvedTargetPath;
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

        const target = resolveTarget();
        safeNavigate(data?.session ? target || "/" : "/login");
      } catch (err: any) {
        if (err?.name === "NavigatorLockAcquireTimeoutError") {
          // Let AuthContext resolve auth state via listener after lock contention.
          const target = resolveTarget();
          safeNavigate(target || "/");
          return;
        }
        console.error("Callback handling failed:", err);
        safeNavigate("/login");
      }
    };

    const { data: authState } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        const target = resolveTarget();
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          safeNavigate(target || "/");
          return;
        }
        if (event === "SIGNED_OUT") {
          safeNavigate("/login");
          return;
        }
        if (event === "INITIAL_SESSION" && session) {
          safeNavigate(target || "/");
        }
      },
    );

    handleAuth();

    return () => {
      mounted = false;
      authState.subscription.unsubscribe();
    };
  }, [navigate, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}
