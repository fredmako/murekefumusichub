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
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toast } from "sonner";
import logo from "./images/system-logo-cutout.png";

type UserRole = "buyer" | "composer" | "admin";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupNotice, setSignupNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    appUser,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    refreshRoles,
    resetPassword,
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
  const resolveNextPath = (): string | null => {
    const fromQuery = searchParams.get("next");
    const fromStorage = (() => {
      try {
        return sessionStorage.getItem("post_login_redirect");
      } catch {
        return null;
      }
    })();

    const candidate = fromQuery || fromStorage;
    if (!candidate) return null;
    if (!candidate.startsWith("/") || candidate.startsWith("//")) return null;
    return candidate;
  };

  useEffect(() => {
    if (!appUser) return; // Not logged in

    try {
      const nextPath = resolveNextPath();
      if (nextPath) {
        try {
          sessionStorage.removeItem("post_login_redirect");
        } catch {
          // ignore storage failures
        }
        navigate(nextPath, { replace: true });
        return;
      }

      let role: UserRole = "buyer";
      if (appUser.roles?.includes("admin")) role = "admin";
      else if (appUser.roles?.includes("composer")) role = "composer";

      redirectToDashboard(role);
    } catch (err) {
      console.error("[Login] Failed to redirect on auth state change:", err);
    }
  }, [appUser, navigate, searchParams]);

  /* ============================= */
  /* EMAIL / PASSWORD LOGIN */
  /* ============================= */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || (!password && !isForgot)) {
      toast.error("Please enter email" + (isForgot ? "" : " and password"));
      return;
    }

    if (isSignUp && !isForgot) {
      if (!confirmPassword) {
        toast.error("Please confirm your password");
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isForgot) {
        await resetPassword(email);
        toast.success("Password reset email sent. Check your inbox.");
        setSignupNotice("");
      } else if (isSignUp) {
        await signUpWithEmail(email, password);
        const confirmationMessage =
          "Account created. Please check your email and confirm your account before logging in.";
        setSignupNotice(confirmationMessage);
        setIsSignUp(false);
        setIsForgot(false);
        setPassword("");
        setConfirmPassword("");
        toast.success(confirmationMessage);
      } else {
        await signInWithEmail(email, password);
        toast.success("Login successful!");
        setSignupNotice("");
      }

      if (!isForgot && !isSignUp) {
        // Sync roles - the useEffect will handle redirect automatically when appUser updates
        await refreshRoles();
      }
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
      await signInWithGoogle();
      toast.success("Google sign-in successful!");
      // The useEffect will handle redirect automatically when appUser updates
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
        <div className="flex h-full items-center justify-center">
          <div className="rounded-3xl border border-[#0a2e43]/25 bg-gradient-to-br from-[#0b2940] to-[#081e32] p-3 shadow-[0_18px_36px_-20px_rgba(2,24,39,0.95)] sm:p-4">
            <img
              src={logo}
              alt="Murekefu Logo"
              className="h-64 w-64 object-contain saturate-125 md:h-80 md:w-80 [filter:drop-shadow(0_0_2px_rgba(255,255,255,0.35))]"
            />
          </div>
        </div>

        <div className="space-y-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                {isForgot
                  ? "Reset Password"
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
              </CardTitle>
              <CardDescription>
                {isForgot
                  ? "Enter your email to receive reset instructions"
                  : isSignUp
                    ? "Create a new account to get started"
                    : "Enter your credentials"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {signupNotice && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  {signupNotice}
                </div>
              )}

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

                {!isForgot && (
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
                )}

                {isSignUp && !isForgot && (
                  <div>
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={isLoading}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  <LogIn className="size-5 mr-2" />
                  {isLoading
                    ? "Processing..."
                    : isForgot
                      ? "Send Reset Email"
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

              <div className="mt-4 flex justify-between items-center">
                {!isForgot && !isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(true);
                      setConfirmPassword("");
                    }}
                    className="text-sm text-blue-600 hover:underline"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (isForgot) {
                      setIsForgot(false);
                    } else {
                      setIsSignUp(!isSignUp);
                      setConfirmPassword("");
                    }
                  }}
                  className="text-sm text-blue-600 hover:underline ml-auto"
                  disabled={isLoading}
                >
                  {isForgot
                    ? "Back to login"
                    : isSignUp
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
