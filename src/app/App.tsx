// src/app/App.tsx
import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/Navbar"; // make sure Navbar.tsx has named export
import { CartItem } from "./types"; // adjust path if necessary

// Lazy-load heavy pages
const LandingPage = React.lazy(() => import("./components/LandingPage"));
const Login = React.lazy(() => import("./components/Login"));
const Marketplace = React.lazy(() => import("./components/Marketplace"));

// Class-based ErrorBoundary
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
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleRemoveFromCart = (compositionId: string) => {
    setCart(prev => prev.filter(item => item.composition.id !== compositionId));
  };

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Navbar cart={cart} onRemoveFromCart={handleRemoveFromCart} />

        <main className="mt-4">
          <Suspense fallback={<div className="p-8">Loading...</div>}>
            <Routes>
              {/* Landing page */}
              <Route path="/" element={<LandingPage />} />

              {/* Auth routes */}
              <Route path="/login" element={<Login />} />

              {/* Marketplace */}
              <Route path="/marketplace" element={<Marketplace />} />

              {/* Legacy redirect */}
              <Route path="/home" element={<Navigate to="/" replace />} />

              {/* Catch-all 404 */}
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
    </AppErrorBoundary>
  );
}