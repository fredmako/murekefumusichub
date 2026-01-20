import { useState } from 'react';
import { Music, LogIn } from 'lucide-react';
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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';

interface LoginProps {
  onLogin: (email: string, password: string, role: UserRole) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Try to sign in with Firebase
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully!');
      onLogin(email, password, selectedRole);
    } catch (error: any) {
      // If sign in fails, try to create a new account
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          toast.success('Account created and logged in successfully!');
          onLogin(email, password, selectedRole);
        } catch (createError: any) {
          toast.error(createError.message || 'Failed to create account');
          setIsLoading(false);
        }
      } else {
        toast.error(error.message || 'Login failed');
        setIsLoading(false);
      }
    }
  };

  const quickLogin = (role: UserRole) => {
    setIsLoading(true);
    setTimeout(() => {
      const demoEmails = {
        buyer: 'buyer@primemedia.com',
        composer: 'composer@primemedia.com',
        admin: 'admin@primemedia.com'
      };
      onLogin(demoEmails[role], 'demo123', role);
      setIsLoading(false);
    }, 500);
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
              <CardTitle className="text-2xl">Sign In</CardTitle>
              <CardDescription>Enter your credentials to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Role Selection */}
                <div>
                  <Label htmlFor="role">Login As</Label>
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
                  />
                </div>

                {/* Password */}
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Login Button */}
                <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                  <LogIn className="size-5 mr-2" />
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Demo Quick Access</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => quickLogin('buyer')}
                    disabled={isLoading}
                  >
                    Buyer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => quickLogin('composer')}
                    disabled={isLoading}
                  >
                    Composer
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => quickLogin('admin')}
                    disabled={isLoading}
                  >
                    Admin
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="#" className="text-blue-600 hover:underline font-medium">
              Sign up now
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}