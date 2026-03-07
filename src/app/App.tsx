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
import { THEME_MODES, THEME_PRESETS, ThemeMode, ThemePreset, useTheme } from "@/context/ThemeContext";
import { toast } from "sonner";
import { SESSION_EXPIRED_EVENT } from "@/lib/sessionEvents";
import { APP_ERROR_EVENT, type AppErrorAction, type AppErrorDetail, dispatchAppError } from "@/lib/appErrorEvents";
import { AppErrorDialog } from "@/app/components/AppErrorDialog";
import { Guitar, Loader2 } from "lucide-react";
import loadingStringsDark from "@/app/components/images/bg_9.jpg";
import loadingStringsLight from "@/app/components/images/bg_11.jpg";
import {
  buildLoginPath,
  getCurrentPathWithQuery,
  persistPostLoginRedirect,
} from "@/lib/authRedirect";

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
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-2xl border border-border/70 bg-card/90 p-6 text-center shadow-[0_24px_40px_-30px_rgba(15,23,42,0.6)]">
            <h1 className="mb-2 text-2xl font-bold text-destructive">
              Something went wrong
            </h1>
            <p className="mb-4 text-muted-foreground">
              Please refresh the page or try again later.
            </p>
            <pre className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-left text-xs text-foreground/90">
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
  const { mode, setMode, setTheme } = useTheme();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [appError, setAppError] = useState<AppErrorDetail | null>(null);
  const [appErrorOpen, setAppErrorOpen] = useState(false);
  const lastSessionExpiredToastAt = useRef(0);
  const handlingSessionExpiredRef = useRef(false);
  const isDarkMode = mode === "dark";
  const loadingBackdropImage = isDarkMode
    ? loadingStringsDark
    : loadingStringsLight;
  const loadingBackdropOverlay = isDarkMode
    ? "linear-gradient(145deg, rgba(6,12,28,0.9), rgba(26,14,46,0.78), rgba(9,35,66,0.8))"
    : "linear-gradient(145deg, rgba(245,251,252,0.9), rgba(236,246,240,0.84), rgba(244,238,252,0.82))";
  const [appBackdropReady, setAppBackdropReady] = useState(false);

  useEffect(() => {
    if (!isDarkMode) {
      setAppBackdropReady(false);
      return;
    }

    let cancelled = false;
    const image = new Image();
    const markReady = () => {
      if (!cancelled) setAppBackdropReady(true);
    };

    image.onload = markReady;
    image.onerror = markReady;
    image.src = loadingStringsDark;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [isDarkMode]);

  useEffect(() => {
    const preset = appUser?.theme_settings?.preset;
    if (preset && THEME_PRESETS.includes(preset as ThemePreset)) {
      setTheme(preset as ThemePreset);
    }

    const mode = appUser?.theme_settings?.mode;
    if (mode && THEME_MODES.includes(mode as ThemeMode)) {
      setMode(mode as ThemeMode);
    }
  }, [appUser?.theme_settings?.mode, appUser?.theme_settings?.preset, setMode, setTheme]);

  const handleAppErrorAction = (action: AppErrorAction, detail: AppErrorDetail | null) => {
    if (!detail) return;
    if (action === "refresh") {
      window.location.reload();
      return;
    }
    if (action === "exit") {
      if (detail.exitTo) {
        navigate(detail.exitTo, { replace: true });
      } else {
        navigate("/", { replace: true });
      }
      return;
    }
    setAppErrorOpen(false);
  };

  useEffect(() => {
    const onAppError = (event: Event) => {
      const detail = (event as CustomEvent<AppErrorDetail>).detail;
      if (!detail) return;

      const status = Number(detail.status || 0);
      if (!detail.actions || detail.actions.length === 0) {
        if (status === 401) {
          detail.actions = ["ok", "exit", "refresh"];
        } else if (status === 408 || status === 503) {
          detail.actions = ["refresh", "ok"];
        } else if (status >= 500) {
          detail.actions = ["refresh", "exit", "ok"];
        } else {
          detail.actions = ["ok"];
        }
      }

      setAppError(detail);
      setAppErrorOpen(true);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!event?.reason) return;
      const message =
        event.reason?.message ||
        String(event.reason) ||
        "An unexpected error occurred.";
      dispatchAppError({ message });
    };

    const onWindowError = (event: ErrorEvent) => {
      if (!event?.error && !event?.message) return;
      dispatchAppError({ message: event.error?.message || event.message });
    };

    window.addEventListener(APP_ERROR_EVENT, onAppError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onWindowError);
    return () => {
      window.removeEventListener(APP_ERROR_EVENT, onAppError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError);
    };
  }, [navigate]);
  useEffect(() => {
    const onSessionExpired = async () => {
      if (!appUser) return;
      if (handlingSessionExpiredRef.current) return;
      handlingSessionExpiredRef.current = true;

      try {
        const currentPath = getCurrentPathWithQuery();
        const isAuthPage =
          currentPath.startsWith("/login") ||
          currentPath.startsWith("/auth/callback") ||
          currentPath.startsWith("/reset-password");
        const now = Date.now();

        if (now - lastSessionExpiredToastAt.current < 3500) return;
        lastSessionExpiredToastAt.current = now;

        if (!isAuthPage) persistPostLoginRedirect(currentPath);

        await signOut(false);

        dispatchAppError({
          title: "Session expired",
          message: "Your session has expired. Please log in again.",
          status: 401,
          exitTo: isAuthPage
            ? buildLoginPath({ reason: "session-expired" })
            : buildLoginPath({
                nextPath: currentPath,
                reason: "session-expired",
              }),
          actions: ["ok", "refresh", "exit"],
        });
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
      persistPostLoginRedirect("/buyer");
      toast.info("Please sign in to purchase compositions.");
      navigate(buildLoginPath({ nextPath: "/buyer", intent: "purchase" }));
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
      <div
        className={`relative min-h-screen text-foreground ${
          isDarkMode ? "bg-black" : "bg-background"
        }`}
      >
        {isDarkMode && (
          <>
            <div className="pointer-events-none fixed inset-0 -z-20 bg-black" aria-hidden="true" />
            <div
              className={`pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${
                appBackdropReady ? "opacity-100" : "opacity-0"
              }`}
              style={{
                backgroundImage: `linear-gradient(145deg, rgba(4,8,18,0.9), rgba(24,12,43,0.76), rgba(8,28,52,0.82)), url(${loadingStringsDark})`,
              }}
              aria-hidden="true"
            />
          </>
        )}
        <Navbar cart={cart} onRemoveFromCart={handleRemoveFromCart} />
        <AppErrorDialog
          open={appErrorOpen}
          detail={appError}
          onOpenChange={setAppErrorOpen}
          onAction={handleAppErrorAction}
        />

        <Suspense
          fallback={
            <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
              <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `${loadingBackdropOverlay}, url(${loadingBackdropImage})`,
                }}
                aria-hidden="true"
              />
              <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/85 p-7 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.9)] backdrop-blur-md sm:p-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <Guitar className="size-4 text-primary" />
                    String Session
                  </div>
                  <h2 className="mt-5 text-2xl font-semibold text-foreground sm:text-3xl">
                    Loading your workspace
                  </h2>
                  <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
                    Preparing dashboards, instruments, and your latest activity.
                  </p>
                  <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-border/70 bg-background/70 px-4 py-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      Loading page...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          }
        >
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
                <Route path="/auth/callback/*" element={<AuthCallback />} />

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
                    <div className="p-12 text-center text-muted-foreground">
                      <h1 className="mb-2 text-2xl font-bold text-foreground">
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
