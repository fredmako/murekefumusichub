import { useState } from 'react';
import { Navbar } from '@/app/components/Navbar';
import { Marketplace } from '@/app/components/Marketplace';
import { ComposerDashboard } from '@/app/components/ComposerDashboard';
import { BuyerDashboard } from '@/app/components/BuyerDashboard';
import { AdminPanel } from '@/app/components/AdminPanel';
import { Login } from '@/app/components/Login';
import { Toaster } from '@/app/components/ui/sonner';

export type UserRole = 'buyer' | 'composer' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Composition {
  id: string;
  title: string;
  composerId: string;
  composerName: string;
  price: number;
  description: string;
  voiceParts: string[];
  difficulty: 'Easy' | 'Intermediate' | 'Advanced';
  duration: string;
  language: string;
  accompaniment: string;
  dateAdded: string;
  pdfUrl?: string;
}

export interface Purchase {
  id: string;
  compositionId: string;
  buyerId: string;
  purchaseDate: string;
  price: number;
}

export interface CartItem {
  composition: Composition;
  quantity: number;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>({
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'buyer'
  });

  const [currentView, setCurrentView] = useState<'marketplace' | 'composer' | 'buyer' | 'admin'>('marketplace');
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleLogin = (email: string, password: string, role: UserRole) => {
    // Mock user data based on role
    const userData: Record<UserRole, User> = {
      buyer: {
        id: '1',
        name: 'John Doe',
        email: 'buyer@primemedia.com',
        role: 'buyer'
      },
      composer: {
        id: '2',
        name: 'Sarah Johnson',
        email: 'composer@primemedia.com',
        role: 'composer'
      },
      admin: {
        id: '5',
        name: 'Admin User',
        email: 'admin@primemedia.com',
        role: 'admin'
      }
    };

    setCurrentUser(userData[role]);
    setIsAuthenticated(true);

    // Set initial view based on role
    if (role === 'composer') {
      setCurrentView('composer');
    } else if (role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('marketplace');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser({
      id: '1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'buyer'
    });
    setCurrentView('marketplace');
    setCart([]);
  };

  const addToCart = (composition: Composition) => {
    setCart(prev => {
      const existing = prev.find(item => item.composition.id === composition.id);
      if (existing) {
        return prev.map(item =>
          item.composition.id === composition.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { composition, quantity: 1 }];
    });
  };

  const removeFromCart = (compositionId: string) => {
    setCart(prev => prev.filter(item => item.composition.id !== compositionId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleViewChange = (view: 'marketplace' | 'composer' | 'buyer' | 'admin') => {
    setCurrentView(view);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentUser(prev => ({ ...prev, role }));
    if (role === 'composer') {
      setCurrentView('composer');
    } else if (role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('marketplace');
    }
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      <Navbar
        currentUser={currentUser}
        currentView={currentView}
        onViewChange={handleViewChange}
        onRoleChange={handleRoleChange}
        onLogout={handleLogout}
        cart={cart}
        onRemoveFromCart={removeFromCart}
      />

      <main className="container mx-auto px-4 py-8">
        {currentView === 'marketplace' && (
          <Marketplace
            currentUser={currentUser}
            onAddToCart={addToCart}
          />
        )}

        {currentView === 'composer' && currentUser.role === 'composer' && (
          <ComposerDashboard currentUser={currentUser} />
        )}

        {currentView === 'buyer' && (
          <BuyerDashboard
            currentUser={currentUser}
            cart={cart}
            onClearCart={clearCart}
          />
        )}

        {currentView === 'admin' && currentUser.role === 'admin' && (
          <AdminPanel />
        )}
      </main>
    </div>
  );
}

export default App;