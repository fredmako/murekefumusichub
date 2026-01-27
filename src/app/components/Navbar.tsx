import {
  Music,
  ShoppingCart,
  LayoutDashboard,
  User as UserIcon,
  Settings,
  LogOut
} from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet";

import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { CartItem } from "@/app/types";
interface NavbarProps {
  cart: CartItem[];
  onRemoveFromCart: (compositionId: string) => void;
}

export function Navbar({ cart, onRemoveFromCart }: NavbarProps) {
  const { firebaseUser, appUser, signOut } = useAuth();
  const navigate = useNavigate();

  const roles = appUser?.roles ?? [];

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0
  );

  return (
    <nav className="bg-white shadow-md border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
              <Music className="size-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Prime Media
              </h1>
              <p className="text-xs text-gray-500">Choral Music Marketplace</p>
            </div>
          </Link>

          {/* Main Navigation */}
          <div className="hidden md:flex items-center gap-3">
            <NavLink to="/">
              {({ isActive }) => (
                <Button variant={isActive ? "default" : "ghost"}>
                  <Music className="size-4 mr-2" />
                  Learn Music
                </Button>
              )}
            </NavLink>

            <NavLink to="/marketplace">
              {({ isActive }) => (
                <Button variant={isActive ? "default" : "ghost"}>
                  Marketplace
                </Button>
              )}
            </NavLink>

            {roles.includes("buyer") && (
              <NavLink to="/buyer">
                {({ isActive }) => (
                  <Button variant={isActive ? "default" : "ghost"}>
                    <LayoutDashboard className="size-4 mr-2" />
                    My Library
                  </Button>
                )}
              </NavLink>
            )}

            {roles.includes("composer") && (
              <NavLink to="/composer">
                {({ isActive }) => (
                  <Button variant={isActive ? "default" : "ghost"}>
                    <LayoutDashboard className="size-4 mr-2" />
                    My Compositions
                  </Button>
                )}
              </NavLink>
            )}

            {roles.includes("admin") && (
              <NavLink to="/admin">
                {({ isActive }) => (
                  <Button variant={isActive ? "default" : "ghost"}>
                    <Settings className="size-4 mr-2" />
                    Admin
                  </Button>
                )}
              </NavLink>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Cart */}
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
                  {cart.map(item => (
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
                        onClick={() =>
                          onRemoveFromCart(item.composition.id)
                        }
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
                        {firebaseUser.displayName ??
                          firebaseUser.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {roles.join(", ") || "user"}
                      </p>
                    </DropdownMenuLabel>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => navigate("/dashboard")}>
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
                    Sign in
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