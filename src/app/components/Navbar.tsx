// src/app/components/Navbar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { navbarService } from "@/services/navbarService";
import { buildProfileImageSrcSet, getOptimizedProfileImageUrl } from "@/services/profileImageService";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLearnerStatus } from "@/hooks/useLearnerStatus";
import { CartItem } from "@/app/types";
import { formatKesAmount } from "@/lib/currency";
import { toast } from "sonner";
import { ensureArray } from "@/lib/ensureArray";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import {
  ShoppingCart,
  LogOut,
  Settings,
  Bell,
  Check,
  X,
  Loader,
  Sun,
  Moon,
  MessageSquare,
  PanelTopClose,
  PanelTopOpen,
  User,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/app/components/ui/sheet";
import systemLogo from "./images/system-logo-cutout.png";

interface NavbarProps {
  cart?: CartItem[];
  onRemoveFromCart?: (compositionId: string) => void;
}

export function Navbar({ cart = [], onRemoveFromCart }: NavbarProps) {
  const NAVBAR_MINIMIZED_KEY = "murekefu.navbar.minimized";
  // use appUser from your AuthContext (Supabase)
  const { appUser, signOut } = useAuth();
  const { hasLearnerAccess } = useLearnerStatus();
  const { mode, setMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isDarkMode = mode === "dark";

  const handleToggleTheme = () => {
    setMode(isDarkMode ? "light" : "dark");
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const roles = appUser?.roles || [];
  const isAuthenticated = Boolean(appUser?.id);
  const isAdmin = roles.includes("admin");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messengerUnreadCount, setMessengerUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [processingNotification, setProcessingNotification] = useState<
    string | null
  >(null);
  const [isNavbarMinimized, setIsNavbarMinimized] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(NAVBAR_MINIMIZED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const previousNotificationCount = useRef(0);

  // Polling interval (ms) for navbar notifications
  const NOTIF_POLL_INTERVAL = 15000;

  // Fetch notifications for all authenticated users.
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function fetchNotifications() {
      if (!isAuthenticated) {
        setNotifications([]);
        setMessengerUnreadCount(0);
        return;
      }
      setNotifLoading(true);
      try {
        const result = await navbarService.fetchNotifications({ isAdmin });
        if (!mounted) return;
        setNotifications(
          ensureArray<any>(result?.notificationItems, ["notifications"]),
        );
        setMessengerUnreadCount(Math.max(0, Number(result?.messengerUnreadCount || 0)));
        timer = setTimeout(fetchNotifications, NOTIF_POLL_INTERVAL);
      } catch (err) {
        if (!mounted) return;
        console.warn("Navbar notifications fetch error:", err);
        timer = setTimeout(fetchNotifications, NOTIF_POLL_INTERVAL);
      } finally {
        if (mounted) setNotifLoading(false);
      }
    }

    if (isAuthenticated) fetchNotifications();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isAdmin, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      previousNotificationCount.current = 0;
      return;
    }

    const previous = previousNotificationCount.current;
    const current = notifications.length;
    previousNotificationCount.current = current;

    if (previous > 0 && current > previous) {
      const added = current - previous;
      toast.info(
        `${added} new notification${added > 1 ? "s" : ""} received`,
      );
    }
  }, [notifications, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (location.pathname.startsWith("/messenger")) {
      setMessengerUnreadCount(0);
    }
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        NAVBAR_MINIMIZED_KEY,
        isNavbarMinimized ? "true" : "false",
      );
    } catch {
      // ignore persistence errors
    }
  }, [isNavbarMinimized]);

  // Handle approve/reject actions
  const handleApproveRequest = async (
    notificationId: string,
    userId: string,
    requestedRole: "composer" | "admin" = "composer",
  ) => {
    setProcessingNotification(notificationId);
    try {
      await navbarService.approveRoleRequest(userId, requestedRole);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to approve request:", err);
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleRejectRequest = async (
    notificationId: string,
    userId: string,
    requestedRole: "composer" | "admin" = "composer",
  ) => {
    setProcessingNotification(notificationId);
    try {
      await navbarService.rejectRoleRequest(userId, requestedRole);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to reject request:", err);
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleApprovePayment = async (
    notificationId: string,
    submissionId: string,
  ) => {
    setProcessingNotification(notificationId);
    try {
      await navbarService.approvePaymentSubmission(submissionId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to approve payment submission:", err);
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleRejectPayment = async (
    notificationId: string,
    submissionId: string,
  ) => {
    setProcessingNotification(notificationId);
    try {
      await navbarService.rejectPaymentSubmission(submissionId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to reject payment submission:", err);
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleAdmitEnrollment = async (
    notificationId: string,
    enrollmentId: string,
  ) => {
    setProcessingNotification(notificationId);
    try {
      await navbarService.admitEnrollment(enrollmentId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to admit enrollment:", err);
    } finally {
      setProcessingNotification(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.length === 0 || markingAllRead) return;
    setMarkingAllRead(true);
    try {
      const result = await navbarService.markNotificationsRead(notifications);
      if (result.partialFailure) {
        const refreshed = await navbarService.fetchNotifications({ isAdmin });
        setNotifications(
          ensureArray<any>(refreshed?.notificationItems, ["notifications"]),
        );
        setMessengerUnreadCount(
          Math.max(0, Number(refreshed?.messengerUnreadCount || 0)),
        );
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
      toast.error("Failed to mark notifications as read");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const navItems = [
    {
      label: "Learn Music",
      path: "/",
      showOn: ["/"],
      roles: [],
    },
    {
      label: "About Us",
      path: "/about",
      showOn: ["/"],
      roles: [],
    },
    {
      label: "Music Hub",
      path: "/marketplace",
      showOn: ["any"],
      roles: [],
    },
    {
      label: "My Library",
      path: "/buyer",
      showOn: ["any"],
      roles: ["buyer"],
    },
    {
      label: "Learner",
      path: "/learner",
      showOn: ["any"],
      roles: [],
    },
    {
      label: "My Arrangements",
      path: "/composer?tab=arrangements",
      showOn: ["any"],
      roles: ["composer"],
      isActive: () =>
        location.pathname === "/composer" &&
        new URLSearchParams(location.search).get("tab") === "arrangements",
    },
    {
      label: "My Compositions",
      path: "/composer?tab=compositions",
      showOn: ["any"],
      roles: ["composer"],
      isActive: () =>
        location.pathname === "/composer" &&
        new URLSearchParams(location.search).get("tab") === "compositions",
    },
    {
      label: "Admin",
      path: "/admin",
      showOn: ["any"],
      roles: ["admin"],
    },
  ];

  const isNavItemActive = (item: { path: string; isActive?: () => boolean }) => {
    if (item.isActive) return item.isActive();
    if (!item.path) return false;
    const [rawPath, rawQuery] = item.path.split("?");
    if (rawPath !== location.pathname) return false;
    if (!rawQuery) return true;
    const targetParams = new URLSearchParams(rawQuery);
    const currentParams = new URLSearchParams(location.search);
    for (const [key, value] of targetParams.entries()) {
      if (currentParams.get(key) !== value) return false;
    }
    return true;
  };

  const dashboardPaths = useMemo(() => {
    const dashboards: Array<{ label: string; path: string; role: string }> = [];
    if (roles.includes("admin"))
      dashboards.push({
        label: "Admin Dashboard",
        path: "/admin",
        role: "admin",
      });
    if (hasLearnerAccess)
      dashboards.push({
        label: "Learner Dashboard",
        path: "/learner",
        role: "learner",
      });
    if (roles.includes("composer")) {
      dashboards.push({
        label: "My Arrangements",
        path: "/composer?tab=arrangements",
        role: "composer-arrangements",
      });
      dashboards.push({
        label: "My Compositions",
        path: "/composer?tab=compositions",
        role: "composer-compositions",
      });
    }
    if (roles.includes("buyer"))
      dashboards.push({
        label: "Buyer Dashboard",
        path: "/buyer",
        role: "buyer",
      });
    return dashboards;
  }, [hasLearnerAccess, roles]);

  // helper: build avatar / initials
  const avatarUrl = appUser?.avatar_url ?? null;
  const optimizedAvatarUrl = getOptimizedProfileImageUrl(avatarUrl, {
    width: 80,
    height: 80,
    quality: 68,
    resize: "cover",
  });
  const avatarSrcSet = buildProfileImageSrcSet(avatarUrl, [40, 64, 96], {
    quality: 68,
    resize: "cover",
  });
  const displayName = appUser?.display_name ?? appUser?.email ?? "User";
  const initials = (() => {
    const name = displayName || "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <nav className="texture-fabric sticky top-0 z-40 overflow-x-clip border-b border-border/80 bg-card/95">
      <div className="app-shell">
        <div
          className={`flex min-w-0 items-center justify-between gap-2 transition-all duration-200 sm:gap-3 ${
            isNavbarMinimized ? "h-14" : "h-16"
          }`}
        >
          {/* ================= Logo ================= */}
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none">
            <span className="inline-flex shrink-0 items-center rounded-xl border border-[#0a2e43]/20 bg-gradient-to-br from-[#0b2940] to-[#081e32] px-2 py-1 shadow-[0_10px_20px_-14px_rgba(2,24,39,0.95)]">
              <img
                src={systemLogo}
                alt="Murekefu Music Hub logo"
                className="h-7 w-auto object-contain saturate-125 sm:h-8 [filter:drop-shadow(0_0_2px_rgba(255,255,255,0.35))]"
              />
            </span>
            <div className="min-w-0">
              <h1 className="hidden truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:block sm:text-lg">
                Murekefu Music Hub
              </h1>
              <h1 className="truncate text-sm font-semibold leading-tight tracking-tight text-foreground sm:hidden">
                Music Hub
              </h1>
              {!isNavbarMinimized ? (
                <p className="hidden truncate text-xs text-muted-foreground md:block">
                  Choral Music Hub
                </p>
              ) : null}
            </div>
          </Link>

          {/* ================= Main Navigation ================= */}
          <div
            className={`hidden lg:flex items-center gap-2 overflow-hidden rounded-full border border-border/80 bg-background/70 transition-all duration-200 ${
              isNavbarMinimized
                ? "max-w-0 border-transparent p-0 opacity-0"
                : "max-w-[760px] p-1 opacity-100"
            }`}
          >
            {navItems.map((item) => {
              const isVisible =
                item.showOn.includes("any") ||
                item.showOn.includes(location.pathname);
              const hasRole =
                item.roles.length === 0 ||
                item.roles.some((role) => roles.includes(role));
              const requiresLearnerAccess =
                item.path === "/learner" && !hasLearnerAccess;
              if (!isVisible || !hasRole || requiresLearnerAccess) return null;

              const isActive = isNavItemActive(item);
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={isActive ? "" : "text-muted-foreground"}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* ================= Right Actions ================= */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setIsNavbarMinimized((current) => !current)}
              aria-label={isNavbarMinimized ? "Expand navigation" : "Minimize navigation"}
              title={isNavbarMinimized ? "Expand navigation" : "Minimize navigation"}
            >
              {isNavbarMinimized ? (
                <PanelTopOpen className="size-5" />
              ) : (
                <PanelTopClose className="size-5" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleToggleTheme}
              aria-label={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </Button>
            {!isAuthenticated && (
              <Button
                type="button"
                className="rounded-full bg-primary px-4 text-xs font-semibold tracking-[0.08em] text-primary-foreground shadow-[0_12px_24px_-16px_rgba(15,23,42,0.8)]"
                onClick={() => {
                  const currentPath = `${location.pathname}${location.search}${location.hash}`;
                  persistPostLoginRedirect(currentPath);
                  navigate(buildLoginPath({ nextPath: currentPath }));
                }}
              >
                <User className="mr-2 size-4" />
                Sign In
              </Button>
            )}
            {isAuthenticated && (
              <Button
                asChild
                variant="outline"
                className="relative rounded-full border-border/80 bg-secondary/40 text-xs font-semibold tracking-[0.06em]"
              >
                <Link to="/messenger">
                  <MessageSquare className="mr-2 size-4" />
                  <span className="hidden sm:inline">Messenger</span>
                  {messengerUnreadCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 size-5 min-w-5 px-1 text-[10px] leading-none">
                      {messengerUnreadCount > 99 ? "99+" : messengerUnreadCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}
            {/* ===== Notifications (All Authenticated Roles) ===== */}
            {isAuthenticated && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <Bell className="size-5" />
                    {notifications.length > 0 && (
                      <Badge className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0">
                        {notifications.length}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Notifications</span>
                      <div className="flex items-center gap-2">
                        {notifications.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleMarkAllAsRead();
                            }}
                            disabled={notifLoading || markingAllRead}
                          >
                            {markingAllRead ? (
                              <Loader className="mr-1 size-3 animate-spin" />
                            ) : null}
                            Mark all as read
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {notifLoading ? "Refreshing..." : `${notifications.length}`}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {notifications.length === 0 && (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No notifications
                    </div>
                  )}

                  {notifications.length > 0 && (
                    <div className="max-h-[26rem] space-y-2 overflow-y-auto px-2 pb-2">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl border border-border/70 bg-card/95 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.55)] transition-colors hover:bg-muted/35"
                        >
                          <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          {n.type === "message" ? (
                            <>
                              <span className="font-semibold block">
                                New Message
                              </span>
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {n.subject || "Messenger"}
                              </span>
                              {n.preview ? (
                                <span className="text-xs text-muted-foreground line-clamp-2 block mt-1">
                                  {n.preview}
                                </span>
                              ) : null}
                            </>
                          ) : n.type === "announcement" ? (
                            <>
                              <span className="font-semibold block">
                                Announcement
                              </span>
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {n.subject || "Platform announcement"}
                              </span>
                              {n.preview ? (
                                <span className="text-xs text-muted-foreground line-clamp-2 block mt-1">
                                  {n.preview}
                                </span>
                              ) : null}
                              {Number(n.recipientCount || 0) > 0 ? (
                                <span className="text-xs text-muted-foreground block mt-1">
                                  Audience: {Number(n.recipientCount)} user(s)
                                </span>
                              ) : null}
                            </>
                          ) : n.type === "notification" ? (
                            <>
                              <span className="font-semibold block">
                                Notification
                              </span>
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {n.subject || "System notification"}
                              </span>
                              {n.preview ? (
                                <span className="text-xs text-muted-foreground line-clamp-2 block mt-1">
                                  {n.preview}
                                </span>
                              ) : null}
                            </>
                          ) : n.type === "invite" ? (
                            <>
                              <span className="font-semibold block">
                                Composer Invite
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {n.email}
                              </span>
                            </>
                          ) : n.type === "payment_request" ? (
                            <>
                              <span className="font-semibold block">
                                Pending M-Pesa Payment
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {n.displayName || n.email}
                              </span>
                              <span className="text-xs text-muted-foreground block mt-1">
                                Ref: {n.mpesaCode || "-"} | Amount:{" "}
                                {formatKesAmount(n.amount || 0)}
                              </span>
                            </>
                          ) : n.type === "enrollment_request" ? (
                            <>
                              <span className="font-semibold block">
                                Enrollment Request
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {n.displayName || n.email}
                              </span>
                              <span className="text-xs text-muted-foreground block mt-1">
                                Program: {n.program || "-"} | Level:{" "}
                                {n.skillLevel || "-"}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-semibold block">
                                {(n.requestedRole || "composer")
                                  .toString()
                                  .charAt(0)
                                  .toUpperCase() +
                                  (n.requestedRole || "composer")
                                    .toString()
                                    .slice(1)}{" "}
                                Access Request
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {n.displayName || n.email}
                              </span>
                            </>
                          )}
                          <span className="text-xs text-muted-foreground/80 block mt-1">
                            {new Date(
                              n.createdAt || n.created_at,
                            ).toLocaleString()}
                          </span>
                        </div>

                        {/* Action buttons for requests */}
                        {n.type === "request" && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApproveRequest(
                                  n.id,
                                  n.userId,
                                  n.requestedRole === "admin"
                                    ? "admin"
                                    : "composer",
                                );
                              }}
                              disabled={
                                processingNotification === n.id ||
                                n.canApprove === false
                              }
                            >
                              {processingNotification === n.id ? (
                                <Loader className="size-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="size-4 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectRequest(
                                  n.id,
                                  n.userId,
                                  n.requestedRole === "admin"
                                    ? "admin"
                                    : "composer",
                                );
                              }}
                              disabled={processingNotification === n.id}
                            >
                              {processingNotification === n.id ? (
                                <Loader className="size-4 mr-1 animate-spin" />
                              ) : (
                                <X className="size-4 mr-1" />
                              )}
                              Reject
                            </Button>
                          </div>
                        )}
                        {n.type === "enrollment_request" && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdmitEnrollment(n.id, n.enrollmentId);
                              }}
                              disabled={
                                processingNotification === n.id ||
                                n.canApprove === false
                              }
                            >
                              {processingNotification === n.id ? (
                                <Loader className="size-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="size-4 mr-1" />
                              )}
                              Admit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate("/admin");
                              }}
                            >
                              Open Admin
                            </Button>
                          </div>
                        )}
                        {n.type === "payment_request" && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApprovePayment(n.id, n.submissionId);
                              }}
                              disabled={
                                processingNotification === n.id ||
                                n.canApprove === false
                              }
                            >
                              {processingNotification === n.id ? (
                                <Loader className="size-4 mr-1 animate-spin" />
                              ) : (
                                <Check className="size-4 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRejectPayment(n.id, n.submissionId);
                              }}
                              disabled={processingNotification === n.id}
                            >
                              {processingNotification === n.id ? (
                                <Loader className="size-4 mr-1 animate-spin" />
                              ) : (
                                <X className="size-4 mr-1" />
                              )}
                              Reject
                            </Button>
                          </div>
                        )}
                        {n.canApprove === false && (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            {n.cannotApproveReason ||
                              "This item cannot be approved by your account."}
                          </p>
                        )}
                      </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <DropdownMenuSeparator />
                  {isAdmin ? (
                    <DropdownMenuItem onClick={() => navigate("/admin")}>
                      View all in Admin
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={() =>
                        navigate(dashboardPaths[0]?.path || "/marketplace")
                      }
                    >
                      <MessageSquare className="mr-2 size-4" />
                      Open Messenger
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* ===== Cart (Buyer Only) ===== */}
            {roles.includes("buyer") && cart.length > 0 && onRemoveFromCart && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="relative">
                    <ShoppingCart className="size-5" />
                    {totalItems > 0 && (
                      <Badge className="absolute -top-2 -right-2 size-6 flex items-center justify-center p-0">
                        {totalItems}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>

                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Shopping Cart</SheetTitle>
                    <SheetDescription>
                      {totalItems === 0
                        ? "Your cart is empty"
                        : `${totalItems} item(s) in cart`}
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.composition.id}
                        className="flex justify-between border-b pb-4"
                      >
                        <div className="min-w-0">
                          <h4 className="font-medium">
                            {item.composition.title}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {item.composition.composerName}
                          </p>
                          <p className="font-semibold">
                            {formatKesAmount(item.composition.price)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveFromCart(item.composition.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}

                    {cart.length > 0 && (
                      <div className="pt-4 border-t">
                        <div className="flex justify-between mb-4">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold">
                            {formatKesAmount(totalPrice)}
                          </span>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => navigate("/checkout")}
                        >
                          Checkout
                        </Button>
                      </div>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            )}

            {/* ===== User Menu ===== */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  {optimizedAvatarUrl || avatarUrl ? (
                    <img
                      src={optimizedAvatarUrl || avatarUrl || undefined}
                      srcSet={avatarSrcSet || undefined}
                      sizes="40px"
                      alt={`${displayName} avatar`}
                      className="w-5 h-5 rounded-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="grid size-5 place-items-center rounded-full bg-muted text-[10px] font-semibold uppercase leading-none text-muted-foreground">
                      {initials}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                {appUser ? (
                  <>
                    <DropdownMenuLabel>
                      <p className="font-medium">{displayName}</p>
                      <p className="text-xs text-gray-500">
                        {roles.length === 0 ? "user" : roles.join(", ")}
                      </p>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    {/* Dashboard(s) - Show all available dashboards for user roles */}
                    {dashboardPaths.length > 0 && (
                      <>
                        {dashboardPaths.length === 1 ? (
                          <DropdownMenuItem
                            onClick={() => navigate(dashboardPaths[0].path)}
                          >
                            {dashboardPaths[0].label}
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {dashboardPaths.map((dashboard) => (
                              <DropdownMenuItem
                                key={dashboard.role}
                                onClick={() => navigate(dashboard.path)}
                              >
                                {dashboard.label}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Manage Account */}
                    <DropdownMenuItem
                      onClick={() => navigate("/manage-account")}
                    >
                      <Settings className="size-4 mr-2" />
                      Manage Account
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {/* Logout */}
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="text-red-600"
                    >
                      <LogOut className="size-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    onClick={() => {
                      const currentPath = `${location.pathname}${location.search}${location.hash}`;
                      persistPostLoginRedirect(currentPath);
                      navigate(buildLoginPath({ nextPath: currentPath }));
                    }}
                  >
                    <User className="size-4 mr-2" />
                    Sign In
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          className={`overflow-hidden transition-all duration-200 lg:hidden ${
            isNavbarMinimized ? "max-h-0 pb-0 opacity-0" : "max-h-24 pb-3 opacity-100"
          }`}
        >
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap rounded-full border border-border/70 bg-background/55 p-1">
            {navItems.map((item) => {
              const isVisible =
                item.showOn.includes("any") ||
                item.showOn.includes(location.pathname);
              const hasRole =
                item.roles.length === 0 ||
                item.roles.some((role) => roles.includes(role));
              const requiresLearnerAccess =
                item.path === "/learner" && !hasLearnerAccess;
              if (!isVisible || !hasRole || requiresLearnerAccess) return null;

              const isActive = isNavItemActive(item);
              return (
                <Link key={`mobile-${item.path}`} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className={`rounded-full px-4 ${isActive ? "" : "text-muted-foreground"}`}
                  >
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
