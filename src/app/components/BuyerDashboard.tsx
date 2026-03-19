import { useEffect, useMemo, useState } from "react";
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
  Search,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Separator } from "@/app/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { SupportIssueButton } from "@/app/components/SupportIssueButton";
import { toast } from "sonner";
import { purchaseService } from "@/services/api";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { formatKesAmount } from "@/lib/currency";
import { CartItem } from "../types";
import { ensureArray } from "@/lib/ensureArray";

interface BuyerDashboardProps {
  cart: CartItem[];
  onRemoveFromCart?: (compositionId: string) => void;
}

export function BuyerDashboard({
  cart,
  onRemoveFromCart,
}: BuyerDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { appUser, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "checkout" ? "checkout" : "library",
  );
  const [loading, setLoading] = useState(true);
  const [purchasedCompositions, setPurchasedCompositions] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<
    string | null
  >(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<
    "all" | "arrangements" | "compositions"
  >("all");

  useEffect(() => {
    const requestedTab =
      searchParams.get("tab") === "checkout" ? "checkout" : "library";
    setActiveTab((prev) => (prev === requestedTab ? prev : requestedTab));
  }, [searchParams]);

  useEffect(() => {
    if (isAuthLoading) {
      setLoading(true);
      return;
    }

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
        const purchasesPayload = await purchaseService.getByBuyer(appUser.id);
        const purchases = ensureArray<any>(purchasesPayload, ["purchases"]);
        if (!mounted) return;

        const enriched = purchases.map((p: any) => ({
          ...p,
          composition: p.compositions || p.composition || null,
        }));

        setPurchasedCompositions(enriched);
        const spent = purchases.reduce(
          (sum: number, p: any) => sum + (p.price_paid || 0),
          0,
        );
        setTotalSpent(spent);
      } catch (err: any) {
        const status = Number(err?.status || 0);
        if (status === 401) {
          console.warn("Purchases request blocked by expired session");
          return;
        }

        if (status === 503 || status === 408) {
          console.warn(
            "Purchases request failed due to transient auth/network issue",
          );
          if (showSpinner) {
            toast.warning(
              "Connection issue while loading your library. Retrying in the background...",
            );
          }
          return;
        }

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
  }, [appUser?.id, isAuthLoading]);

  // Redirect to home if user logs out
  useEffect(() => {
    if (!isAuthLoading && appUser === null) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [
    appUser,
    isAuthLoading,
    location.hash,
    location.pathname,
    location.search,
    navigate,
  ]);

  // Cart calculations
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const filteredLibrary = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    if (!purchasedCompositions.length) return [];

    return purchasedCompositions.filter((entry) => {
      const composition = entry?.composition;
      const title = composition?.title || "";
      const composer =
        composition?.composerName || composition?.composer_name || "";
      const haystack = `${title} ${composer}`.toLowerCase();

      if (query && !haystack.includes(query)) return false;
      if (libraryFilter === "all") return true;

      const categoryName = (
        composition?.categories?.name ??
        composition?.category_name ??
        composition?.categoryName ??
        ""
      )
        .toString()
        .toLowerCase();
      const isArrangement = categoryName.includes("arrange");

      if (libraryFilter === "arrangements") return isArrangement;
      if (libraryFilter === "compositions") return !isArrangement;
      return true;
    });
  }, [librarySearch, libraryFilter, purchasedCompositions]);

  const isLibraryFiltered =
    librarySearch.trim().length > 0 || libraryFilter !== "all";

  const handleCheckout = () => {
    if (!appUser) {
      persistPostLoginRedirect("/checkout");
      navigate(buildLoginPath({ nextPath: "/checkout", intent: "purchase" }));
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
        err?.message ||
        "Could not start the composition download. Please try again.";
      toast.error(message);
    } finally {
      setDownloadingPurchaseId(null);
    }
  };

  const libraryFilters = [
    { id: "all", label: "All" },
    { id: "arrangements", label: "Arrangements" },
    { id: "compositions", label: "Compositions" },
  ] as const;

  return (
    <main className="min-h-screen bg-background py-8">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              My Library
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Access your purchased music and manage your collection
            </p>
          </div>
          <SupportIssueButton context="buyer-dashboard" />
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activeTab === "library" ? "default" : "secondary"}
            onClick={() => handleTabChange("library")}
            className="h-9 rounded-full px-4 text-sm"
          >
            <Music className="mr-2 size-4" />
            Library
            <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {loading ? "..." : purchasedCompositions.length}
            </span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleTabChange("library")}
            className="h-9 rounded-full px-4 text-sm"
          >
            <DollarSign className="mr-2 size-4" />
            {loading ? "..." : formatKesAmount(totalSpent)}
          </Button>
          <Button
            variant={activeTab === "checkout" ? "default" : "secondary"}
            onClick={() => handleTabChange("checkout")}
            className="h-9 rounded-full px-4 text-sm"
          >
            <ShoppingBag className="mr-2 size-4" />
            Cart
            <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">
              {cart.length}
            </span>
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="inline-flex h-10 items-center justify-center rounded-full bg-muted p-1">
            <TabsTrigger
              value="library"
              className="rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Library
            </TabsTrigger>
            <TabsTrigger
              value="checkout"
              className="rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              Cart{" "}
              {cart.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {cart.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Library Tab */}
          <TabsContent value="library" className="mt-6">
            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <Loader className="mx-auto mb-4 size-12 animate-spin text-primary" />
                  <p className="text-muted-foreground">
                    Loading your library...
                  </p>
                </div>
              </div>
            ) : purchasedCompositions.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                    <Music className="size-12 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-2xl font-semibold">
                    Your library is empty
                  </h3>
                  <p className="mb-6 text-muted-foreground">
                    Start building your collection of beautiful compositions
                  </p>
                  <Button onClick={() => navigate("/marketplace")} size="lg">
                    Browse Marketplace
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold">Library</h2>
                    <p className="text-sm text-muted-foreground">
                      {isLibraryFiltered
                        ? `${filteredLibrary.length} of ${purchasedCompositions.length} compositions`
                        : `${purchasedCompositions.length} compositions`}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
                    <div className="relative w-full sm:w-72">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        value={librarySearch}
                        onChange={(event) =>
                          setLibrarySearch(event.target.value)
                        }
                        placeholder="Search your library..."
                        className="h-10 w-full rounded-full border border-border/60 bg-background/60 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      />
                      {librarySearch && (
                        <button
                          type="button"
                          onClick={() => setLibrarySearch("")}
                          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {libraryFilters.map((filter) => (
                        <Button
                          key={filter.id}
                          type="button"
                          variant="secondary"
                          onClick={() => setLibraryFilter(filter.id)}
                          className={`h-8 rounded-full px-3 text-xs ${
                            libraryFilter === filter.id
                              ? "bg-foreground text-background hover:bg-foreground/90"
                              : "bg-muted/60 text-foreground/80 hover:bg-muted"
                          }`}
                        >
                          {filter.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {filteredLibrary.length === 0 ? (
                  <div className="rounded-2xl border border-border/40 bg-card/40 p-10 text-center">
                    <h3 className="text-lg font-semibold text-foreground">
                      No compositions match your filters
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Try adjusting your search or clearing the filters.
                    </p>
                    {isLibraryFiltered && (
                      <Button
                        variant="outline"
                        className="mt-5"
                        onClick={() => {
                          setLibrarySearch("");
                          setLibraryFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {filteredLibrary.map((entry) => {
                      const { composition, purchased_at, id } = entry;
                      const coverUrl =
                        composition?.thumbnail_url || composition?.thumbnailUrl;

                      return (
                        <div
                          key={id}
                          className="group relative rounded-xl bg-card/50 p-3 transition-all hover:bg-card hover:shadow-lg"
                          onMouseEnter={() => setHoveredCard(id)}
                          onMouseLeave={() => setHoveredCard(null)}
                        >
                          <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-muted/50">
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt={composition?.title || "Composition cover"}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                                <Music className="size-12 text-emerald-600/60" />
                              </div>
                            )}

                            <div
                              className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                                hoveredCard === id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            >
                              <Button
                                size="icon"
                                className="h-11 w-11 rounded-full bg-primary shadow-xl transition-transform hover:scale-110"
                                onClick={() =>
                                  void handleDownloadComposition(id)
                                }
                                disabled={downloadingPurchaseId === id}
                              >
                                {downloadingPurchaseId === id ? (
                                  <Loader className="size-5 animate-spin" />
                                ) : (
                                  <Download className="size-5" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {composition?.title || "Untitled"}
                            </h3>
                            <p className="truncate text-xs text-muted-foreground">
                              {composition?.composerName || "Unknown"}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                              <Calendar className="size-3" />
                              <span>
                                {new Date(purchased_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Checkout Tab */}
          <TabsContent value="checkout" className="mt-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <Card className="border-border/40 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-2xl">Shopping Cart</CardTitle>
                    <CardDescription>
                      Review your items before checkout
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cart.length === 0 ? (
                      <div className="py-12 text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
                          <ShoppingBag className="size-12 text-muted-foreground" />
                        </div>
                        <h3 className="mb-2 text-xl font-semibold">
                          Your cart is empty
                        </h3>
                        <p className="mb-6 text-muted-foreground">
                          Add compositions to get started
                        </p>
                        <Button
                          onClick={() => navigate("/marketplace")}
                          variant="outline"
                        >
                          Browse Marketplace
                          <ArrowRight className="ml-2 size-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div
                            key={item.composition.id}
                            className="flex items-start gap-4 rounded-lg border border-border/60 bg-background/50 p-4 transition-all hover:border-primary/40 hover:bg-background"
                          >
                            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                              <Music className="size-8 text-emerald-600/60" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="truncate font-semibold text-foreground">
                                {item.composition.title}
                              </h4>
                              <p className="truncate text-sm text-muted-foreground">
                                {item.composition.composerName}
                              </p>
                              {/* Deliverables under the card in cart too */}
                              {Array.isArray(item.composition.voiceParts) &&
                                item.composition.voiceParts.length > 0 && (
                                  <p className="mt-1 truncate text-xs text-muted-foreground/70">
                                    {item.composition.voiceParts.join(", ")}
                                  </p>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <p className="text-lg font-bold text-foreground">
                                {formatKesAmount(item.composition.price)}
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
                                  <Trash2 className="mr-1 size-4" />
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
                <Card className="sticky top-6 border-border/40 bg-card/50">
                  <CardHeader>
                    <CardTitle className="text-xl">Order Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Subtotal ({cart.length}{" "}
                          {cart.length === 1 ? "item" : "items"})
                        </span>
                        <span className="font-medium">
                          {formatKesAmount(cartTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Processing Fee
                        </span>
                        <span className="font-medium text-emerald-600">
                          FREE
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">
                          {formatKesAmount(cartTotal)}
                        </span>
                      </div>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                    >
                      <CreditCard className="mr-2 size-5" />
                      Proceed to Checkout
                    </Button>

                    <div className="space-y-2 rounded-lg bg-muted/50 p-4">
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
