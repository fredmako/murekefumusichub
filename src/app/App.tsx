// src/app/App.tsx
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import bg1 from "@/app/components/images/bg_1.jpg";
import bg2 from "@/app/components/images/bg_2.jpg";
import bg3 from "@/app/components/images/bg_3.jpg";
import bg4 from "@/app/components/images/bg_4.jpg";
import bg5 from "@/app/components/images/bg_5.jpg";
import bg6 from "@/app/components/images/bg_6.jpg";
import bg7 from "@/app/components/images/bg_7.jpg";
import bg9 from "@/app/components/images/bg_9.jpg";
import bg10 from "@/app/components/images/bg_10.jpg";
import bg11 from "@/app/components/images/bg_11.jpg";
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

type RouteBackdropConfig = {
  light: string;
  dark: string;
  overlayLight: string;
  overlayDark: string;
};

const DEFAULT_ROUTE_BACKDROP: RouteBackdropConfig = {
  light: bg11,
  dark: bg9,
  overlayLight:
    "linear-gradient(140deg, rgba(247,252,255,0.62), rgba(242,249,255,0.5), rgba(236,245,251,0.58))",
  overlayDark:
    "linear-gradient(140deg, rgba(5,11,24,0.62), rgba(16,10,32,0.5), rgba(8,24,48,0.58))",
};

function resolveRouteBackdrop(pathname: string): RouteBackdropConfig {
  const path = String(pathname || "/").toLowerCase();

  if (path === "/" || path.startsWith("/home")) {
    return {
      light: bg1,
      dark: bg9,
      overlayLight:
        "linear-gradient(140deg, rgba(248,253,255,0.58), rgba(244,250,254,0.46), rgba(240,248,253,0.56))",
      overlayDark:
        "linear-gradient(140deg, rgba(4,10,22,0.58), rgba(16,9,31,0.46), rgba(7,23,45,0.56))",
    };
  }

  if (path.startsWith("/marketplace")) {
    return {
      light: bg3,
      dark: bg5,
      overlayLight:
        "linear-gradient(140deg, rgba(250,253,255,0.52), rgba(247,251,255,0.42), rgba(243,249,255,0.52))",
      overlayDark:
        "linear-gradient(140deg, rgba(4,10,22,0.56), rgba(14,10,30,0.44), rgba(7,22,42,0.54))",
    };
  }

  if (path.startsWith("/buyer") || path.startsWith("/checkout")) {
    return {
      light: bg4,
      dark: bg6,
      overlayLight:
        "linear-gradient(140deg, rgba(248,253,255,0.56), rgba(246,251,255,0.46), rgba(240,247,255,0.56))",
      overlayDark:
        "linear-gradient(140deg, rgba(5,11,24,0.58), rgba(16,10,34,0.46), rgba(8,24,46,0.56))",
    };
  }

  if (path.startsWith("/manage-account")) {
    return {
      light: bg6,
      dark: bg10,
      overlayLight:
        "linear-gradient(140deg, rgba(248,253,255,0.44), rgba(245,250,255,0.34), rgba(239,247,253,0.44))",
      overlayDark:
        "linear-gradient(140deg, rgba(5,11,24,0.46), rgba(17,10,33,0.36), rgba(8,24,47,0.44))",
    };
  }

  if (path.startsWith("/composer") || path.startsWith("/upload")) {
    return {
      light: bg7,
      dark: bg10,
      overlayLight:
        "linear-gradient(140deg, rgba(248,252,255,0.54), rgba(244,250,255,0.44), rgba(240,247,252,0.54))",
      overlayDark:
        "linear-gradient(140deg, rgba(5,11,25,0.58), rgba(18,10,34,0.46), rgba(8,24,47,0.56))",
    };
  }

  if (path.startsWith("/admin")) {
    return {
      light: bg10,
      dark: bg9,
      overlayLight:
        "linear-gradient(140deg, rgba(247,252,255,0.58), rgba(243,249,255,0.48), rgba(239,247,253,0.58))",
      overlayDark:
        "linear-gradient(140deg, rgba(4,10,22,0.6), rgba(17,10,34,0.48), rgba(8,24,47,0.58))",
    };
  }

  if (
    path.startsWith("/about") ||
    path.startsWith("/contact") ||
    path.startsWith("/privacy-policy")
  ) {
    return {
      light: bg2,
      dark: bg5,
      overlayLight:
        "linear-gradient(140deg, rgba(248,253,255,0.56), rgba(245,250,255,0.46), rgba(240,247,252,0.56))",
      overlayDark:
        "linear-gradient(140deg, rgba(4,10,22,0.58), rgba(17,10,33,0.46), rgba(8,24,46,0.56))",
    };
  }

  if (path.startsWith("/enroll")) {
    return {
      light: bg6,
      dark: bg10,
      overlayLight:
        "linear-gradient(140deg, rgba(248,253,255,0.56), rgba(244,250,255,0.46), rgba(239,247,253,0.56))",
      overlayDark:
        "linear-gradient(140deg, rgba(5,11,24,0.58), rgba(17,10,33,0.46), rgba(8,24,47,0.56))",
    };
  }

  if (
    path.startsWith("/login") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/auth/callback")
  ) {
    return {
      light: bg11,
      dark: bg9,
      overlayLight:
        "linear-gradient(140deg, rgba(247,252,255,0.62), rgba(244,250,255,0.5), rgba(239,247,253,0.6))",
      overlayDark:
        "linear-gradient(140deg, rgba(5,11,24,0.62), rgba(17,10,34,0.5), rgba(8,24,48,0.6))",
    };
  }

  return DEFAULT_ROUTE_BACKDROP;
}

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
  const routeBackdrop = useMemo(
    () => resolveRouteBackdrop(location.pathname),
    [location.pathname],
  );
  const routeBackdropImage = isDarkMode
    ? routeBackdrop.dark
    : routeBackdrop.light;
  const routeBackdropOverlay = isDarkMode
    ? routeBackdrop.overlayDark
    : routeBackdrop.overlayLight;
  const routeBackdropVars = useMemo(
    () =>
      ({
        "--route-backdrop-image": `url(${routeBackdropImage})`,
        "--route-backdrop-overlay": routeBackdropOverlay,
        "--route-backdrop-scrim": isDarkMode
          ? "linear-gradient(180deg, rgba(5,10,19,0.18), rgba(7,13,24,0.5), rgba(6,12,22,0.72))"
          : "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(248,251,255,0.2), rgba(244,248,252,0.36))",
        "--route-panel-overlay": isDarkMode
          ? "linear-gradient(135deg, rgba(8,14,28,0.5), rgba(16,16,42,0.58), rgba(9,28,56,0.48))"
          : "linear-gradient(135deg, rgba(255,255,255,0.44), rgba(248,251,255,0.56), rgba(238,246,252,0.34))",
        "--route-panel-overlay-strong": isDarkMode
          ? "linear-gradient(135deg, rgba(7,12,26,0.78), rgba(22,13,52,0.76), rgba(9,66,82,0.72))"
          : "linear-gradient(135deg, rgba(7,56,64,0.76), rgba(9,84,96,0.72), rgba(5,150,105,0.64))",
      }) as React.CSSProperties,
    [isDarkMode, routeBackdropImage, routeBackdropOverlay],
  );

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
        style={routeBackdropVars}
      >
        <div
          className="pointer-events-none fixed inset-0 -z-20 bg-background"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "var(--route-backdrop-image)",
            opacity: isDarkMode ? 0.4 : 0.28,
            filter: isDarkMode
              ? "saturate(1.14) contrast(1.08) brightness(0.88)"
              : "saturate(1.12) contrast(1.04) brightness(1.04)",
            transform: "scale(1.025)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          style={{
            backgroundImage:
              "var(--route-backdrop-scrim), var(--route-backdrop-overlay)",
          }}
          aria-hidden="true"
        />
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
                  backgroundImage:
                    "var(--route-backdrop-scrim), var(--route-backdrop-overlay), var(--route-backdrop-image)",
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
