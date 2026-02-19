// src/app/components/Navbar.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { authService } from "@/services/api";
import { useLocation, NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { CartItem } from "@/app/types";
import { ShoppingCart, User as UserIcon, LogOut, Settings, Bell } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import logo from "@/app/components/images/logo.jpg";
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

interface NavbarProps {
  cart?: CartItem[];
  onRemoveFromCart?: (compositionId: string) => void;
}

export function Navbar({ cart = [], onRemoveFromCart }: NavbarProps) {
  const { firebaseUser, appUser, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const [roles, setRoles] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Polling interval (ms) for admin notifications
  const NOTIF_POLL_INTERVAL = 15000;

  const ADMIN_IDENTIFIERS = [
    "fredrickmakori102@gmail.com",
    "murekefumusichub",
  ];

  const isAdminEmail = (email?: string | null) => {
    if (!email) return false;
    const e = email.toLowerCase().trim();
    return ADMIN_IDENTIFIERS.some((id) => {
      const nid = id.toLowerCase();
      return e === nid || e.includes(nid);
    });
  };

useEffect(() => {
  async function fetchRoles() {
    if (!firebaseUser?.uid) {
      setRoles([]);
      return;
    }

    // Query the users table by firebase_uid and get related roles
    const { data, error } = await supabase
      .from("users")
      .select(`
        user_roles (
          roles (name)
        )
      `)
      .eq("firebase_uid", firebaseUser.uid)
      .maybeSingle();

    if (error) {
      console.error("Navbar role fetch error:", error.message);
      return;
    }

    const roleNames =
      data?.user_roles?.map((r: any) => r.roles?.name).filter(Boolean) ?? [];

    // If the firebase email matches one of the admin identifiers, ensure admin role exists client-side
    const augmented = [...new Set([...(roleNames || []), ...(isAdminEmail(firebaseUser?.email) ? ['admin'] : [])])];

    setRoles(augmented);
  }

  fetchRoles();
}, [firebaseUser]);

// Fetch admin notifications (role requests and composer requests)
useEffect(() => {
  let mounted = true;
  let timer: any;

  async function fetchNotifications() {
    if (!supabase || !roles.includes("admin")) return setNotifications([]);
    setNotifLoading(true);
    try {
      // Try to fetch role requests without assuming column names (some deployments
      // use different shapes: invites use {email, invitedBy, createdAt, used}
      // while user requests use {user_id, requested_role, status, created_at}).
      const resp = await supabase
        .from("role_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      let rrData = resp.data;
      if (resp.error) {
        // fallback try different createdAt casing
        const alt = await supabase
          .from("role_requests")
          .select("*")
          .order("createdAt", { ascending: false })
          .limit(50);
        if (alt.error) throw resp.error;
        rrData = alt.data;
      }

      // composer requests on users table
      const { data: composerReqs, error: compErr } = await supabase
        .from("users")
        .select("id, email, display_name, created_at, composer_request")
        .eq("composer_request", true)
        .order("created_at", { ascending: false })
        .limit(50);

      if (compErr) throw compErr;

      const items: any[] = [];

      (rrData || []).forEach((r: any) => {
        // If this row looks like an invite (has email), treat as invite
        if (r.email || r.invitedBy || r.used !== undefined) {
          items.push({
            id: `invite:${r.id || r.email || Math.random()}`,
            type: "invite",
            email: r.email,
            invitedBy: r.invitedBy || r.invited_by,
            createdAt: r.createdAt || r.created_at,
            used: r.used,
          });
          return;
        }

        // If this row looks like a requested role entry
        if (r.user_id || r.requested_role || r.status) {
          items.push({
            id: `request:${r.id || r.user_id}`,
            type: "role_request",
            userId: r.user_id,
            requestedRole: r.requested_role || r.requestedRole,
            status: r.status,
            createdAt: r.createdAt || r.created_at,
          });
          return;
        }
      });

      (composerReqs || []).forEach((u: any) =>
        items.push({
          id: `composer:${u.id}`,
          type: "composer_request",
          userId: u.id,
          email: u.email,
          displayName: u.display_name,
          createdAt: u.created_at,
        }),
      );

      if (mounted) setNotifications(items);
    } catch (err) {
      console.warn("Navbar notifications fetch error:", err);
    } finally {
      if (mounted) setNotifLoading(false);
      // schedule next poll
      timer = setTimeout(fetchNotifications, NOTIF_POLL_INTERVAL);
    }
  }

  // only fetch when admin
  if (roles.includes("admin")) fetchNotifications();

  return () => {
    mounted = false;
    if (timer) clearTimeout(timer);
  };
}, [roles]);

// Real-time subscriptions: update notifications on DB changes
useEffect(() => {
  if (!supabase || !roles.includes("admin")) return;

  const channel = supabase.channel("public:notifications");

  // role_requests: insert/update/delete
  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "role_requests" },
    (payload) => {
      const i = payload.record;
      const item = {
        id: `invite:${i.id || i.email}`,
        type: "invite",
        email: i.email || i.email_address,
        invitedBy: i.invitedBy || i.invited_by,
        createdAt: i.createdAt || i.created_at,
        used: i.used,
      };
      setNotifications((curr) => [item, ...curr.filter((n) => n.id !== item.id)]);
    },
  );

  channel.on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "role_requests" },
    (payload) => {
      const i = payload.record;
      const id = `invite:${i.id || i.email}`;
      setNotifications((curr) => curr.map((n) => (n.id === id ? { ...n, ...{
        email: i.email || i.email_address,
        invitedBy: i.invitedBy || i.invited_by,
        createdAt: i.createdAt || i.created_at,
        used: i.used,
      } } : n)));
    },
  );

  channel.on(
    "postgres_changes",
    { event: "DELETE", schema: "public", table: "role_requests" },
    (payload) => {
      const i = payload.old || payload.record;
      const id = `invite:${i.id || i.email}`;
      setNotifications((curr) => curr.filter((n) => n.id !== id));
    },
  );

  // users table: composer_request flag set/insert
  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "users" },
    (payload) => {
      const u = payload.record;
      const composerFlag = u?.composer_request ?? u?.composerRequest;
      if (composerFlag) {
        const item = {
          id: `composer:${u.id}`,
          type: "composer_request",
          userId: u.id,
          email: u.email,
          displayName: u.display_name || u.displayName,
          createdAt: u.created_at || u.createdAt,
        };
        setNotifications((curr) => [item, ...curr.filter((n) => n.id !== item.id)]);
      }
    },
  );

  channel.on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "users" },
    (payload) => {
      const u = payload.record;
      const id = `composer:${u.id}`;
      const composerFlag = u?.composer_request ?? u?.composerRequest;
      if (composerFlag) {
        setNotifications((curr) => [
          { id, type: "composer_request", userId: u.id, email: u.email, displayName: u.display_name || u.displayName, createdAt: u.created_at || u.createdAt },
          ...curr.filter((n) => n.id !== id),
        ]);
      } else {
        setNotifications((curr) => curr.filter((n) => n.id !== id));
      }
    },
  );

  channel.subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch (e) {
      // ignore
    }
  };
}, [roles]);

useEffect(() => {
  // Ensure a Supabase user record exists for the signed-in Firebase user
  if (!firebaseUser) return;

  (async () => {
    try {
      await authService.syncUser(firebaseUser);
    } catch (err) {
      console.error('Navbar: failed to sync user to Supabase', err);
    }
  })();
}, [firebaseUser]);

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

  const getDashboardPath = () => {
    if (!roles || roles.length === 0) return "/";
    if (roles.includes("admin")) return "/admin";
    if (roles.includes("composer")) return "/composer";
    if (roles.includes("buyer")) return "/buyer";
    return "/";
  };

  return (
    <nav className="bg-white shadow-md border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* ================= Logo ================= */}
          <Link to="/" className="flex items-center gap-2">
            <img
              src={logo}
              alt="Murekefu Logo"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h1 className="font-semibold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Murekefu Music Hub
              </h1>
              <p className="text-xs text-gray-500">Choral Music Hub</p>
            </div>
          </Link>

          {/* ================= Main Navigation ================= */}
          <div className="hidden md:flex items-center gap-3">
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
                    <Button variant={isActive ? "default" : "ghost"}>
                      {item.label}
                    </Button>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* ================= Right Actions ================= */}
          <div className="flex items-center gap-3">
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
                      <span className="text-xs text-gray-500">{notifLoading ? 'Refreshing...' : `${notifications.length}`}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  {notifications.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-600">No notifications</div>
                  )}

                  {notifications.map((n) => (
                    <DropdownMenuItem key={n.id} onClick={() => navigate('/admin')}>
                      <div className="flex flex-col">
                        {n.type === 'invite' ? (
                          <>
                            <span className="font-semibold">Composer Invite</span>
                            <span className="text-xs text-gray-500">{n.email}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">Composer Request</span>
                            <span className="text-xs text-gray-500">{n.displayName || n.email}</span>
                          </>
                        )}
                        <span className="text-xs text-gray-400">{new Date(n.createdAt || n.created_at).toLocaleString()}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/admin')}>View all in Admin</DropdownMenuItem>
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
                        <div>
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
                  <UserIcon className="size-5" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56">
                {firebaseUser ? (
                  <>
                    <DropdownMenuLabel>
                      <p className="font-medium">
                        {firebaseUser.displayName || firebaseUser.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {roles.join(", ") || "user"}
                      </p>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    {/* Dashboard */}
                    <DropdownMenuItem
                      onClick={() => navigate(getDashboardPath())}
                    >
                      Dashboard
                    </DropdownMenuItem>

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
                      onClick={signOut}
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
