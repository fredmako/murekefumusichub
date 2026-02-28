import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // This lets Supabase process the hash fragment
        const { error } = await supabase.auth.getSession();

        if (error) {
          console.error("OAuth callback error:", error);
          navigate("/login", { replace: true });
          return;
        }

        // Redirect to app home (or dashboard)
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Callback handling failed:", err);
        navigate("/login", { replace: true });
      }
    };

    handleAuth();
  }, [navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Signing you in…</p>
    </div>
  );
}
