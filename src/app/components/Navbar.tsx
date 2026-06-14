import { useEffect, useMemo, useRef, useState } from "react";
import { navbarService } from "@/services/navbarService";
import {
  buildProfileImageSrcSet,
  getOptimizedProfileImageUrl,
} from "@/services/profileImageService";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useLearnerStatus } from "@/hooks/useLearnerStatus";
import { CartItem } from "@/app/types";
import { formatKesAmount } from "@/lib/currency";
import { toast } from "sonner";
import { ensureArray } from "@/lib/ensureArray";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { MESSENGER_INBOX_UPDATED_EVENT } from "@/lib/messengerEvents";

import {
  ShoppingCart,
  LogOut,
  Settings,
  Bell,
  Sun,
  Moon,
  MessageSquare,
  User,
  ChevronDown,
  PanelTopOpen,
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
} from "@/app/components/ui/sheet";

import systemLogo from "./images/system-logo-cutout.png";

interface NavbarProps {
  cart?: CartItem[];
  onRemoveFromCart?: (compositionId: string) => void;
}

export function Navbar({ cart = [] }: NavbarProps) {
  const { appUser, signOut } = useAuth();
  const { hasLearnerAccess } = useLearnerStatus();
  const { mode, setMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const isDarkMode = mode === "dark";
  const roles = appUser?.roles || [];
  const isAuthenticated = Boolean(appUser?.id);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [messengerUnreadCount, setMessengerUnreadCount] = useState(0);

  const NOTIF_POLL_INTERVAL = 15000;

  // ================= NAV STRUCTURE =================
  const primaryNav = [
    { label: "Home", path: "/" },
    { label: "Learn", path: "/enroll" },
    { label: "Arrangements", path: "/marketplace/arrangements" },
    { label: "Compositions", path: "/marketplace/compositions" },
  ];

  const secondaryNav = [
    { label: "About", path: "/about" },
    { label: "Testimonials", path: "/#testimonials" },
    { label: "Help", path: "/help" },
    { label: "Contact", path: "/contact" },
  ];

  const dashboardPaths = useMemo(() => {
    const dashboards: any[] = [];

    if (roles.includes("admin"))
      dashboards.push({ label: "Admin Dashboard", path: "/admin" });

    if (hasLearnerAccess)
      dashboards.push({ label: "Learner Dashboard", path: "/learner" });

    if (roles.includes("composer")) {
      dashboards.push({
        label: "My Arrangements",
        path: "/composer?tab=arrangements",
      });
      dashboards.push({
        label: "My Compositions",
        path: "/composer?tab=compositions",
      });
    }

    if (roles.includes("buyer"))
      dashboards.push({ label: "My Library", path: "/buyer" });

    return dashboards;
  }, [roles, hasLearnerAccess]);

  // ================= NOTIFICATIONS =================
  useEffect(() => {
    let timer: any;

    async function fetchNotifications() {
      if (!isAuthenticated) return;

      try {
        const result = await navbarService.fetchNotifications({});
        setNotifications(ensureArray(result?.notificationItems));
        setMessengerUnreadCount(result?.messengerUnreadCount || 0);
      } catch (err) {
        console.warn(err);
      }

      timer = setTimeout(fetchNotifications, NOTIF_POLL_INTERVAL);
    }

    fetchNotifications();
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // ================= HELPERS =================
  const handleNav = (path: string) => navigate(path);

  const toggleTheme = () => setMode(isDarkMode ? "light" : "dark");

  const avatarUrl = appUser?.avatar_url;
  const optimizedAvatar = getOptimizedProfileImageUrl(avatarUrl);
  const avatarSrcSet = buildProfileImageSrcSet(avatarUrl);

  // ================= RENDER =================
  return (
    <nav className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-2">
        {/* LOGO */}
        <Link to="/" className="flex items-center gap-2">
          <img src={systemLogo} className="h-8" />
          <span className="font-semibold hidden sm:block">
            Murekefu Music Hub
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <div className="hidden lg:flex items-center gap-2">
          {primaryNav.map((item) => (
            <Button
              key={item.path}
              variant={location.pathname === item.path ? "default" : "ghost"}
              className="px-4 py-2"
              onClick={() => handleNav(item.path)}
            >
              {item.label}
            </Button>
          ))}

          {/* MORE MENU */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost">
                More <ChevronDown className="ml-1 size-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              {secondaryNav.map((item) => (
                <DropdownMenuItem
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                >
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* DASHBOARD MENU */}
          {isAuthenticated && dashboardPaths.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">
                  Dashboard <ChevronDown className="ml-1 size-4" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent>
                {dashboardPaths.map((d, i) => (
                  <DropdownMenuItem key={i} onClick={() => handleNav(d.path)}>
                    {d.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2">
          {/* MOBILE MENU */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden">
                <PanelTopOpen />
              </Button>
            </SheetTrigger>

            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-2">
                {[...primaryNav, ...secondaryNav].map((item) => (
                  <Button
                    key={item.path}
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => handleNav(item.path)}
                  >
                    {item.label}
                  </Button>
                ))}

                {isAuthenticated && (
                  <>
                    <div className="pt-4 text-xs text-muted-foreground">
                      Dashboard
                    </div>
                    {dashboardPaths.map((d, i) => (
                      <Button
                        key={i}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleNav(d.path)}
                      >
                        {d.label}
                      </Button>
                    ))}
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>

          {/* THEME */}
          <Button variant="outline" size="icon" onClick={toggleTheme}>
            {isDarkMode ? <Sun /> : <Moon />}
          </Button>

          {/* MESSENGER */}
          {isAuthenticated && (
            <Button variant="outline" asChild className="relative">
              <Link to="/messenger">
                <MessageSquare />
                {messengerUnreadCount > 0 && (
                  <Badge className="absolute -top-2 -right-2">
                    {messengerUnreadCount}
                  </Badge>
                )}
              </Link>
            </Button>
          )}

          {/* NOTIFICATIONS */}
          {isAuthenticated && (
            <Button variant="outline" size="icon" className="relative">
              <Bell />
              {notifications.length > 0 && (
                <Badge className="absolute -top-2 -right-2">
                  {notifications.length}
                </Badge>
              )}
            </Button>
          )}

          {/* USER MENU */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                {optimizedAvatar ? (
                  <img
                    src={optimizedAvatar}
                    srcSet={avatarSrcSet}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <User />
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end">
              {isAuthenticated ? (
                <>
                  <DropdownMenuItem onClick={() => navigate("/manage-account")}>
                    <Settings className="mr-2 size-4" />
                    Manage Account
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 size-4" />
                    Logout
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() =>
                    navigate(buildLoginPath({ nextPath: location.pathname }))
                  }
                >
                  <User className="mr-2 size-4" />
                  Sign In
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
