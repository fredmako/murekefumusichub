// src/app/components/Navbar.tsx
import { useLocation, NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { CartItem } from "@/app/types";
import { Music, ShoppingCart, User as UserIcon, LogOut } from "lucide-react";
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
  cart?: CartItem[]; // optional to prevent errors
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

  const roles = appUser?.roles ?? [];

  // Navigation items
  const navItems = [
    {
      label: "Learn Music",
      path: "/",
      showOn: ["/"], // only landing page
      roles: [], // all users
    },
    {
      label: "About Us",
      path: "/about",
      showOn: ["/"], // landing page
      roles: [],
    },
    {
      label: "Music hub ",
      path: "/marketplace",
      showOn: ["any"], // everywhere
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

  // Determine dashboard path dynamically based on roles
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
          {/* Logo */}
          {/* Logo */}
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

          {/* Main Navigation */}
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

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Cart for buyers only */}
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

            {/* User Menu */}
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

                    {/* Redirect to the correct dashboard */}
                    <DropdownMenuItem
                      onClick={() => navigate(getDashboardPath())}
                    >
                      Dashboard
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
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
