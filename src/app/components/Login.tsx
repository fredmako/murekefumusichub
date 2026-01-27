// src/app/components/Login.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, LogIn } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { UserRole } from '@/app/App';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { toast } from 'sonner';
import { authService } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

interface LoginProps {
  onLogin?: (email: string, password: string, role: UserRole) => void;
}

export function Login({ onLogin }: LoginProps) {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Auto redirect if already logged in
  useEffect(() => {
    if (appUser) {
      const uidParam = `?uid=${appUser.uid}`;
      if (appUser.roles.includes('buyer')) navigate(`/buyer${uidParam}`, { replace: true });
      else if (appUser.roles.includes('composer')) navigate(`/composer${uidParam}`, { replace: true });
      else if (appUser.roles.includes('admin')) navigate(`/admin${uidParam}`, { replace: true });
    }
  }, [appUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return toast.error('Please enter email and password');
    if (password.length < 6) return toast.error('Password must be at least 6 characters');

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

      onLogin?.(email, password, selectedRole);
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast.error(error.message || 'Authentication failed');
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
      await authService.syncUser(firebaseUser, selectedRole);
      onLogin?.(firebaseUser.email || '', '', selectedRole);
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
      {/* Login Card */}
      <Card className="shadow-xl w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">{isSignUp ? 'Create Account' : 'Sign In'}</CardTitle>
          <CardDescription>{isSignUp ? 'Create a new account' : 'Enter your credentials to access your account'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Label htmlFor="role">{isSignUp ? 'Select Your Role' : 'Login As'}</Label>
            <Select value={selectedRole} onValueChange={v => setSelectedRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="composer">Composer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading} />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading} minLength={6} />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              <LogIn className="size-5 mr-2" /> {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </Button>
          </form>

          <Button type="button" className="w-full mt-4 flex items-center justify-center gap-2" variant="outline" onClick={handleGoogleSignIn} disabled={isLoading}>
            <FcGoogle className="size-5" /> Sign in with Google
          </Button>

          <div className="mt-4 text-center">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-blue-600 hover:underline" disabled={isLoading}>
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}