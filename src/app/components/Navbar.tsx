import { Music, ShoppingCart, LayoutDashboard, User as UserIcon, Settings, LogOut } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';
import { User, UserRole, CartItem } from '@/app/App';

interface NavbarProps {
  currentUser: User;
  currentView: 'marketplace' | 'composer' | 'buyer' | 'admin' | 'learning';
  onViewChange: (view: 'marketplace' | 'composer' | 'buyer' | 'admin' | 'learning') => void;
  onRoleChange: (role: UserRole) => void;
  onLogout: () => void;
  cart: CartItem[];
  onRemoveFromCart: (compositionId: string) => void;
}

export function Navbar({
  currentUser,
  currentView,
  onViewChange,
  onRoleChange,
  onLogout,
  cart,
  onRemoveFromCart
}: NavbarProps) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.composition.price * item.quantity, 0);

  return (
    <nav className="bg-white shadow-md border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-lg">
              <Music className="size-6 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Prime Media</h1>
              <p className="text-xs text-gray-500">Choral Music Marketplace</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-4">
            <Button
              variant={currentView === 'marketplace' ? 'default' : 'ghost'}
              onClick={() => onViewChange('marketplace')}
            >
              Marketplace
            </Button>

            <Button
              variant={currentView === 'learning' ? 'default' : 'ghost'}
              onClick={() => onViewChange('learning')}
            >
              <Music className="size-4 mr-2" />
              Learn Music
            </Button>

            {currentUser.role === 'composer' && (
              <Button
                variant={currentView === 'composer' ? 'default' : 'ghost'}
                onClick={() => onViewChange('composer')}
              >
                <LayoutDashboard className="size-4 mr-2" />
                My Compositions
              </Button>
            )}

            {currentUser.role === 'buyer' && (
              <Button
                variant={currentView === 'buyer' ? 'default' : 'ghost'}
                onClick={() => onViewChange('buyer')}
              >
                <LayoutDashboard className="size-4 mr-2" />
                My Library
              </Button>
            )}

            {currentUser.role === 'admin' && (
              <Button
                variant={currentView === 'admin' ? 'default' : 'ghost'}
                onClick={() => onViewChange('admin')}
              >
                <Settings className="size-4 mr-2" />
                Admin Panel
              </Button>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Shopping Cart */}
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
                    {totalItems === 0 ? 'Your cart is empty' : `${totalItems} item(s) in cart`}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {cart.map(item => (
                    <div key={item.composition.id} className="flex items-start justify-between border-b pb-4">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.composition.title}</h4>
                        <p className="text-sm text-gray-500">{item.composition.composerName}</p>
                        <p className="text-sm font-semibold mt-1">${item.composition.price.toFixed(2)}</p>
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
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-semibold">Total:</span>
                        <span className="text-xl font-bold">${totalPrice.toFixed(2)}</span>
                      </div>
                      <Button className="w-full" onClick={() => onViewChange('buyer')}>
                        Proceed to Checkout
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
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{currentUser.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-gray-500">
                  Switch Role (Demo)
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onRoleChange('buyer')}>
                  Switch to Buyer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRoleChange('composer')}>
                  Switch to Composer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRoleChange('admin')}>
                  Switch to Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-red-600">
                  <LogOut className="size-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
}