// src/app/components/Navbar.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { navbarService } from "@/services/navbarService";
import { buildProfileImageSrcSet, getOptimizedProfileImageUrl } from "@/services/profileImageService";
import { useLocation, NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { CartItem } from "@/app/types";
import { toast } from "sonner";
import {
  ShoppingCart,
  User as UserIcon,
  LogOut,
  Settings,
  Bell,
  Check,
  X,
  Loader,
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
  // use appUser from your AuthContext (Supabase)
  const { appUser, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const roles = appUser?.roles || [];
  const isAdmin = roles.includes("admin");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [processingNotification, setProcessingNotification] = useState<
    string | null
  >(null);
  const previousNotificationCount = useRef(0);

  // Polling interval (ms) for admin notifications
  const NOTIF_POLL_INTERVAL = 15000;

  // Fetch admin notifications (role requests and composer requests)
  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function fetchNotifications() {
      if (!isAdmin) {
        setNotifications([]);
        return;
      }
      setNotifLoading(true);
      try {
        const items = await navbarService.fetchAdminNotifications();
        if (!mounted) return;
        setNotifications(items);
        timer = setTimeout(fetchNotifications, NOTIF_POLL_INTERVAL);
      } catch (err) {
        if (!mounted) return;
        const status = (err as any)?.status;
        if (status === 401 || status === 403) {
          // Access revoked or role changed; stop polling to prevent noisy retries.
          setNotifications([]);
          return;
        }
        console.warn("Navbar notifications fetch error:", err);
        timer = setTimeout(fetchNotifications, NOTIF_POLL_INTERVAL);
      } finally {
        if (mounted) setNotifLoading(false);
      }
    }

    // only fetch when admin
    if (isAdmin) fetchNotifications();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      previousNotificationCount.current = 0;
      return;
    }

    const previous = previousNotificationCount.current;
    const current = notifications.length;
    previousNotificationCount.current = current;

    if (previous > 0 && current > previous) {
      const added = current - previous;
      toast.info(
        `${added} new admin notification${added > 1 ? "s" : ""} received`,
      );
    }
  }, [notifications, isAdmin]);

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
      label: "My Compositions",
      path: "/composer",
      showOn: ["any"],
      roles: ["composer"],
    },
    {
      label: "Admin",
      path: "/admin",
      showOn: ["any"],
      roles: ["admin"],
    },
  ];

  const dashboardPaths = useMemo(() => {
    const dashboards: Array<{ label: string; path: string; role: string }> = [];
    if (roles.includes("admin"))
      dashboards.push({
        label: "Admin Dashboard",
        path: "/admin",
        role: "admin",
      });
    if (roles.includes("composer"))
      dashboards.push({
        label: "Composer Dashboard",
        path: "/composer",
        role: "composer",
      });
    if (roles.includes("buyer"))
      dashboards.push({
        label: "Buyer Dashboard",
        path: "/buyer",
        role: "buyer",
      });
    return dashboards;
  }, [roles]);

  // helper: build avatar / initials
  const avatarUrl = appUser?.avatar_url ?? null;
  const displayName = appUser?.display_name ?? appUser?.email ?? "User";
  const initials = (() => {
    const name = displayName || "";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <nav className="texture-fabric sticky top-0 z-40 overflow-x-clip border-b border-border/80 bg-card/90 backdrop-blur-md">
      <div className="app-shell">
        <div className="flex h-16 min-w-0 items-center justify-between gap-2">
          {/* ================= Logo ================= */}
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center rounded-xl border border-[#0a2e43]/20 bg-gradient-to-br from-[#0b2940] to-[#081e32] px-2 py-1 shadow-[0_10px_20px_-14px_rgba(2,24,39,0.95)]">
              <img
                src={systemLogo}
                alt="Murekefu Music Hub logo"
                className="h-7 w-auto object-contain saturate-125 sm:h-8 [filter:drop-shadow(0_0_2px_rgba(255,255,255,0.35))]"
              />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">
                Murekefu Music Hub
              </h1>
              <p className="hidden truncate text-xs text-muted-foreground sm:block">Choral Music Hub</p>
            </div>
          </Link>

          {/* ================= Main Navigation ================= */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-border/80 bg-background/70 p-1">
            {navItems.map((item) => {
              const isVisible =
                item.showOn.includes("any") ||
                item.showOn.includes(location.pathname);
              const hasRole =
                item.roles.length === 0 ||
                item.roles.some((role) => roles.includes(role));
              if (!isVisible || !hasRole) return null;

              return (
                <NavLink key={item.path} to={item.path}>
                  {({ isActive }) => (
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={isActive ? "" : "text-muted-foreground"}
                    >
                      {item.label}
                    </Button>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* ================= Right Actions ================= */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span className="motion-float-delayed hidden rounded-full border border-border/80 bg-secondary/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-foreground xl:inline-flex">
              Live Marketplace
            </span>
            {/* ===== Admin Notifications (Admin Only) ===== */}
            {roles.includes("admin") && (
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
                      <span className="text-xs text-gray-500">
                        {notifLoading
                          ? "Refreshing..."
                          : `${notifications.length}`}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {notifications.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-600">
                      No notifications
                    </div>
                  )}

                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="px-4 py-3 border-b hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="min-w-0">
                          {n.type === "invite" ? (
                            <>
                              <span className="font-semibold block">
                                Composer Invite
                              </span>
                              <span className="text-xs text-gray-500">
                                {n.email}
                              </span>
                            </>
                          ) : n.type === "payment_request" ? (
                            <>
                              <span className="font-semibold block">
                                Pending M-Pesa Payment
                              </span>
                              <span className="text-xs text-gray-500">
                                {n.displayName || n.email}
                              </span>
                              <span className="text-xs text-gray-500 block mt-1">
                                Ref: {n.mpesaCode || "-"} | Amount: $
                                {Number(n.amount || 0).toFixed(2)}
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
                              <span className="text-xs text-gray-500">
                                {n.displayName || n.email}
                              </span>
                            </>
                          )}
                          <span className="text-xs text-gray-400 block mt-1">
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
                              disabled={processingNotification === n.id}
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
                        {n.type === "request" && n.canApprove === false && (
                          <p className="text-xs text-amber-700">
                            User profile missing. You can reject this stale
                            request.
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    View all in Admin
                  </DropdownMenuItem>
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
                            ${item.composition.price.toFixed(2)}
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
                            ${totalPrice.toFixed(2)}
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
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={`${displayName} avatar`}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <UserIcon className="size-5" />
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
                  <DropdownMenuItem onClick={() => navigate("/login")}>
                    Sign In
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;








