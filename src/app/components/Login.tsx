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
import { supabase as db} from "../../lib/supabase";
import { toast } from "sonner";
import { authService } from "@/services/api";
import logo from "../components/images/logo.jpg";

type UserRole = "buyer" | "composer" | "admin";

/* 🔥 HARD CODED SUPER ADMIN */
const SUPER_ADMIN_EMAIL = "fredrickmakori102@gmail.com";

const normalizeEmail = (email: string) => email.toLowerCase().trim();

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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;
      const normalizedEmail = normalizeEmail(firebaseUser.email || "");

      let roleName: UserRole = "buyer";

      if (normalizedEmail === SUPER_ADMIN_EMAIL) {
        roleName = "admin";
      } else {
        const { data: invite, error } = await db
          .from("composerInvites")
          .select("*")
          .eq("email", normalizedEmail)
          .single();

        if (!error && invite && !invite.used) {
          roleName = "composer";
          await db.from("composerInvites").update({ used: true }).eq("email", normalizedEmail);
        }
      }

      // Step 1: Upsert user record
      const { data: userData, error: userError } = await db.from("users").upsert({
        firebase_uid: firebaseUser.uid,
        email: normalizedEmail,
        display_name: firebaseUser.displayName,
        avatar_url: firebaseUser.photoURL,
        is_active: true,
        created_at: new Date().toISOString(),
      }).select().single();

      if (userError) {
        console.error("Error syncing user:", userError);
      }

      // Step 2: Get role ID from roles table
      const { data: roleData, error: roleLookupError } = await db
        .from("roles")
        .select("id")
        .eq("name", roleName)
        .single();

      if (roleLookupError) {
        console.error("Error fetching role:", roleLookupError);
      }

      // Step 3: Link user to role in user_roles
      if (userData && roleData) {
        const { error: userRoleError } = await db.from("user_roles").upsert({
          user_id: userData.id,
          role_id: roleData.id,
          assigned_at: new Date().toISOString(),
        });

        if (userRoleError) {
          console.error("Error assigning role:", userRoleError);
        }
      }

      toast.success("Google sign-in successful!");
      redirectToDashboard(roleName);
    } catch (error: any) {
      console.error(error);
      toast.error("Google sign-in failed");
    } finally {
      setIsLoading(false);
    }

    /* 🔥 GOOGLE LOGIN */
    const handleGoogleSignIn = async () => {
      setIsLoading(true);

      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);

        const firebaseUser = result.user;
        const normalizedEmail = normalizeEmail(firebaseUser.email || "");

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
}
