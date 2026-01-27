// src/app/App.tsx
import React, { Suspense, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/Navbar"; // named import
import { CartItem } from "./types"; // adjust path if necessary

// Lazy-load heavy pages
const LandingPage = React.lazy(() => import("./components/LandingPage"));
const Login = React.lazy(() => import("./components/Login"));
const Marketplace = React.lazy(() => import("./components/Marketplace"));

// Error boundary component
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="p-8 text-red-600">
        <h2 className="font-bold text-xl mb-2">Something went wrong:</h2>
        <pre className="whitespace-pre-wrap">{error.message}</pre>
      </div>
    );
  }

  return (
    <React.ErrorBoundary
      fallbackRender={({ error }) => {
        setError(error);
        return null;
      }}
    >
      {children}
    </React.ErrorBoundary>
  );
}

export default function App() {
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleRemoveFromCart = (compositionId: string) => {
    setCart(prev => prev.filter(item => item.composition.id !== compositionId));
  };

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}