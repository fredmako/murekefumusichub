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
import { Button } from "@/app/components/ui/button";
import { buildErrorReportMessage, shouldOfferReport, simplifyErrorMessage } from "@/lib/errorMessages";
import { supportService } from "@/services/supportService";
import { supabase } from "@/lib/supabase";
import { Guitar, Loader2 } from "lucide-react";
import {
  buildLoginPath,
  getCurrentPathWithQuery,
  persistPostLoginRedirect,
} from "@/lib/authRedirect";

const CART_STORAGE_PREFIX = "choral-cart";

const getCartStorageKey = (userId?: string | null) =>
  `${CART_STORAGE_PREFIX}:${userId || "guest"}`;

const readStoredCart = (key: string): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) => item && item.composition && item.composition.id,
    ) as CartItem[];
  } catch (error) {
    console.warn("[cart] failed to read stored cart:", error);
    return [];
  }
};

const writeStoredCart = (key: string, value: CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("[cart] failed to persist cart:", error);
  }
};

const mergeCartItems = (primary: CartItem[], secondary: CartItem[]) => {
  const merged = new Map<string, CartItem>();
  primary.forEach((item) => {
    if (!item?.composition?.id) return;
    merged.set(item.composition.id, { ...item });
  });
  secondary.forEach((item) => {
    if (!item?.composition?.id) return;
    const existing = merged.get(item.composition.id);
    if (existing) {
      merged.set(item.composition.id, {
        ...existing,
        quantity: existing.quantity + (item.quantity || 1),
      });
      return;
    }
    merged.set(item.composition.id, { ...item });
  });
  return Array.from(merged.values());
};

/* -----------------------------
   Lazy-loaded Pages
-------------------------------- */
const LandingPage = React.lazy(() =>
  import("./pages/LandingPage").then((m) => ({
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
  import("./pages/AboutPage").then((m) => ({
    default: (m as any).AboutPage ?? (m as any).default,
  })),
);

const BuyerDashboard = React.lazy(() =>
  import("./components/BuyerDashboard").then((m) => ({
    default: (m as any).BuyerDashboard ?? (m as any).default,
  })),
);

const LearnerDashboard = React.lazy(() =>
  import("./components/LearnerDashboard").then((m) => ({
    default: (m as any).LearnerDashboard ?? (m as any).default,
  })),
);

const CheckoutPage = React.lazy(() =>
  import("./pages/CheckoutPage").then((m) => ({
    default: (m as any).CheckoutPage ?? (m as any).default,
  })),
);

const ComposerDashboard = React.lazy(() =>
  import("./components/ComposerDashboard").then((m) => ({
    default: (m as any).ComposerDashboard ?? (m as any).default,
  })),
);

const AdminDashboard = React.lazy(() =>
  import("./pages/AdminPanel").then((m) => ({
    default: (m as any).AdminPanel ?? (m as any).default,
  })),
);

const MessengerPage = React.lazy(() =>
  import("./pages/MessengerPage").then((m) => ({
    default: (m as any).MessengerPage ?? (m as any).default,
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
  imageSize?: string;
  imageRepeat?: string;
  imagePosition?: string;
};

const OUTLOOK_STAR_DARK = [
  "radial-gradient(circle at 18% 16%, rgba(118, 185, 255, 0.32), transparent 55%)",
  "radial-gradient(circle at 82% 22%, rgba(92, 162, 255, 0.26), transparent 52%)",
  "radial-gradient(circle at 52% 82%, rgba(28, 86, 160, 0.5), transparent 60%)",
  "radial-gradient(circle, rgba(255,255,255,0.22) 1px, transparent 1.2px)",
  "radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1.2px)",
  "linear-gradient(180deg, rgba(4,10,24,0.98) 0%, rgba(6,18,40,0.98) 54%, rgba(8,30,64,0.98) 100%)",
].join(", ");

const OUTLOOK_STAR_LIGHT = [
  "radial-gradient(circle at 18% 16%, rgba(168, 210, 255, 0.5), transparent 60%)",
  "radial-gradient(circle at 82% 20%, rgba(140, 188, 255, 0.42), transparent 58%)",
  "radial-gradient(circle at 52% 82%, rgba(96, 152, 212, 0.42), transparent 60%)",
  "radial-gradient(circle, rgba(255,255,255,0.46) 1px, transparent 1.2px)",
  "radial-gradient(circle, rgba(255,255,255,0.34) 1px, transparent 1.2px)",
  "linear-gradient(180deg, rgba(226, 238, 252, 0.98) 0%, rgba(208, 226, 248, 0.98) 58%, rgba(188, 210, 236, 0.98) 100%)",
].join(", ");

const OUTLOOK_ROUTE_BACKDROP: RouteBackdropConfig = {
  light: OUTLOOK_STAR_LIGHT,
  dark: OUTLOOK_STAR_DARK,
  overlayLight:
    "linear-gradient(140deg, rgba(236, 245, 255, 0.7), rgba(224, 236, 250, 0.62), rgba(210, 226, 244, 0.6))",
  overlayDark:
    "linear-gradient(140deg, rgba(7, 14, 30, 0.34), rgba(10, 22, 42, 0.46), rgba(10, 30, 54, 0.38))",
  imageSize: "cover, cover, cover, 180px 180px, 120px 120px, cover",
  imageRepeat: "no-repeat, no-repeat, no-repeat, repeat, repeat, no-repeat",
  imagePosition: "center, center, center, 0 0, 40px 60px, center",
};

function resolveRouteBackdrop(pathname: string): RouteBackdropConfig {
  return OUTLOOK_ROUTE_BACKDROP;
}

/* -----------------------------
   Error Boundary
-------------------------------- */
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  {
    hasError: boolean;
    error?: Error;
    reportStatus: "idle" | "sending" | "sent" | "failed";
    reportMessage?: string;
  }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, reportStatus: "idle" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, reportStatus: "idle", reportMessage: undefined };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  handleRefresh = () => {
    window.location.reload();
  };

  handleReport = async () => {
    if (this.state.reportStatus === "sending" || this.state.reportStatus === "sent") {
      return;
    }
    this.setState({ reportStatus: "sending", reportMessage: undefined });

    try {
      const session = await supabase.auth.getSession();
      if (!session?.data?.session) {
        this.setState({
          reportStatus: "failed",
          reportMessage: "Please sign in to report this error.",
        });
        return;
      }

      const reportMessage = buildErrorReportMessage({
        title: "App crash",
        message: this.state.error?.message,
        source: "error-boundary",
      });

      await supportService.createThread({
        subject: "Error report: App crash",
        message: reportMessage,
        context: "error-report",
      });

      this.setState({
        reportStatus: "sent",
        reportMessage: "Thanks. The report was sent to admin.",
      });
    } catch (error: any) {
      this.setState({
        reportStatus: "failed",
        reportMessage: error?.message || "Failed to report the error.",
      });
    }
  };

  render() {
    if (this.state.hasError) {
      const safeMessage = simplifyErrorMessage(
        this.state.error?.message || "An unexpected error occurred.",
      );
      const isReporting = this.state.reportStatus === "sending";
      const reportSent = this.state.reportStatus === "sent";

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md rounded-2xl border border-border/70 bg-card/90 p-6 text-center shadow-[0_24px_40px_-30px_rgba(15,23,42,0.6)]">
            <h1 className="mb-2 text-2xl font-bold text-destructive">
              Something went wrong
            </h1>
            <p className="mb-4 text-muted-foreground">
              We ran into a problem. You can refresh the page or report it.
            </p>
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-left text-sm text-foreground/90 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
              {safeMessage}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={this.handleRefresh}>Refresh</Button>
              <Button
                variant="outline"
                onClick={this.handleReport}
                disabled={isReporting || reportSent}
              >
                {isReporting ? "Reporting..." : reportSent ? "Reported" : "Report Error"}
              </Button>
            </div>
            {this.state.reportMessage ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {this.state.reportMessage}
              </p>
            ) : null}
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
        "--route-backdrop-image": routeBackdropImage,
        "--route-backdrop-image-size": routeBackdrop.imageSize ?? "cover",
        "--route-backdrop-image-repeat": routeBackdrop.imageRepeat ?? "no-repeat",
        "--route-backdrop-image-position": routeBackdrop.imagePosition ?? "center",
        "--route-backdrop-overlay": routeBackdropOverlay,
        "--route-backdrop-scrim": isDarkMode
          ? "linear-gradient(180deg, rgba(5,10,22,0.12), rgba(7,14,28,0.46), rgba(6,12,22,0.76))"
          : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(241,248,255,0.32), rgba(228,238,252,0.5))",
        "--route-panel-overlay": isDarkMode
          ? "linear-gradient(135deg, rgba(10,18,32,0.6), rgba(12,26,44,0.66), rgba(16,38,70,0.58))"
          : "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(236,246,255,0.78), rgba(224,238,252,0.68))",
        "--route-panel-overlay-strong": isDarkMode
          ? "linear-gradient(135deg, rgba(6,12,26,0.8), rgba(14,22,44,0.82), rgba(16,40,74,0.76))"
          : "linear-gradient(135deg, rgba(10,64,92,0.7), rgba(10,96,126,0.68), rgba(6,150,130,0.64))",
      }) as React.CSSProperties,
    [isDarkMode, routeBackdrop, routeBackdropImage, routeBackdropOverlay],
  );

  useEffect(() => {
    const guestKey = getCartStorageKey(null);
    if (appUser?.id) {
      const userKey = getCartStorageKey(appUser.id);
      const savedUserCart = readStoredCart(userKey);
      const guestCart = readStoredCart(guestKey);
      const merged = mergeCartItems(savedUserCart, guestCart);
      setCart(merged);
      writeStoredCart(userKey, merged);
      if (guestCart.length > 0 && typeof window !== "undefined") {
        window.localStorage.removeItem(guestKey);
      }
    } else {
      setCart(readStoredCart(guestKey));
    }
  }, [appUser?.id]);

  useEffect(() => {
    const storageKey = getCartStorageKey(appUser?.id ?? null);
    writeStoredCart(storageKey, cart);
  }, [appUser?.id, cart]);

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
    if (action === "report") {
      if (!appUser?.id) {
        toast.info("Please sign in to report this error.");
        return;
      }
      const reportMessage = buildErrorReportMessage({
        title: detail.title,
        message: detail.rawMessage ?? detail.message,
        status: detail.status,
        source: detail.source,
      });
      supportService
        .createThread({
          subject: detail.title ? `Error report: ${detail.title}` : "Error report",
          message: reportMessage,
          context: "error-report",
        })
        .then(() => {
          toast.success("Error reported to admin.");
          setAppErrorOpen(false);
        })
        .catch((error: any) => {
          console.error("[error-report] failed:", error);
          toast.error(error?.message || "Failed to report the error.");
        });
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
      const rawMessage = detail.rawMessage ?? detail.message;
      const normalizedMessage = simplifyErrorMessage(rawMessage, status);
      const normalizedLower = normalizedMessage.toLowerCase();
      const shouldSuggestRefresh =
        status === 408 ||
        status === 503 ||
        status >= 500 ||
        normalizedLower.includes("refresh") ||
        normalizedLower.includes("connection") ||
        normalizedLower.includes("server");

      if (!detail.actions || detail.actions.length === 0) {
        if (status === 401) {
          detail.actions = ["ok", "exit", "refresh"];
        } else if (status === 408 || status === 503) {
          detail.actions = ["refresh", "ok"];
        } else if (status >= 500) {
          detail.actions = ["refresh", "exit", "ok"];
        } else if (shouldSuggestRefresh) {
          detail.actions = ["refresh", "ok"];
        } else {
          detail.actions = ["ok"];
        }
      } else if (shouldSuggestRefresh && !detail.actions.includes("refresh")) {
        detail.actions = [...detail.actions, "refresh"];
      }

      detail.message = normalizedMessage;
      detail.rawMessage = rawMessage;
      if (shouldOfferReport(rawMessage, status)) {
        detail.reportable = true;
        if (!detail.actions.includes("report")) {
          detail.actions = [...detail.actions, "report"];
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
            backgroundSize: "var(--route-backdrop-image-size)",
            backgroundRepeat: "var(--route-backdrop-image-repeat)",
            backgroundPosition: "var(--route-backdrop-image-position)",
            opacity: isDarkMode ? 0.55 : 0.32,
            filter: isDarkMode
              ? "saturate(1.08) contrast(1.06) brightness(0.9)"
              : "saturate(1.08) contrast(1.02) brightness(1.03)",
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
                  backgroundSize:
                    "cover, cover, var(--route-backdrop-image-size)",
                  backgroundRepeat:
                    "no-repeat, no-repeat, var(--route-backdrop-image-repeat)",
                  backgroundPosition:
                    "center, center, var(--route-backdrop-image-position)",
                }}
                aria-hidden="true"
              />
              <div className="relative z-10 flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/95 p-7 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.9)] sm:p-10">
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
                <Route path="/messenger" element={<MessengerPage />} />
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
                  path="/learner"
                  element={
                    <DashboardWrapper
                      Component={LearnerDashboard}
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
