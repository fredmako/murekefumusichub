import { useState } from 'react';
import { Music, LogIn, Google } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { UserRole } from '@/app/App';
import { auth } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { toast } from 'sonner';
import { authService } from '@/services/api';

interface LoginProps {
  onLogin: (email: string, password: string, role: UserRole) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      let firebaseUser;

      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        firebaseUser = result.user;

        await authService.syncUser(firebaseUser, selectedRole);
        toast.success('Account created successfully!');
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = result.user;

        await authService.syncUser(firebaseUser, selectedRole);
        toast.success('Logged in successfully!');
      }

      onLogin(email, password, selectedRole);
    } catch (error: any) {
      console.error('Authentication error:', error);

      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email. Please sign up.');
        setIsSignUp(true);
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please sign in instead.');
        setIsSignUp(false);
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Please use at least 6 characters.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address format.');
      } else {
        toast.error(error.message || 'Authentication failed. Please try again.');
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

      // Default role could be buyer or ask user to select
      await authService.syncUser(firebaseUser, selectedRole);

      onLogin(firebaseUser.email || '', '', selectedRole);
      toast.success('Logged in with Google successfully!');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast.error(error.message || 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Branding Section */}
        <div className="text-center lg:text-left space-y-6">
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-4 rounded-2xl">
              <Music className="size-12 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Prime Media
              </h1>
              <p className="text-gray-600 text-lg">Choral Music Marketplace</p>
            </div>
          </div>

          <div className="space-y-4 mt-8">
            <h2 className="text-3xl font-semibold text-gray-800">
              Welcome to the World's Leading Choral Platform
            </h2>
            <p className="text-gray-600 text-lg">
              Connect composers with choirs worldwide. Buy, sell, and discover exceptional choral compositions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-semibold text-blue-600 mb-2">For Buyers</h3>
                <p className="text-sm text-gray-600">Browse and purchase high-quality choral music</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-semibold text-purple-600 mb-2">For Composers</h3>
                <p className="text-sm text-gray-600">Sell your compositions to a global audience</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="font-semibold text-green-600 mb-2">For Admins</h3>
                <p className="text-sm text-gray-600">Manage and grow your music platform</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login Section */}
        <div className="space-y-6">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </CardTitle>
              <CardDescription>
                {isSignUp 
                  ? 'Create a new account to get started' 
                  : 'Enter your credentials to access your account'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role Selection */}
                <div>
                  <Label htmlFor="role">
                    {isSignUp ? 'Select Your Role' : 'Login As'}
                  </Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => setSelectedRole(value as UserRole)}
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

                {/* Email */}
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

                {/* Password */}
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={isSignUp ? "At least 6 characters" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={6}
                  />
                </div>

                {/* Submit Button */}
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  <LogIn className="size-5 mr-2" />
                  {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </Button>
              </form>

              {/* Google Sign-In */}
              <div className="mt-4">
                <Button
                  type="button"
                  className="w-full flex items-center justify-center gap-2"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <Google className="size-5" />
                  Sign in with Google
                </Button>
              </div>

              {/* Toggle Sign Up / Sign In */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-blue-600 hover:underline"
                  disabled={isLoading}
                >
                  {isSignUp 
                    ? 'Already have an account? Sign in' 
                    : "Don't have an account? Sign up"}
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-gray-500">
            {isSignUp ? (
              <>
                By creating an account, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">
                  Terms of Service
                </a>
              </>
            ) : (
              <>
                Need help?{' '}
                <a href="#" className="text-blue-600 hover:underline font-medium">
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