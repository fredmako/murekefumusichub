// src/app/App.tsx
import React, { Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { CartItem } from "./types";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Lazy-load heavy pages (components must default export)
const LandingPage = React.lazy(() => import("./components/LandingPage"));
const Login = React.lazy(() => import("./components/Login"));
const Marketplace = React.lazy(() => import("./components/Marketplace"));
const BuyerDashboard = React.lazy(() => import("./components/BuyerDashboard"));
const ComposerDashboard = React.lazy(() => import("./components/ComposerDashboard"));
const AdminDashboard = React.lazy(() => import("./components/AdminPanel"));

// Error Boundary
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-red-600">
          <h2 className="font-bold text-xl mb-2">Something went wrong:</h2>
          <pre className="whitespace-pre-wrap">{this.state.error?.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Dashboard wrapper to pass uid + cart
const DashboardWrapper = ({
  Component,
  cart,
  onRemoveFromCart,
}: {
  Component: React.FC<any>;
  cart: CartItem[];
  onRemoveFromCart: (id: string) => void;
}) => {
  const searchParams = new URLSearchParams(window.location.search);
  const uid = searchParams.get("uid") || undefined;

  return <Component uid={uid} cart={cart} onRemoveFromCart={onRemoveFromCart} />;
};

// Redirect logged-in users to their dashboard
const ProtectedRoute = ({
  children,
  role,
}: {
  children: React.ReactNode;
  role: "buyer" | "composer" | "admin";
}) => {
  const { appUser } = useAuth();
  if (!appUser) return <Navigate to="/login" replace />;
  if (!appUser.roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { appUser } = useAuth();
  const location = useLocation();

  const handleRemoveFromCart = (compositionId: string) => {
    setCart((prev) => prev.filter((item) => item.composition.id !== compositionId));
  };

  // Automatically redirect logged-in users away from landing/login
  useEffect(() => {
    if (!appUser) return;
    const role = appUser.roles.includes("admin")
      ? "admin"
      : appUser.roles.includes("composer")
      ? "composer"
      : "buyer";

    if (location.pathname === "/" || location.pathname === "/login") {
      window.history.replaceState({}, "", `/${role}?uid=${appUser.uid}`);
    }
  }, [appUser, location.pathname]);

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar cart={cart} onRemoveFromCart={handleRemoveFromCart} />

          <main className="mt-4">
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/marketplace" element={<Marketplace />} />

                {/* Dashboards */}
                <Route
                  path="/buyer"
                  element={
                    <ProtectedRoute role="buyer">
                      <DashboardWrapper Component={BuyerDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/composer"
                  element={
                    <ProtectedRoute role="composer">
                      <DashboardWrapper Component={ComposerDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute role="admin">
                      <DashboardWrapper Component={AdminDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />
                    </ProtectedRoute>
                  }
                />

                {/* Redirect /home to landing page */}
                <Route path="/home" element={<Navigate to="/" replace />} />

                {/* 404 Fallback */}
                <Route
                  path="*"
                  element={
                    <div className="p-8 text-center text-gray-600">
                      404 — Page not found
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </main>
        </div>
      </AuthProvider>
    </AppErrorBoundary>
  );
}