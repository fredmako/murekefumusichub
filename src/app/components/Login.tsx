import { useState } from 'react';
import { Music, LogIn, UserPlus } from 'lucide-react';
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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { toast } from 'sonner';

interface LoginProps {
  onLogin: (email: string, role: UserRole) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('buyer');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Logged in successfully');
      onLogin(email, selectedRole);
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (role: UserRole) => {
    const demoEmails = {
      buyer: 'buyer@primemedia.com',
      composer: 'composer@primemedia.com',
      admin: 'admin@primemedia.com',
    };

    setIsLoading(true);
    setTimeout(() => {
      onLogin(demoEmails[role], role);
      setIsLoading(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

        {/* Branding */}
        <div className="space-y-6 text-center lg:text-left">
          <div className="flex items-center gap-4 justify-center lg:justify-start">
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

          <p className="text-gray-600 text-lg max-w-xl">
            Discover, purchase, and distribute high-quality choral music worldwide.
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription>Access your Prime Media account</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">

              {/* Role */}
              <div>
                <Label>Login As</Label>
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
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                <LogIn className="mr-2 size-5" />
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            {/* Quick Access */}
            <div className="mt-6 space-y-3">
              <p className="text-sm text-gray-500 text-center">Demo Access</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" onClick={() => quickLogin('buyer')}>Buyer</Button>
                <Button variant="outline" size="sm" onClick={() => quickLogin('composer')}>Composer</Button>
                <Button variant="outline" size="sm" onClick={() => quickLogin('admin')}>Admin</Button>
              </div>
            </div>

            {/* Signup CTA */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-500">
                Don’t have an account?
              </p>
              <Button
                variant="link"
                className="font-medium"
                onClick={() => window.location.href = '/signup'}
              >
                <UserPlus className="mr-1 size-4" />
                Create an account
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}