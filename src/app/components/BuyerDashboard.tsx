import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ArrowRight,
  Calendar,
  CreditCard,
  Download,
  Grid3x3,
  List,
  Loader,
  Music,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Separator } from "@/app/components/ui/separator";
import { DashboardShell } from "@/app/components/DashboardShell";
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

export function BuyerDashboard({ cart, onRemoveFromCart }: BuyerDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { appUser, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "checkout" ? "checkout" : "library",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<
    "recent" | "oldest" | "title" | "composer" | "price-low" | "price-high"
  >("recent");
  const [loading, setLoading] = useState(true);
  const [purchasedCompositions, setPurchasedCompositions] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<
    string | null
  >(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<
    "all" | "compositions" | "arrangements"
  >(
    "all",
  );
  const [librarySearch, setLibrarySearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 768px)").matches) {
      setViewMode("list");
    }
  }, []);

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

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const memberSince = useMemo(() => {
    const timestamps = purchasedCompositions
      .map((purchase) => {
        const raw =
          purchase?.purchased_at ||
          purchase?.created_at ||
          purchase?.createdAt;
        const ts = raw ? new Date(raw).getTime() : NaN;
        return Number.isFinite(ts) ? ts : null;
      })
      .filter((value): value is number => value !== null);

    if (timestamps.length === 0) return null;
    return new Date(Math.min(...timestamps));
  }, [purchasedCompositions]);

  const filteredPurchases = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return purchasedCompositions.filter((purchase) => {
      const composition = purchase?.composition;
      const title = composition?.title || "";
      const composer =
        composition?.composerName ||
        composition?.composer_name ||
        composition?.composers?.users?.display_name ||
        "";
      const haystack = `${title} ${composer}`.toLowerCase();
      if (query && !haystack.includes(query)) return false;

      if (libraryFilter === "all") return true;
      const categoryName = String(
        composition?.categories?.name ||
          composition?.category_name ||
          composition?.categoryName ||
          "",
      ).toLowerCase();
      if (libraryFilter === "compositions") {
        return !categoryName.includes("arrange");
      }
      if (libraryFilter === "arrangements") {
        return categoryName.includes("arrange");
      }
      return true;
    });
  }, [libraryFilter, librarySearch, purchasedCompositions]);

  const sortedFilteredPurchases = useMemo(() => {
    const rows = [...filteredPurchases];
    const resolvePurchasedAt = (purchase: any) =>
      new Date(
        purchase?.purchased_at || purchase?.created_at || purchase?.createdAt || 0,
      ).getTime();
    const resolveTitle = (purchase: any) =>
      String(purchase?.composition?.title || "Untitled");
    const resolveComposer = (purchase: any) =>
      String(
        purchase?.composition?.composerName ||
          purchase?.composition?.composer_name ||
          purchase?.composition?.composers?.users?.display_name ||
          "Unknown",
      );
    const resolvePrice = (purchase: any) =>
      Number(purchase?.price_paid || purchase?.composition?.price || 0);

    switch (sortMode) {
      case "oldest":
        return rows.sort((a, b) => resolvePurchasedAt(a) - resolvePurchasedAt(b));
      case "title":
        return rows.sort((a, b) => resolveTitle(a).localeCompare(resolveTitle(b)));
      case "composer":
        return rows.sort((a, b) =>
          resolveComposer(a).localeCompare(resolveComposer(b)),
        );
      case "price-low":
        return rows.sort((a, b) => resolvePrice(a) - resolvePrice(b));
      case "price-high":
        return rows.sort((a, b) => resolvePrice(b) - resolvePrice(a));
      case "recent":
      default:
        return rows.sort((a, b) => resolvePurchasedAt(b) - resolvePurchasedAt(a));
    }
  }, [filteredPurchases, sortMode]);

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

  const dashboardTitle =
    activeTab === "checkout" ? "Shopping Cart" : "My Library";
  const dashboardDescription =
    activeTab === "checkout"
      ? "Review items waiting for checkout."
      : "Keep track of your purchases and downloads.";
  const activeNavId = activeTab === "checkout" ? "checkout" : "library";

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950/30 via-background to-background text-foreground">
      <DashboardShell
        title={dashboardTitle}
        description={dashboardDescription}
        activeNavId={activeNavId}
        navItems={[
          {
            id: "library",
            label: "Library",
            path: "/buyer",
            icon: Music,
          },
          {
            id: "checkout",
            label: `Cart ${cart.length > 0 ? `(${cart.length})` : ""}`.trim(),
            path: "/buyer?tab=checkout",
            icon: ShoppingBag,
          },
          {
            id: "marketplace",
            label: "Marketplace",
            path: "/marketplace",
            icon: ArrowRight,
          },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/marketplace")}>
            Browse Marketplace
          </Button>
        }
      >
        {activeTab === "library" && (
          <div className="space-y-6">
            <div className="max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search your library..."
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  className="h-10 border-white/15 bg-white/10 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
                />
                {librarySearch ? (
                  <button
                    type="button"
                    onClick={() => setLibrarySearch("")}
                    className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={libraryFilter === "all" ? "default" : "outline"}
                onClick={() => setLibraryFilter("all")}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={libraryFilter === "compositions" ? "default" : "outline"}
                onClick={() => setLibraryFilter("compositions")}
              >
                Compositions
              </Button>
              <Button
                size="sm"
                variant={libraryFilter === "arrangements" ? "default" : "outline"}
                onClick={() => setLibraryFilter("arrangements")}
              >
                Arrangements
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Recent Purchases</h2>
                <p className="text-sm text-muted-foreground">
                  {sortedFilteredPurchases.length} item
                  {sortedFilteredPurchases.length === 1 ? "" : "s"} in view
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
                  <SelectTrigger className="h-9 w-[170px] border-white/15 bg-white/10 text-foreground">
                    <SelectValue placeholder="Sort library" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="title">Title A-Z</SelectItem>
                    <SelectItem value="composer">Composer A-Z</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={`text-foreground hover:bg-white/10 ${
                    viewMode === "list" ? "bg-white/15" : ""
                  }`}
                >
                  <List className="size-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={`text-foreground hover:bg-white/10 ${
                    viewMode === "grid" ? "bg-white/15" : ""
                  }`}
                >
                  <Grid3x3 className="size-5" />
                </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader className="size-12 animate-spin text-muted-foreground" />
              </div>
            ) : sortedFilteredPurchases.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <Music className="mx-auto mb-4 size-16 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-semibold">
                    Your library is empty
                  </h3>
                  <p className="mb-6 text-muted-foreground">
                    Start building your collection of beautiful compositions
                  </p>
                  <Button
                    className="gap-2"
                    onClick={() => navigate("/marketplace")}
                  >
                    Browse Marketplace
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {sortedFilteredPurchases.map(
                  ({ composition, purchased_at, created_at, id }) => {
                    const title = composition?.title || "Untitled";
                    const composer =
                      composition?.composerName ||
                      composition?.composer_name ||
                      composition?.composers?.users?.display_name ||
                      "Unknown";
                    const voiceParts =
                      composition?.voiceParts ||
                      composition?.voice_parts ||
                      [];
                    const thumb =
                      composition?.thumbnail_url || composition?.thumbnailUrl;
                    const purchasedAt = purchased_at || created_at;

                    return (
                      <div
                        key={id}
                        className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                        onMouseEnter={() => setHoveredCard(id)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        <div className="relative mb-4 aspect-square overflow-hidden rounded-md shadow-xl">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={title}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600">
                              <Music className="size-16 text-white/90" />
                            </div>
                          )}

                          <div
                            className={`absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity ${
                              hoveredCard === id ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            <Button
                              size="icon"
                              className="h-11 w-11 rounded-full bg-emerald-500 shadow-2xl transition-all hover:scale-110 hover:bg-emerald-400"
                              onClick={() => void handleDownloadComposition(id)}
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
                            {title}
                          </h3>
                          <p className="truncate text-sm text-muted-foreground">
                            {composer}
                          </p>
                          {Array.isArray(voiceParts) && voiceParts.length > 0 && (
                            <p className="truncate text-xs text-muted-foreground/80">
                              {voiceParts.join(", ")}
                            </p>
                          )}
                          {purchasedAt ? (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                              <Calendar className="size-3" />
                              <span>
                                {new Date(purchasedAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {sortedFilteredPurchases.map(({ composition, purchased_at, created_at, id }) => {
                  const title = composition?.title || "Untitled";
                  const composer =
                    composition?.composerName ||
                    composition?.composer_name ||
                    composition?.composers?.users?.display_name ||
                    "Unknown";
                  const voiceParts =
                    composition?.voiceParts || composition?.voice_parts || [];
                  const thumb =
                    composition?.thumbnail_url || composition?.thumbnailUrl;
                  const purchasedAt = purchased_at || created_at;

                  return (
                    <div
                      key={id}
                      className="group flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 p-2 transition-colors hover:bg-white/10"
                      onClick={() => void handleDownloadComposition(id)}
                    >
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md shadow-lg">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600">
                            <Music className="size-6 text-white" />
                          </div>
                        )}
                      </div>
                        <div className="flex-1 min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {title}
                        </h3>
                        <p className="truncate text-sm text-muted-foreground">
                          {composer}
                        </p>
                        {Array.isArray(voiceParts) && voiceParts.length > 0 && (
                          <p className="truncate text-xs text-muted-foreground/80">
                            {voiceParts.join(", ")}
                          </p>
                        )}
                      </div>
                      {purchasedAt ? (
                        <span className="hidden text-xs text-muted-foreground/80 md:block">
                          {new Date(purchasedAt).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground/70 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                        disabled={downloadingPurchaseId === id}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDownloadComposition(id);
                        }}
                      >
                        {downloadingPurchaseId === id ? (
                          <Loader className="size-5 animate-spin" />
                        ) : (
                          <Download className="size-5" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-purple-600/15 to-pink-600/15 p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Your Stats
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-2xl font-bold">
                    {purchasedCompositions.length}
                  </div>
                  <p className="text-sm text-muted-foreground">Compositions</p>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {formatKesAmount(totalSpent)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-2xl font-bold">
                    {memberSince
                      ? memberSince.toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })
                      : "--"}
                  </div>
                  <p className="text-sm text-muted-foreground">Member Since</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "checkout" && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Shopping Cart</h2>

            {cart.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-8">
                <div className="text-center">
                  <ShoppingBag className="mx-auto mb-4 size-16 text-muted-foreground" />
                  <h3 className="mb-2 text-xl font-semibold">
                    Your cart is empty
                  </h3>
                  <p className="mb-6 text-muted-foreground">
                    Add compositions to get started
                  </p>
                  <Button
                    className="gap-2"
                    onClick={() => navigate("/marketplace")}
                  >
                    Browse Marketplace
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  {cart.map((item) => (
                    <div
                      key={item.composition.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10"
                    >
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                        <Music className="size-8 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate font-semibold text-foreground">
                          {item.composition.title}
                        </h4>
                        <p className="truncate text-sm text-muted-foreground">
                          {item.composition.composerName}
                        </p>
                        {Array.isArray(item.composition.voiceParts) &&
                          item.composition.voiceParts.length > 0 && (
                            <p className="mt-1 truncate text-xs text-muted-foreground/80">
                              {item.composition.voiceParts.join(", ")}
                            </p>
                          )}
                        <p className="mt-2 text-base font-bold text-foreground">
                          {formatKesAmount(item.composition.price)}
                        </p>
                      </div>
                      {onRemoveFromCart && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.composition.id)}
                          className="text-foreground/70 hover:bg-white/10 hover:text-foreground"
                        >
                          <Trash2 className="mr-1 size-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="lg:sticky lg:top-24 lg:self-start">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h3 className="mb-3 text-base font-semibold">Order Summary</h3>
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
                        <span className="text-muted-foreground">Processing Fee</span>
                        <span className="font-medium text-emerald-400">
                          FREE
                        </span>
                      </div>
                      <Separator className="bg-white/10" />
                      <div className="flex justify-between text-base font-bold">
                        <span>Total</span>
                        <span>{formatKesAmount(cartTotal)}</span>
                      </div>
                    </div>

                    <Button
                      className="mt-5 w-full bg-emerald-500 text-white hover:bg-emerald-400"
                      size="sm"
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                    >
                      <CreditCard className="mr-2 size-5" />
                      Proceed to Checkout
                    </Button>

                    <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Secure checkout</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Instant download</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>Lifetime access</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DashboardShell>
    </main>
  );
}

export default BuyerDashboard;
