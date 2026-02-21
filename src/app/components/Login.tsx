import { useState, useEffect } from "react";
import { LogIn } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { auth } from "../../lib/firebase";
import { navbarService } from "@/services/navbarService";
import { toast } from "sonner";
import logo from "./images/logo.jpg";

type UserRole = "buyer" | "composer" | "admin";

const normalizeEmail = (email: string) => email.toLowerCase().trim();

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();
  const {
    appUser,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    refreshRoles,
  } = useAuth();

  /* ============================= */
  /* REDIRECT BASED ON ROLE */
  /* ============================= */
  const redirectToDashboard = (role: UserRole) => {
    switch (role) {
      case "admin":
        navigate("/admin", { replace: true });
        break;
      case "composer":
        navigate("/composer", { replace: true });
        break;
      default:
        navigate("/buyer", { replace: true });
    }
  };

  /* ============================= */
  /* AUTO REDIRECT IF LOGGED IN */
  /* ============================= */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        // Ask server for current roles for this firebase UID
        const roles = await navbarService.fetchUserRoles(user.uid);

        let role: UserRole = "buyer";
        if (roles.includes("admin")) role = "admin";
        else if (roles.includes("composer")) role = "composer";

        redirectToDashboard(role);
      } catch (err) {
        console.error(
          "[Login] Failed to fetch roles on auth state change:",
          err,
        );
        // Fallback to server-provided appUser roles if available, otherwise default to buyer
        const effectiveRole = appUser?.roles?.includes("admin")
          ? "admin"
          : appUser?.roles?.includes("composer")
            ? "composer"
            : "buyer";
        redirectToDashboard(effectiveRole as UserRole);
      }
    });

    return () => unsubscribe();
  }, [appUser]);

  /* ============================= */
  /* EMAIL / PASSWORD LOGIN */
  /* ============================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, "user");
        toast.success("Account created successfully!");
      } else {
        await signInWithEmail(email, password, "user");
        toast.success("Login successful!");
      }

      // Ensure roles are fresh, then redirect based on them
      await refreshRoles();
      const roles = appUser?.roles || [];
      const effectiveRole: UserRole = roles.includes("admin")
        ? "admin"
        : roles.includes("composer")
          ? "composer"
          : roles.includes("buyer")
            ? "buyer"
            : "buyer";

      redirectToDashboard(effectiveRole);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================= */
  /* GOOGLE LOGIN */
  /* ============================= */
  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      await signInWithGoogle("user");
      toast.success("Google sign-in successful!");

      await refreshRoles();
      const roles = appUser?.roles || [];
      const effectiveRole: UserRole = roles.includes("admin")
        ? "admin"
        : roles.includes("composer")
          ? "composer"
          : roles.includes("buyer")
            ? "buyer"
            : "buyer";

      redirectToDashboard(effectiveRole);
    } catch (error: any) {
      // If the browser blocked the popup, signInWithGoogle already tries redirect
      console.error(error);
      toast.error(error.message || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================= */
  /* SYNC USER TO SUPABASE */
  /* ============================= */
  // sync is handled centrally in AuthContext via authService

  /* ============================= */
  /* COMPONENT UI */
  /* ============================= */
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="flex items-center justify-center h-full">
          <img
            src={logo}
            alt="Murekefu Logo"
            className="w-56 h-56 md:w-72 md:h-72 object-contain"
          />
        </div>

        <div className="space-y-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                {isSignUp ? "Create Account" : "Sign In"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Create a new account to get started"
                  : "Enter your credentials"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  <LogIn className="size-5 mr-2" />
                  {isLoading
                    ? "Processing..."
                    : isSignUp
                      ? "Create Account"
                      : "Sign In"}
                </Button>
              </form>

              <div className="mt-4">
                <Button
                  type="button"
                  className="w-full flex items-center justify-center gap-2"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <FcGoogle className="size-5" />
                  Sign in with Google
                </Button>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-blue-600 hover:underline"
                  disabled={isLoading}
                >
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "Don't have an account? Sign up"}
                </button>
              </div>

              {/* Quick admin dashboard link when user has admin role */}
              {appUser?.roles?.includes("admin") && (
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/admin")}
                    className="text-sm text-red-600 hover:underline"
                    disabled={isLoading}
                  >
                    Go to Admin Dashboard
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
