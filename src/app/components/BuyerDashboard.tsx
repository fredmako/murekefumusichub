import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Download,
  Calendar,
  DollarSign,
  Music,
  CreditCard,
  ShoppingBag,
  Loader,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Separator } from "@/app/components/ui/separator";
import { SupportIssueButton } from "@/app/components/SupportIssueButton";
import { toast } from "sonner";
import { purchaseService } from "@/services/api";
import { CartItem } from "../types";

interface BuyerDashboardProps {
  cart: CartItem[];
  onRemoveFromCart?: (compositionId: string) => void;
}

export function BuyerDashboard({
  cart,
  onRemoveFromCart,
}: BuyerDashboardProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { appUser } = useAuth();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "checkout" ? "checkout" : "library",
  );
  const [loading, setLoading] = useState(true);
  const [purchasedCompositions, setPurchasedCompositions] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    const requestedTab =
      searchParams.get("tab") === "checkout" ? "checkout" : "library";
    setActiveTab((prev) => (prev === requestedTab ? prev : requestedTab));
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;

    const fetchUserPurchases = async (showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        if (!appUser) {
          if (showSpinner) {
            toast.error("You must be signed in to view purchases");
            setLoading(false);
          }
          return;
        }

        // Fetch purchases via API (auth UID is resolved from token server-side)
        const purchases = (await purchaseService.getByBuyer(appUser.id)) as any[];
        if (!mounted) return;

        const enriched = (purchases || []).map((p: any) => ({
          ...p,
          composition: p.compositions || p.composition || null,
        }));

        setPurchasedCompositions(enriched);
        const spent = (purchases || []).reduce(
          (sum: number, p: any) => sum + (p.price_paid || 0),
          0,
        );
        setTotalSpent(spent);
      } catch (err) {
        console.error("Error loading purchases:", err);
        if (showSpinner) {
          toast.error("Failed to load purchases");
        }
      } finally {
        if (showSpinner && mounted) setLoading(false);
      }
    };

    void fetchUserPurchases(true);
    const timer = setInterval(() => {
      void fetchUserPurchases(false);
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [appUser?.id]);

  // Redirect to home if user logs out
  useEffect(() => {
    if (appUser === null) {
      navigate("/", { replace: true });
    }
  }, [appUser, navigate]);

  // Cart calculations
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const handleCheckout = () => {
    if (!appUser) {
      try {
        sessionStorage.setItem("post_login_redirect", "/checkout");
      } catch {
        // ignore storage failures
      }
      navigate("/login?next=%2Fcheckout&intent=purchase");
      return;
    }
    navigate("/checkout");
  };

  const handleRemoveItem = (compositionId: string) => {
    if (onRemoveFromCart) {
      onRemoveFromCart(compositionId);
      toast.success("Item removed from cart");
    }
  };

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);
    const next = new URLSearchParams(searchParams);
    if (nextTab === "checkout") {
      next.set("tab", "checkout");
    } else {
      next.delete("tab");
    }
    setSearchParams(next, { replace: true });
  };

  const handleDownloadComposition = async (purchaseId: string) => {
    if (!purchaseId) return;

    try {
      setDownloadingPurchaseId(purchaseId);
      const result = await purchaseService.getDownloadLink(purchaseId);
      const downloadUrl = result?.downloadUrl;
      const fileName = result?.fileName || "composition.pdf";

      if (!downloadUrl) {
        throw new Error("Download link is unavailable for this composition");
      }

      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      toast.success("Download started");
    } catch (err: any) {
      console.error("Failed to download composition:", err);
      const message =
        err?.message || "Could not start the composition download. Please try again.";
      toast.error(message);
    } finally {
      setDownloadingPurchaseId(null);
    }
  };
  return (
    <main className="texture-linen min-h-screen overflow-hidden py-12">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="texture-fabric texture-speckle motion-reveal overflow-hidden rounded-3xl border border-border/70 bg-card/80 shadow-[0_24px_44px_-30px_rgba(15,23,42,0.85)]">
          <div className="flex flex-col gap-5 p-6 sm:p-8 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="soft-kicker">Buyer Workspace</span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                My Library
              </h1>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Access purchased music, review checkout items, and download your files.
              </p>
            </div>
            <SupportIssueButton context="buyer-dashboard" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="texture-speckle lift-card border-0 bg-gradient-to-br from-[#0f766e] to-[#0b4a52] text-white shadow-[0_24px_40px_-34px_rgba(15,23,42,0.95)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-50">
                My Library
              </CardTitle>
              <Music className="size-5 text-emerald-100" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {loading ? "..." : purchasedCompositions.length}
              </div>
              <p className="text-xs text-emerald-100 mt-1">Compositions owned</p>
            </CardContent>
          </Card>

          <Card className="texture-speckle lift-card border-0 bg-gradient-to-br from-[#174f3b] to-[#1f7a59] text-white shadow-[0_24px_40px_-34px_rgba(15,23,42,0.95)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-emerald-50">
                Total Spent
              </CardTitle>
              <DollarSign className="size-5 text-emerald-100" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                ${loading ? "..." : totalSpent.toFixed(2)}
              </div>
              <p className="text-xs text-emerald-100 mt-1">All-time purchases</p>
            </CardContent>
          </Card>

          <Card className="texture-speckle lift-card border-0 bg-gradient-to-br from-[#7c4a03] to-[#b45309] text-white shadow-[0_24px_40px_-34px_rgba(15,23,42,0.95)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-amber-50">
                Cart Items
              </CardTitle>
              <ShoppingBag className="size-5 text-amber-100" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{cart.length}</div>
              <p className="text-xs text-amber-100 mt-1">Ready to checkout</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-xl border border-border/70 bg-card/85 p-1">
            <TabsTrigger
              value="library"
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              My Library
            </TabsTrigger>
            <TabsTrigger
              value="checkout"
              className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Checkout{" "}
              {cart.length > 0 && (
                <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
                  {cart.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library" className="mt-6">
            <Card className="lift-card texture-speckle border-border/70 bg-card/95">
              <CardHeader className="border-b border-border/70 bg-card/80">
                <CardTitle className="text-2xl">
                  Purchased Compositions
                </CardTitle>
                <CardDescription>
                  Download and access your purchased music anytime
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {loading ? (
                  <div className="text-center py-12">
                    <Loader className="mx-auto mb-4 size-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading your library...</p>
                  </div>
                ) : purchasedCompositions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                      <Music className="size-12 text-secondary-foreground" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      Your library is empty
                    </h3>
                    <p className="mb-6 text-muted-foreground">
                      Start building your collection of beautiful compositions
                    </p>
                    <Button onClick={() => navigate("/marketplace")}>
                      Browse Marketplace
                      <ArrowRight className="size-4 ml-2" />
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/55">
                          <TableHead className="font-semibold">
                            Composition
                          </TableHead>
                          <TableHead className="font-semibold">
                            Composer
                          </TableHead>
                          <TableHead className="font-semibold">
                            Purchase Date
                          </TableHead>
                          <TableHead className="font-semibold">Price</TableHead>
                          <TableHead className="text-right font-semibold">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasedCompositions.map(
                          ({ composition, purchased_at, price_paid, id }) => (
                            <TableRow
                              key={id}
                              className="transition-colors hover:bg-muted/50"
                            >
                              <TableCell>
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {composition?.title || "Untitled"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {composition?.voiceParts?.join(", ") ||
                                      "N/A"}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {composition?.composerName || "Unknown"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="size-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {new Date(purchased_at).toLocaleDateString(
                                      "en-US",
                                      {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      },
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="font-semibold text-primary">
                                ${(price_paid || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => void handleDownloadComposition(id)}
                                  disabled={downloadingPurchaseId === id}
                                  className="transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
                                >
                                  {downloadingPurchaseId === id ? (
                                    <Loader className="size-4 mr-2 animate-spin" />
                                  ) : (
                                    <Download className="size-4 mr-2" />
                                  )}
                                  {downloadingPurchaseId === id ? "Preparing..." : "Download"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ),
                        )}
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
                <Card className="lift-card texture-speckle border-border/70 bg-card/95">
                  <CardHeader className="border-b border-border/70 bg-card/80">
                    <CardTitle className="text-2xl">Shopping Cart</CardTitle>
                    <CardDescription>
                      Review your items before checkout
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {cart.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
                          <ShoppingBag className="size-12 text-secondary-foreground" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">
                          Your cart is empty
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                          Add compositions to get started
                        </p>
                        <Button
                          onClick={() => navigate("/marketplace")}
                          variant="outline"
                          className="hover:border-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          Browse Marketplace
                          <ArrowRight className="size-4 ml-2" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map((item) => (
                          <div
                            key={item.composition.id}
                            className="flex items-start gap-4 rounded-xl border border-border/80 bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                          >
                            <div className="rounded-lg bg-secondary p-3">
                              <Music className="size-8 text-secondary-foreground" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-lg font-semibold text-foreground">
                                {item.composition.title}
                              </h4>
                              <p className="text-sm font-medium text-muted-foreground">
                                {item.composition.composerName}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.composition.voiceParts.join(", ")} -{" "}
                                {item.composition.difficulty}
                              </p>
                            </div>
                            <div className="text-right flex flex-col items-end gap-2">
                              <p className="text-xl font-bold text-primary">
                                ${item.composition.price.toFixed(2)}
                              </p>
                              {onRemoveFromCart && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    handleRemoveItem(item.composition.id)
                                  }
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                <Card className="sticky top-6 lift-card texture-speckle border-border/70 bg-card/95">
                  <CardHeader className="border-b border-border/70 bg-card/80">
                    <CardTitle className="text-2xl">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Subtotal ({cart.length}{" "}
                          {cart.length === 1 ? "item" : "items"})
                        </span>
                        <span className="font-semibold">
                          ${cartTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Processing Fee</span>
                        <span className="font-semibold text-primary">
                          FREE
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-bold text-xl">
                        <span>Total</span>
                        <span className="text-primary">
                          ${cartTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                    >
                      <CreditCard className="size-5 mr-2" />
                      Proceed to Checkout
                    </Button>

                    <div className="space-y-2 rounded-lg border border-border/70 bg-muted/55 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
                        <span>Secure checkout</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
                        <span>Instant download</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
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
    </main>
  );
}
