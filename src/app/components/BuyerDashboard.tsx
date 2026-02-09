import { useEffect, useState } from 'react';
import { Download, Calendar, DollarSign, Music, CreditCard, ShoppingBag, Loader, Trash2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { User, CartItem } from '@/app/App';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { auth } from '@/lib/firebase';

interface BuyerDashboardProps {
  currentUser: User;
  cart: CartItem[];
  onClearCart: () => void;
  onRemoveFromCart?: (compositionId: string) => void;
}

export function BuyerDashboard({ currentUser, cart, onClearCart, onRemoveFromCart }: BuyerDashboardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('library');
  const [loading, setLoading] = useState(true);
  const [purchasedCompositions, setPurchasedCompositions] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    const fetchUserPurchases = async () => {
      try {
        setLoading(true);
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          toast.error('You must be signed in to view purchases');
          setLoading(false);
          return;
        }

        // Resolve supabase users.id from firebase_uid
        const { data: sbUser } = await supabase
          .from('users')
          .select('id')
          .eq('firebase_uid', firebaseUser.uid)
          .single();

        if (!sbUser) {
          setPurchasedCompositions([]);
          setTotalSpent(0);
          setLoading(false);
          return;
        }

        // Fetch purchases with composition details
        const { data: purchases, error: purchasesError } = await supabase
          .from('purchases')
          .select(`*, compositions(*)`)
          .eq('buyer_id', sbUser.id)
          .eq('is_active', true)
          .order('purchased_at', { ascending: false });

        if (purchasesError) throw purchasesError;

        const enriched = (purchases || []).map((p: any) => ({
          ...p,
          composition: p.compositions || p.composition || null,
        }));

        setPurchasedCompositions(enriched);
        const spent = (purchases || []).reduce((sum: number, p: any) => sum + (p.price_paid || 0), 0);
        setTotalSpent(spent);
      } catch (err) {
        console.error('Error loading purchases:', err);
        toast.error('Failed to load purchases');
      } finally {
        setLoading(false);
      }
    };

    fetchUserPurchases();
  }, []);

  // Cart calculations
  const cartTotal = cart.reduce((sum, item) => sum + item.composition.price * item.quantity, 0);

  const handleCheckout = () => {
    toast.success('Purchase successful! Your compositions are now in your library.');
    onClearCart();
    setActiveTab('library');
  };

  const handleRemoveItem = (compositionId: string) => {
    if (onRemoveFromCart) {
      onRemoveFromCart(compositionId);
      toast.success('Item removed from cart');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            My Dashboard
          </h1>
          <p className="text-gray-600">Access your purchased music and manage your account</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-blue-50">My Library</CardTitle>
              <Music className="size-5 text-blue-100" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{loading ? '...' : purchasedCompositions.length}</div>
              <p className="text-xs text-blue-100 mt-1">Compositions owned</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-green-50">Total Spent</CardTitle>
              <DollarSign className="size-5 text-green-100" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">${loading ? '...' : totalSpent.toFixed(2)}</div>
              <p className="text-xs text-green-100 mt-1">All-time purchases</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-50">Cart Items</CardTitle>
              <ShoppingBag className="size-5 text-purple-100" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{cart.length}</div>
              <p className="text-xs text-purple-100 mt-1">Ready to checkout</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white shadow-md">
            <TabsTrigger value="library" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              My Library
            </TabsTrigger>
            <TabsTrigger value="checkout" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Checkout {cart.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">{cart.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library" className="mt-6">
            <Card className="border-0 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                <CardTitle className="text-2xl">Purchased Compositions</CardTitle>
                <CardDescription>Download and access your purchased music anytime</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="text-center py-12">
                    <Loader className="size-12 text-blue-600 mx-auto mb-4 animate-spin" />
                    <p className="text-gray-500">Loading your library...</p>
                  </div>
                ) : purchasedCompositions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-blue-100 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                      <Music className="size-12 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Your library is empty</h3>
                    <p className="text-gray-500 mb-6">Start building your collection of beautiful compositions</p>
                    <Button 
                      onClick={() => navigate('/marketplace')}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    >
                      Browse Marketplace
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="font-semibold">Composition</TableHead>
                          <TableHead className="font-semibold">Composer</TableHead>
                          <TableHead className="font-semibold">Purchase Date</TableHead>
                          <TableHead className="font-semibold">Price</TableHead>
                          <TableHead className="text-right font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasedCompositions.map(({ composition, purchased_at, price_paid, id }) => (
                          <TableRow key={id} className="hover:bg-blue-50 transition-colors">
                            <TableCell>
                              <div>
                                <p className="font-semibold text-gray-900">{composition?.title || 'Untitled'}</p>
                                <p className="text-sm text-gray-500">
                                  {composition?.voiceParts?.join(', ') || 'N/A'}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-700">{composition?.composerName || 'Unknown'}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="size-4 text-gray-400" />
                                <span className="text-gray-700">
                                  {new Date(purchased_at).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">
                              ${(price_paid || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                              >
                                <Download className="size-4 mr-2" />
                                Download
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Checkout Tab */}
          <TabsContent value="checkout" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b">
                    <CardTitle className="text-2xl">Shopping Cart</CardTitle>
                    <CardDescription>Review your items before checkout</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {cart.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="bg-purple-100 rounded-full p-6 w-24 h-24 mx-auto mb-4 flex items-center justify-center">
                          <ShoppingBag className="size-12 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
                        <p className="text-gray-500 mb-6">Add compositions to get started</p>
                        <Button 
                          onClick={() => navigate('/marketplace')}
                          variant="outline"
                          className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white"
                        >
                          Browse Marketplace
                          <ArrowRight className="size-4 ml-2" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map(item => (
                          <div key={item.composition.id} className="flex items-start gap-4 p-4 border-2 rounded-xl hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white">
                            <div className="bg-blue-100 rounded-lg p-3">
                              <Music className="size-8 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-lg text-gray-900">{item.composition.title}</h4>
                              <p className="text-sm text-gray-600 font-medium">{item.composition.composerName}</p>
                              <p className="text-sm text-gray-500 mt-1">
                                {item.composition.voiceParts.join(', ')} • {item.composition.difficulty}
                              </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-2">
                              <p className="font-bold text-xl text-green-600">${item.composition.price.toFixed(2)}</p>
                              {onRemoveFromCart && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveItem(item.composition.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="size-4 mr-1" />
                                  Remove
                                </Button>
                              )}
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
                <Card className="border-0 shadow-lg sticky top-6">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 border-b">
                    <CardTitle className="text-2xl">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})</span>
                        <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Processing Fee</span>
                        <span className="font-semibold text-green-600">FREE</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-xl">
                        <span>Total</span>
                        <span className="text-green-600">${cartTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-lg"
                      size="lg"
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                    >
                      <CreditCard className="size-5 mr-2" />
                      Complete Purchase
                    </Button>

                    <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Secure checkout</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Instant download</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Lifetime access</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
