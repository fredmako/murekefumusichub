// src/app/App.tsx
import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { CartItem } from "./types";
import { AuthProvider } from "../context/AuthContext";

// Lazy-load heavy pages (ensure default exports exist in these components)
const LandingPage = React.lazy(() =>
  import("./components/LandingPage").then(module => ({ default: module.LandingPage || module.default }))
);
const Login = React.lazy(() =>
  import("./components/Login").then(module => ({ default: module.Login || module.default }))
);
const Marketplace = React.lazy(() =>
  import("./components/Marketplace").then(module => ({ default: module.Marketplace || module.default }))
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
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
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