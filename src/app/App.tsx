// src/app/App.tsx
import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { CartItem } from "./types";
import { AuthProvider, useAuth } from "../context/AuthContext";

// Lazy-load heavy pages
const LandingPage = React.lazy(() =>
  import("./components/LandingPage").then(module => ({ default: module.LandingPage || module.default }))
);
const Login = React.lazy(() =>
  import("./components/Login").then(module => ({ default: module.Login || module.default }))
);
const Marketplace = React.lazy(() =>
  import("./components/Marketplace").then(module => ({ default: module.Marketplace || module.default }))
);
const BuyerDashboard = React.lazy(() =>
  import("./components/BuyerDashboard").then(module => ({ default: module.BuyerDashboard || module.default }))
);
const ComposerDashboard = React.lazy(() =>
  import("./components/ComposerDashboard").then(module => ({ default: module.ComposerDashboard || module.default }))
);
const AdminDashboard = React.lazy(() =>
  import("./components/AdminPanel").then(module => ({ default: module.AdminDashboard || module.default }))
);

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

// Dashboard wrapper to pass uid and cart
const DashboardWrapper = ({
  Component,
  cart,
  onRemoveFromCart
}: {
  Component: React.FC<any>;
  cart: CartItem[];
  onRemoveFromCart: (id: string) => void;
}) => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") || undefined;

  return <Component uid={uid} cart={cart} onRemoveFromCart={onRemoveFromCart} />;
};

// Component to handle private routes
const PrivateRoute = ({
  component: Component,
  cart,
  onRemoveFromCart
}: {
  component: React.FC<any>;
  cart: CartItem[];
  onRemoveFromCart: (id: string) => void;
}) => {
  const { appUser } = useAuth();

  if (!appUser) {
    // Not logged in → redirect to login
    return <Navigate to="/login" replace />;
  }

  // Determine dashboard path based on role
  const uidParam = `?uid=${appUser.uid}`;
  if (appUser.roles.includes("buyer")) return <Navigate to={`/buyer${uidParam}`} replace />;
  if (appUser.roles.includes("composer")) return <Navigate to={`/composer${uidParam}`} replace />;
  if (appUser.roles.includes("admin")) return <Navigate to={`/admin${uidParam}`} replace />;

  return <Navigate to="/login" replace />;
};

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleRemoveFromCart = (compositionId: string) => {
    setCart(prev => prev.filter(item => item.composition.id !== compositionId));
  };

  const { appUser } = useAuth();

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar cart={cart} onRemoveFromCart={handleRemoveFromCart} />

          <main className="mt-4">
            <Suspense fallback={<div className="p-8">Loading...</div>}>
              <Routes>
                {/* Redirect logged-in users from landing page */}
                <Route path="/" element={appUser ? <PrivateRoute component={LandingPage} cart={cart} onRemoveFromCart={handleRemoveFromCart} /> : <LandingPage />} />
                <Route path="/login" element={appUser ? <PrivateRoute component={Login} cart={cart} onRemoveFromCart={handleRemoveFromCart} /> : <Login />} />

                <Route path="/marketplace" element={<Marketplace />} />

                {/* Dashboards */}
                <Route
                  path="/buyer"
                  element={<DashboardWrapper Component={BuyerDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />}
                />
                <Route
                  path="/composer"
                  element={<DashboardWrapper Component={ComposerDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />}
                />
                <Route
                  path="/admin"
                  element={<DashboardWrapper Component={AdminDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />}
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