import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { Navbar } from "@/app/components/Navbar";
import { Marketplace } from "@/app/components/Marketplace";
import { ComposerDashboard } from "@/app/components/ComposerDashboard";
import { BuyerDashboard } from "@/app/components/BuyerDashboard";
import { AdminPanel } from "@/app/components/AdminPanel";
import { Login } from "@/app/components/Login";
import { Signup } from "@/app/components/Signup";
import { Toaster } from "@/app/components/ui/sonner";

export type UserRole = "buyer" | "composer" | "admin";

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
  difficulty: "Easy" | "Intermediate" | "Advanced";
  duration: string;
  language: string;
  accompaniment: string;
  dateAdded: string;
  pdfUrl?: string;
}

export interface CartItem {
  composition: Composition;
  quantity: number;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<
    "marketplace" | "composer" | "buyer" | "admin"
  >("marketplace");
  const [cart, setCart] = useState<CartItem[]>([]);

  // LOGIN
  const handleLogin = (email: string, role: UserRole) => {
    const users: Record<UserRole, User> = {
      buyer: { id: "1", name: "John Doe", email, role: "buyer" },
      composer: { id: "2", name: "Sarah Johnson", email, role: "composer" },
      admin: { id: "5", name: "Admin User", email, role: "admin" },
    };

    setCurrentUser(users[role]);
    setIsAuthenticated(true);

    if (role === "composer") setCurrentView("composer");
    else if (role === "admin") setCurrentView("admin");
    else setCurrentView("marketplace");
  };

  // SIGNUP → AUTO LOGIN
  const handleSignup = (email: string, role: UserRole) => {
    handleLogin(email, role);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCart([]);
    setCurrentView("marketplace");
  };

  const addToCart = (composition: Composition) => {
    setCart(prev => {
      const existing = prev.find(i => i.composition.id === composition.id);
      if (existing) {
        return prev.map(i =>
          i.composition.id === composition.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { composition, quantity: 1 }];
    });
  };

  const removeFromCart = (compositionId: string) => {
    setCart(prev => prev.filter(i => i.composition.id !== compositionId));
  };

  const clearCart = () => setCart([]);

  const handleViewChange = (
    view: "marketplace" | "composer" | "buyer" | "admin"
  ) => setCurrentView(view);

  const handleRoleChange = (role: UserRole) => {
    if (!currentUser) return;
    setCurrentUser({ ...currentUser, role });
    if (role === "composer") setCurrentView("composer");
    else if (role === "admin") setCurrentView("admin");
    else setCurrentView("marketplace");
  };

  return (
    <BrowserRouter>
      <Toaster />

      {!isAuthenticated ? (
        <Routes>
          <Route path="/" element={<Login onLogin={handleLogin} />} />
          <Route
            path="/signup"
            element={<Signup onSignup={handleSignup} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <div className="min-h-screen bg-gray-50">
          <Navbar
            currentUser={currentUser!}
            currentView={currentView}
            onViewChange={handleViewChange}
            onRoleChange={handleRoleChange}
            onLogout={handleLogout}
            cart={cart}
            onRemoveFromCart={removeFromCart}
          />

          <main className="container mx-auto px-4 py-8">
            {currentView === "marketplace" && currentUser && (
              <Marketplace
                currentUser={currentUser}
                onAddToCart={addToCart}
              />
            )}

            {currentView === "composer" &&
              currentUser?.role === "composer" && (
                <ComposerDashboard currentUser={currentUser} />
              )}

            {currentView === "buyer" && currentUser && (
              <BuyerDashboard
                currentUser={currentUser}
                cart={cart}
                onClearCart={clearCart}
              />
            )}

            {currentView === "admin" &&
              currentUser?.role === "admin" && <AdminPanel />}
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;