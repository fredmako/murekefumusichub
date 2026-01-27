// src/app/App.tsx
import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { CartItem } from "./types";
import { AuthProvider } from "../context/AuthContext";

// Lazy-load heavy pages (ensure default exports exist)
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

// Error Boundary (class-based)
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

// Wrapper to pass uid query and cart to dashboards
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

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleRemoveFromCart = (compositionId: string) => {
    setCart(prev => prev.filter(item => item.composition.id !== compositionId));
  };

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

                {/* Dashboards with uid query */}
                <Route
                  path="/buyer"
                  element={<DashboardWrapper Component={BuyerDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />}
                />
                <Route
                  path="/composer"
                  element={<DashboardWrapper Component={ComposerDashboard} cart={cart} onRemoveFromCart={handleRemoveFromCart} />}
                />
<Route path="/about" element={<AboutPage />} />
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