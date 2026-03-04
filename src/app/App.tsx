// src/app/App.tsx
import React, { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { CartItem, Composition } from "./types";
import { ManageAccount } from "./components/ManageAccount";
import AuthCallback from "@/app/pages/AuthCallback";
import { ContactUs } from "./components/ContactUs";
import { useAuth } from "@/context/AuthContext";
import { THEME_PRESETS, ThemePreset, useTheme } from "@/context/ThemeContext";
import { toast } from "sonner";
import { SESSION_EXPIRED_EVENT } from "@/lib/sessionEvents";

/* -----------------------------
   Lazy-loaded Pages
-------------------------------- */
const LandingPage = React.lazy(() =>
  import("./components/LandingPage").then((m) => ({
    default: (m as any).LandingPage ?? (m as any).default,
  })),
);
const MusicEnrollmentPage = React.lazy(() =>
  import("./components/MusicEnrollmentPage").then((m) => ({
    default: (m as any).MusicEnrollmentPage ?? (m as any).default,
  })),
);
const Login = React.lazy(() =>
  import("./components/Login").then((m) => ({
    default: (m as any).Login ?? (m as any).default,
  })),
);

const Marketplace = React.lazy(() =>
  import("./components/Marketplace").then((m) => ({
    default: (m as any).Marketplace ?? (m as any).default,
  })),
);

const AboutPage = React.lazy(() =>
  import("./components/AboutPage").then((m) => ({
    default: (m as any).AboutPage ?? (m as any).default,
  })),
);

const BuyerDashboard = React.lazy(() =>
  import("./components/BuyerDashboard").then((m) => ({
    default: (m as any).BuyerDashboard ?? (m as any).default,
  })),
);

const CheckoutPage = React.lazy(() =>
  import("./components/CheckoutPage").then((m) => ({
    default: (m as any).CheckoutPage ?? (m as any).default,
  })),
);

const ComposerDashboard = React.lazy(() =>
  import("./components/ComposerDashboard").then((m) => ({
    default: (m as any).ComposerDashboard ?? (m as any).default,
  })),
);

const AdminDashboard = React.lazy(() =>
  import("./components/AdminPanel").then((m) => ({
    default: (m as any).AdminPanel ?? (m as any).default,
  })),
);

const SetNewPassword = React.lazy(() =>
  import("./components/SetNewPassword").then((m) => ({
    default: (m as any).SetNewPassword ?? (m as any).default,
  })),
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
  onClearCart,
  onRemoveFromCart,
}: {
  Component: React.FC<any>;
  cart: CartItem[];
  onClearCart: () => void;
  onRemoveFromCart: (id: string) => void;
}) => {
  return (
    <Component
      cart={cart}
      onClearCart={onClearCart}
      onRemoveFromCart={onRemoveFromCart}
    />
  );
};

/* -----------------------------
   App Root
-------------------------------- */
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const { appUser, signOut } = useAuth();
  const { setTheme } = useTheme();
  const [cart, setCart] = useState<CartItem[]>([]);
  const lastSessionExpiredToastAt = useRef(0);
  const handlingSessionExpiredRef = useRef(false);

  useEffect(() => {
    const preset = appUser?.theme_settings?.preset;
    if (!preset || !THEME_PRESETS.includes(preset as ThemePreset)) return;
    setTheme(preset as ThemePreset);
  }, [appUser?.theme_settings?.preset, setTheme]);

  useEffect(() => {
    const onSessionExpired = async () => {
      if (!appUser) return;
      if (handlingSessionExpiredRef.current) return;
      handlingSessionExpiredRef.current = true;

      try {
        const currentPath = `${window.location.pathname}${window.location.search}`;
        const isAuthPage =
          currentPath.startsWith("/login") ||
          currentPath.startsWith("/auth/callback") ||
          currentPath.startsWith("/reset-password");
        const now = Date.now();

        if (now - lastSessionExpiredToastAt.current < 3500) return;
        lastSessionExpiredToastAt.current = now;

        if (!isAuthPage) {
          try {
            sessionStorage.setItem("post_login_redirect", currentPath);
          } catch {
            // ignore storage failures
          }
        }

        await signOut(false);
        toast.error("Your session has expired. Please log in again.");

        if (!isAuthPage) {
          const next = encodeURIComponent(currentPath || "/");
          navigate(`/login?next=${next}&reason=session-expired`, {
            replace: true,
          });
        }
      } finally {
        handlingSessionExpiredRef.current = false;
      }
    };

    const listener = () => {
      void onSessionExpired();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    };
  }, [appUser, navigate, signOut]);

  const handleAddToCart = (composition: Composition) => {
    if (!appUser) {
      try {
        sessionStorage.setItem("post_login_redirect", "/buyer");
      } catch {
        // ignore storage errors
      }
      toast.info("Please sign in to purchase compositions.");
      navigate("/login?next=%2Fbuyer&intent=purchase");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.composition.id === composition.id);
      if (existing) {
        toast.info("This composition is already in your cart.");
        return prev;
      }
      return [...prev, { composition, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (compositionId: string) => {
    setCart((prev) =>
      prev.filter((item) => item.composition.id !== compositionId),
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Navbar cart={cart} onRemoveFromCart={handleRemoveFromCart} />

        <Suspense fallback={<div className="p-8">Loading...</div>}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${location.pathname}${location.search}`}
              className="route-vortex-window"
              initial={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: 56, scale: 0.996 }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, x: 0, scale: 1 }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 0, x: -42, scale: 0.996 }
              }
              transition={{
                duration: prefersReducedMotion ? 0 : 0.38,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Routes location={location}>
                {/* Public Pages */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/reset-password" element={<SetNewPassword />} />
                <Route
                  path="/marketplace"
                  element={<Marketplace onAddToCart={handleAddToCart} />}
                />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/manage-account" element={<ManageAccount />} />
                <Route path="/auth/callback" element={<AuthCallback />} />

                {/* Dashboards */}
                <Route
                  path="/buyer"
                  element={
                    <DashboardWrapper
                      Component={BuyerDashboard}
                      cart={cart}
                      onClearCart={handleClearCart}
                      onRemoveFromCart={handleRemoveFromCart}
                    />
                  }
                />
                <Route
                  path="/checkout"
                  element={
                    <DashboardWrapper
                      Component={CheckoutPage}
                      cart={cart}
                      onClearCart={handleClearCart}
                      onRemoveFromCart={handleRemoveFromCart}
                    />
                  }
                />
                <Route path="/contact" element={<ContactUs />} />
                <Route
                  path="/composer"
                  element={
                    <DashboardWrapper
                      Component={ComposerDashboard}
                      cart={cart}
                      onClearCart={handleClearCart}
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
                      onClearCart={handleClearCart}
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
                        404 - Page Not Found
                      </h1>
                      <p>The page you are looking for does not exist.</p>
                    </div>
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </Suspense>
      </div>
    </AppErrorBoundary>
  );
}
