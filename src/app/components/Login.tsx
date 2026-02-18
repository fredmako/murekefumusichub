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
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { supabase as db } from "../../lib/supabase";
import { toast } from "sonner";
import logo from "../components/images/logo.jpg";

type UserRole = "buyer" | "composer" | "admin";

const SUPER_ADMIN_EMAIL = "fredrickmakori102@gmail.com";
const normalizeEmail = (email: string) => email.toLowerCase().trim();

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

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

      const normalizedEmail = normalizeEmail(user.email || "");

      let role: UserRole = "buyer";

      if (normalizedEmail === SUPER_ADMIN_EMAIL) {
        role = "admin";
      }

      redirectToDashboard(role);
    });

    return () => unsubscribe();
  }, []);

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
      let userCredential;

      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        toast.success("Account created successfully!");
      } else {
        userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
        toast.success("Login successful!");
      }

      const firebaseUser = userCredential.user;
      const normalizedEmail = normalizeEmail(firebaseUser.email || "");

      const role =
        normalizedEmail === SUPER_ADMIN_EMAIL ? "admin" : "buyer";

      await syncUserToDatabase(firebaseUser.uid, normalizedEmail, role);

      redirectToDashboard(role);
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
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const firebaseUser = result.user;
      const normalizedEmail = normalizeEmail(firebaseUser.email || "");

      const role =
        normalizedEmail === SUPER_ADMIN_EMAIL ? "admin" : "buyer";

      await syncUserToDatabase(firebaseUser.uid, normalizedEmail, role);

      toast.success("Google sign-in successful!");
      redirectToDashboard(role);
    } catch (error: any) {
      console.error(error);
      toast.error("Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  /* ============================= */
  /* SYNC USER TO SUPABASE */
  /* ============================= */
  const syncUserToDatabase = async (
    uid: string,
    email: string,
    role: UserRole
  ) => {
    // Upsert user. If client RLS prevents creating users directly, fall back
    // to the server-side sync endpoint which can use a service role key.
    const { data: userData, error: userError } = await db
      .from("users")
      .upsert({
        firebase_uid: uid,
        email,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (userError) {
      console.warn("User sync error (client):", userError?.message || userError);

      // If this is an RLS or permission issue, call server-side sync endpoint
      if (userError?.code === '42501' || userError?.message?.includes('row-level security')) {
        try {
          const token = await auth.currentUser?.getIdToken();
          const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7071/api';
          const res = await fetch(`${base}/sync-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ firebaseUid: uid, email, role }),
          });

          if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            console.error('Server sync failed:', res.status, errBody);
            return;
          }

          const serverData = await res.json().catch(() => null);
          if (serverData?.id) {
            // Optionally, update or continue with serverData
            return;
          }
        } catch (sev) {
          console.error('Server-side sync error:', sev);
        }

        return;
      }

      return;
    }

    // Get role ID
    const { data: roleData } = await db
      .from("roles")
      .select("id")
      .eq("name", role)
      .single();

    if (roleData && userData) {
      await db.from("user_roles").upsert({
        user_id: userData.id,
        role_id: roleData.id,
      });
    }
  };

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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}