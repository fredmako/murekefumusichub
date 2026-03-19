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
import { Separator } from "@/app/components/ui/separator";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { appUser, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") === "checkout" ? "checkout" : "library",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [purchasedCompositions, setPurchasedCompositions] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<
    string | null
  >(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [libraryFilter, setLibraryFilter] = useState<"all" | "compositions">(
    "all",
  );
  const [librarySearch, setLibrarySearch] = useState("");

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
      return true;
    });
  }, [libraryFilter, librarySearch, purchasedCompositions]);

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

  const handleTabChange = (nextTab: "library" | "checkout") => {
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950/30 via-background to-background text-foreground">
      <div className="section-shell space-y-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => {
              setLibraryFilter("all");
              handleTabChange("library");
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "library" && libraryFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-white/10 bg-white/5 text-foreground/80 hover:bg-white/10"
            }`}
          >
            All
          </button>
          <button
            onClick={() => {
              setLibraryFilter("compositions");
              handleTabChange("library");
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "library" && libraryFilter === "compositions"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-white/10 bg-white/5 text-foreground/80 hover:bg-white/10"
            }`}
          >
            Compositions
          </button>
          <button
            onClick={() => handleTabChange("checkout")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "checkout"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-white/10 bg-white/5 text-foreground/80 hover:bg-white/10"
            }`}
          >
            Cart {cart.length > 0 && `(${cart.length})`}
          </button>
        </div>

        {activeTab === "library" && (
          <div className="space-y-6">
            <div className="max-w-lg">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search your library..."
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  className="h-11 border-white/15 bg-white/10 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Purchases</h2>
              <div className="flex gap-1">
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

            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader className="size-12 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPurchases.length === 0 ? (
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredPurchases.map(
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
                        className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
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
                              className="h-14 w-14 rounded-full bg-emerald-500 shadow-2xl transition-all hover:scale-110 hover:bg-emerald-400"
                              onClick={() => void handleDownloadComposition(id)}
                              disabled={downloadingPurchaseId === id}
                            >
                              {downloadingPurchaseId === id ? (
                                <Loader className="size-6 animate-spin" />
                              ) : (
                                <Download className="size-6" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h3 className="truncate font-semibold text-foreground">
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
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
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
                {filteredPurchases.map(({ composition, purchased_at, created_at, id }) => {
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
                      className="group flex cursor-pointer items-center gap-4 rounded-lg border border-white/10 p-2 transition-colors hover:bg-white/10"
                      onClick={() => void handleDownloadComposition(id)}
                    >
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md shadow-lg">
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
                        <h3 className="truncate font-semibold text-foreground">
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

            <div className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-purple-600/15 to-pink-600/15 p-6">
              <h3 className="mb-4 text-lg font-semibold">Your Stats</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-3xl font-bold">
                    {purchasedCompositions.length}
                  </div>
                  <p className="text-sm text-muted-foreground">Compositions</p>
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {formatKesAmount(totalSpent)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-3xl font-bold">
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
            <h2 className="text-2xl font-bold">Shopping Cart</h2>

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
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  {cart.map((item) => (
                    <div
                      key={item.composition.id}
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                        <Music className="size-10 text-white" />
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
                        <p className="mt-2 text-lg font-bold text-foreground">
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
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h3 className="mb-4 text-xl font-bold">Order Summary</h3>
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
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>{formatKesAmount(cartTotal)}</span>
                      </div>
                    </div>

                    <Button
                      className="mt-6 w-full bg-emerald-500 text-white hover:bg-emerald-400"
                      size="lg"
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                    >
                      <CreditCard className="mr-2 size-5" />
                      Proceed to Checkout
                    </Button>

                    <div className="mt-4 space-y-2 rounded-lg border border-white/10 bg-white/5 p-4">
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
      </div>
    </main>
  );
}

export default BuyerDashboard;
