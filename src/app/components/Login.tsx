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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import { toast } from "sonner";
import { authService } from "@/services/api";
import logo from "../components/images/logo.jpg";
type UserRole = "buyer" | "composer" | "admin";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("buyer");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  // Redirect based on role and uid
  const redirectToDashboard = (role: UserRole, uid: string) => {
    if (role === "buyer") navigate(`/buyer?uid=${uid}`);
    else if (role === "composer") navigate(`/composer?uid=${uid}`);
    else if (role === "admin") navigate(`/admin?uid=${uid}`);
    else navigate("/");
  };

  // Auto-redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const role = await authService.getUserRole(user.uid); // fetch user role from Firestore
          redirectToDashboard(role, user.uid);
        } catch (error) {
          console.error("Failed to fetch user role:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password)
      return toast.error("Please enter email and password");
    if (password.length < 6)
      return toast.error("Password must be at least 6 characters");

    setIsLoading(true);
    try {
      let firebaseUser;

      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        firebaseUser = result.user;
        await authService.syncUser(firebaseUser, selectedRole);
        toast.success("Account created successfully!");
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = result.user;
        const roleFromDB = await authService.getUserRole(firebaseUser.uid);
        toast.success("Logged in successfully!");
        // Use the role from DB if not signing up
        setSelectedRole(roleFromDB as UserRole);
      }

      // Redirect to dashboard
      redirectToDashboard(selectedRole, firebaseUser.uid);
    } catch (error: any) {
      console.error("Authentication error:", error);
      switch (error.code) {
        case "auth/user-not-found":
          toast.error("No account found with this email. Please sign up.");
          setIsSignUp(true);
          break;
        case "auth/wrong-password":
          toast.error("Incorrect password. Please try again.");
          break;
        case "auth/email-already-in-use":
          toast.error(
            "This email is already registered. Please sign in instead.",
          );
          setIsSignUp(false);
          break;
        case "auth/weak-password":
          toast.error(
            "Password is too weak. Please use at least 6 characters.",
          );
          break;
        case "auth/invalid-email":
          toast.error("Invalid email address format.");
          break;
        default:
          toast.error(
            error.message || "Authentication failed. Please try again.",
          );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Default role could be buyer or fetched from Firestore
      const role =
        (await authService.getUserRole(firebaseUser.uid)) || selectedRole;
      await authService.syncUser(firebaseUser, role);

      toast.success("Logged in with Google successfully!");
      redirectToDashboard(role as UserRole, firebaseUser.uid);
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast.error(error.message || "Google sign-in failed");
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
                  : "Enter your credentials to access your account"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="role">
                    {isSignUp ? "Select Your Role" : "Login As"}
                  </Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) =>
                      setSelectedRole(value as UserRole)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="composer">Composer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={
                      isSignUp ? "At least 6 characters" : "Enter your password"
                    }
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

          <p className="text-center text-sm text-gray-500">
            {isSignUp ? (
              <>
                By creating an account, you agree to our{" "}
                <a
                  href="#"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Terms of Service
                </a>
              </>
            ) : (
              <>
                Need help?{" "}
                <a
                  href="#"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Contact Support
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
