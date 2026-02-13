import { useState, useEffect } from "react";
import { Music, LogIn } from "lucide-react";
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
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { authService } from "@/services/api";
import logo from "../components/images/logo.jpg";

type UserRole = "buyer" | "composer" | "admin";

/* 🔥 HARD CODED SUPER ADMIN */
const SUPER_ADMIN_EMAIL = "fredrickmakori102@gmail.com";

const normalizeEmail = (email: string) =>
  email.toLowerCase().trim();

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  /* 🔥 CLEAN REDIRECT (NO UID IN URL) */
  const redirectToDashboard = (role: UserRole) => {
    switch (role) {
      case "admin":
        navigate("/admin", { replace: true });
        break;
      case "composer":
        navigate("/composer", { replace: true });
        break;
      case "buyer":
        navigate("/buyer", { replace: true });
        break;
      default:
        navigate("/", { replace: true });
    }
  };

  /* 🔥 AUTO REDIRECT IF LOGGED IN */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const normalizedEmail = normalizeEmail(user.email || "");

      if (normalizedEmail === SUPER_ADMIN_EMAIL) {
        redirectToDashboard("admin");
        return;
      }

      const role = await authService.getUserRole(user.uid);
      if (role) redirectToDashboard(role as UserRole);
    });

    return () => unsubscribe();
  }, []);

  /* 🔥 EMAIL/PASSWORD LOGIN + SIGNUP */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password)
      return toast.error("Please enter email and password");

    if (password.length < 6)
      return toast.error("Password must be at least 6 characters");

    setIsLoading(true);

    try {
      if (isSignUp) {
        /* 🔥 SIGN UP LOGIC */
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const firebaseUser = result.user;
        const normalizedEmail = normalizeEmail(
          firebaseUser.email || ""
        );

        let role: UserRole = "buyer";

        // 🔐 Hardcoded admin
        if (normalizedEmail === SUPER_ADMIN_EMAIL) {
          role = "admin";
        } else {
          // 🔎 Check composer invite
          const inviteRef = doc(db, "composerInvites", normalizedEmail);
          const inviteSnap = await getDoc(inviteRef);

          if (inviteSnap.exists() && !inviteSnap.data().used) {
            role = "composer";
            await updateDoc(inviteRef, { used: true });
          }
        }

        await authService.syncUser(firebaseUser, role);

        toast.success("Account created successfully!");
        redirectToDashboard(role);

      } else {
        /* 🔥 LOGIN LOGIC */
        const result = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );

        const firebaseUser = result.user;
        const normalizedEmail = normalizeEmail(
          firebaseUser.email || ""
        );

        let role: UserRole;

        // 🔐 Hardcoded admin override
        if (normalizedEmail === SUPER_ADMIN_EMAIL) {
          role = "admin";
          await authService.syncUser(firebaseUser, "admin");
        } else {
          const roleFromDB = await authService.getUserRole(
            firebaseUser.uid
          );

          if (!roleFromDB) {
            throw new Error("User role not found");
          }

          role = roleFromDB as UserRole;
        }

        toast.success("Logged in successfully!");
        redirectToDashboard(role);
      }
    } catch (error: any) {
      console.error("Authentication error:", error);

      switch (error.code) {
        case "auth/user-not-found":
          toast.error("No account found. Please sign up.");
          break;
        case "auth/wrong-password":
          toast.error("Incorrect password.");
          break;
        case "auth/email-already-in-use":
          toast.error("Email already registered.");
          break;
        case "auth/weak-password":
          toast.error("Password too weak.");
          break;
        default:
          toast.error("Authentication failed.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* 🔥 GOOGLE LOGIN */
  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;
      const normalizedEmail = normalizeEmail(
        firebaseUser.email || ""
      );

      let role: UserRole = "buyer";

      if (normalizedEmail === SUPER_ADMIN_EMAIL) {
        role = "admin";
      } else {
        const inviteRef = doc(db, "composerInvites", normalizedEmail);
        const inviteSnap = await getDoc(inviteRef);

        if (inviteSnap.exists() && !inviteSnap.data().used) {
          role = "composer";
          await updateDoc(inviteRef, { used: true });
        }
      }

      await authService.syncUser(firebaseUser, role);

      toast.success("Google sign-in successful!");
      redirectToDashboard(role);
    } catch (error: any) {
      toast.error("Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Branding */}
        <div className="flex items-center justify-center h-full">
          <img
            src={logo}
            alt="Murekefu Logo"
            className="w-56 h-56 md:w-72 md:h-72 object-contain"
          />
        </div>

        {/* Login Form */}
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
                {isSignUp && (
                  <div>
                    <Label>Account Type</Label>
                    <Input value="Buyer Account" disabled />
                    <p className="text-xs text-gray-500 mt-1">
                      Composer accounts are granted by admin invitation.
                    </p>
                  </div>
                )}

                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
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
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}