// src/app/App.tsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";

// lazy-load heavy pages optionally
const LandingPage = React.lazy(() => import("./components/LandingPage"));
const Login = React.lazy(() => import("./components/Login")); // adjust path if different
const Marketplace = React.lazy(() => import("./components/Marketplace"));

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Suspense fallback={<div className="p-8">Loading...</div>}>
          <Routes>
            {/* Landing page: exact root path */}
          
            {/* Learning page moved to /learning */}
            <Route path="/" element={<LandingPage />} />

            {/* Other standard routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/marketplace" element={<Marketplace />} />

            {/* Legacy redirects: if any old route used learning as index, redirect */}
            <Route path="/home" element={<Navigate to="/" replace />} />

            {/* 404 catch-all */}
            <Route path="*" element={<div className="p-8">404 — Page not found</div>} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}