// src/app/App.tsx
import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { CartItem } from "./types";
import { AuthProvider } from "../context/AuthContext";

/* -----------------------------
   Lazy-loaded Pages
-------------------------------- */
const LandingPage = React.lazy(() =>
  import("./components/LandingPage").then(m => ({
    default: m.LandingPage ?? m.default,
  }))
);
const MusicEnrollmentPage = React.lazy(() =>
  import("./components/MusicEnrollmentPage").then(m => ({
    default: m.MusicEnrollmentPage ?? m.default,
  }))
);
const Login = React.lazy(() =>
  import("./components/Login").then(m => ({
    default: m.Login ?? m.default,
  }))
);

const Marketplace = React.lazy(() =>
  import("./components/Marketplace").then(m => ({
    default: m.Marketplace ?? m.default,
  }))
);

const AboutPage = React.lazy(() =>
  import("./components/AboutPage").then(m => ({
    default: m.AboutPage ?? m.default,
  }))
);

const BuyerDashboard = React.lazy(() =>
  import("./components/BuyerDashboard").then(m => ({
    default: m.BuyerDashboard ?? m.default,
  }))
);

const ComposerDashboard = React.lazy(() =>
  import("./components/ComposerDashboard").then(m => ({
    default: m.ComposerDashboard ?? m.default,
  }))
);

const AdminDashboard = React.lazy(() =>
  import("./components/AdminPanel").then(m => ({
    default: m.AdminDashboard ?? m.default,
  }))
);

/* -----------------------------
   Error Boundary
-------------------------------- */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              Please refresh the page or try again later.
            </p>
            <pre className="text-xs text-left bg-red-50 p-4 rounded">
              {this.state.error?.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* -----------------------------
   Dashboard Wrapper
-------------------------------- */
const DashboardWrapper = ({
  Component,
  cart,
  onRemoveFromCart,
}: {
  Component: React.FC<any>;
  cart: CartItem[];
  onRemoveFromCart: (id: string) => void;
}) => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid") ?? undefined;

  return <Component uid={uid} cart={cart} onRemoveFromCart={onRemoveFromCart} />;
};

/* -----------------------------
   App Root
-------------------------------- */
export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleRemoveFromCart = (compositionId: string) => {
    setCart(prev =>
      prev.filter(item => item.composition.id !== compositionId)
    );
  };

  return (
    <AppErrorBoundary>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar cart={cart} onRemoveFromCart={handleRemoveFromCart} />

          <Suspense fallback={<div className="p-8">Loading...</div>}>
            <Routes>

              {/* Public Pages */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/about" element={<AboutPage />} />

              {/* Dashboards */}
              <Route
                path="/buyer"
                element={
                  <DashboardWrapper
                    Component={BuyerDashboard}
                    cart={cart}
                    onRemoveFromCart={handleRemoveFromCart}
                  />
                }
              />

              <Route
                path="/composer"
                element={
                  <DashboardWrapper
                    Component={ComposerDashboard}
                    cart={cart}
                    onRemoveFromCart={handleRemoveFromCart}
                  />

                }
              />
<Route path="/enroll" element={<MusicEnrollmentPage />} />
              <Route
                path="/admin"
                element={
                  <DashboardWrapper
                    Component={AdminDashboard}
                    cart={cart}
                    onRemoveFromCart={handleRemoveFromCart}
                  />
                }
              />

              {/* Redirects */}
              <Route path="/home" element={<Navigate to="/" replace />} />

              {/* 404 */}
              <Route
                path="*"
                element={
                  <div className="p-12 text-center text-gray-600">
                    <h1 className="text-2xl font-bold mb-2">
                      404 — Page Not Found
                    </h1>
                    <p>The page you’re looking for doesn’t exist.</p>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </AppErrorBoundary>
  );
}