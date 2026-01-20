import { useState } from 'react';
import { Download, Calendar, DollarSign, Music, CreditCard, ShoppingBag } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Separator } from '@/app/components/ui/separator';
import { mockCompositions, mockPurchases } from '@/app/data/mockData';
import { User, CartItem } from '@/app/App';
import { toast } from 'sonner';

interface BuyerDashboardProps {
  currentUser: User;
  cart: CartItem[];
  onClearCart: () => void;
}

export function BuyerDashboard({ currentUser, cart, onClearCart }: BuyerDashboardProps) {
  const [activeTab, setActiveTab] = useState('library');

  // Get user's purchases
  const userPurchases = mockPurchases.filter(p => p.buyerId === currentUser.id);

  const purchasedCompositions = userPurchases.map(purchase => {
    const composition = mockCompositions.find(c => c.id === purchase.compositionId);
    return {
      ...purchase,
      composition
    };
  });

  const totalSpent = userPurchases.reduce((sum, p) => sum + p.price, 0);

  // Cart calculations
  const cartTotal = cart.reduce((sum, item) => sum + item.composition.price * item.quantity, 0);

  const handleCheckout = () => {
    toast.success('Purchase successful! Your compositions are now in your library.');
    onClearCart();
    setActiveTab('library');
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
        <p className="text-gray-600">Access your purchased music and manage your account</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">My Library</CardTitle>
            <Music className="size-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{purchasedCompositions.length}</div>
            <p className="text-xs text-gray-500 mt-1">Compositions owned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Spent</CardTitle>
            <DollarSign className="size-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalSpent.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">All-time purchases</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cart Items</CardTitle>
            <ShoppingBag className="size-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{cart.length}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to checkout</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="library">My Library</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
        </TabsList>

        {/* Library Tab */}
        <TabsContent value="library" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchased Compositions</CardTitle>
              <CardDescription>Download and access your purchased music anytime</CardDescription>
            </CardHeader>
            <CardContent>
              {purchasedCompositions.length === 0 ? (
                <div className="text-center py-12">
                  <Music className="size-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">You haven't purchased any compositions yet.</p>
                  <Button onClick={() => window.location.reload()}>
                    Browse Marketplace
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Composition</TableHead>
                      <TableHead>Composer</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasedCompositions.map(({ composition, purchaseDate, price, id }) => (
                      <TableRow key={id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{composition?.title}</p>
                            <p className="text-sm text-gray-500">
                              {composition?.voiceParts.join(', ')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{composition?.composerName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-gray-400" />
                            {new Date(purchaseDate).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>${price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">
                            <Download className="size-4 mr-2" />
                            Download PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checkout Tab */}
        <TabsContent value="checkout" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Shopping Cart</CardTitle>
                  <CardDescription>Review your items before checkout</CardDescription>
                </CardHeader>
                <CardContent>
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingBag className="size-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Your cart is empty</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {cart.map(item => (
                        <div key={item.composition.id} className="flex items-start gap-4 p-4 border rounded-lg">
                          <Music className="size-10 text-blue-600" />
                          <div className="flex-1">
                            <h4 className="font-medium">{item.composition.title}</h4>
                            <p className="text-sm text-gray-600">{item.composition.composerName}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              {item.composition.voiceParts.join(', ')} • {item.composition.difficulty}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg">${item.composition.price.toFixed(2)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Processing Fee</span>
                      <span>$0.00</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold text-lg">
                      <span>Total</span>
                      <span>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={handleCheckout}
                  >
                    <CreditCard className="size-5 mr-2" />
                    Complete Purchase
                  </Button>

                  <div className="text-xs text-gray-500 text-center mt-4">
                    Secure checkout • Instant download • Lifetime access
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
