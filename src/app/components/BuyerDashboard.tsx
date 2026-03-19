import { useState } from "react";
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
  Plus,
  Grid3x3,
  List,
  User,
} from "lucide-react";
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

// Mock data for demonstration
const mockPurchasedCompositions = [
  {
    id: "1",
    composition: {
      title: "Symphony No. 5",
      composerName: "Ludwig van Beethoven",
      voiceParts: ["Violin I", "Violin II", "Viola", "Cello"],
      color: "from-violet-500 to-purple-700",
    },
    purchased_at: "2026-01-15T10:30:00Z",
    price_paid: 2500,
  },
  {
    id: "2",
    composition: {
      title: "Moonlight Sonata",
      composerName: "Ludwig van Beethoven",
      voiceParts: ["Piano"],
      color: "from-blue-500 to-indigo-700",
    },
    purchased_at: "2026-02-20T14:15:00Z",
    price_paid: 1500,
  },
  {
    id: "3",
    composition: {
      title: "The Four Seasons",
      composerName: "Antonio Vivaldi",
      voiceParts: ["Violin", "Viola", "Cello", "Bass"],
      color: "from-emerald-500 to-teal-700",
    },
    purchased_at: "2026-03-10T09:00:00Z",
    price_paid: 3000,
  },
  {
    id: "4",
    composition: {
      title: "Ave Maria",
      composerName: "Franz Schubert",
      voiceParts: ["Soprano", "Alto", "Tenor", "Bass"],
      color: "from-rose-500 to-pink-700",
    },
    purchased_at: "2026-03-12T16:45:00Z",
    price_paid: 1800,
  },
  {
    id: "5",
    composition: {
      title: "Canon in D",
      composerName: "Johann Pachelbel",
      voiceParts: ["Violin I", "Violin II", "Violin III", "Basso Continuo"],
      color: "from-amber-500 to-orange-700",
    },
    purchased_at: "2026-03-15T11:20:00Z",
    price_paid: 2200,
  },
  {
    id: "6",
    composition: {
      title: "Clair de Lune",
      composerName: "Claude Debussy",
      voiceParts: ["Piano"],
      color: "from-cyan-500 to-blue-700",
    },
    purchased_at: "2026-03-18T09:30:00Z",
    price_paid: 1600,
  },
];

const mockCartItems = [
  {
    id: "cart-1",
    composition: {
      id: "c1",
      title: "Requiem in D minor",
      composerName: "Wolfgang Amadeus Mozart",
      price: 4500,
      voiceParts: ["Soprano", "Alto", "Tenor", "Bass", "Orchestra"],
      color: "from-red-500 to-rose-700",
    },
    quantity: 1,
  },
  {
    id: "cart-2",
    composition: {
      id: "c2",
      title: "Brandenburg Concerto No. 3",
      composerName: "Johann Sebastian Bach",
      price: 3200,
      voiceParts: ["Violin", "Viola", "Cello", "Harpsichord"],
      color: "from-green-500 to-emerald-700",
    },
    quantity: 1,
  },
];

// Helper function to format currency
const formatKesAmount = (amount: number) => {
  return `KES ${amount.toLocaleString()}`;
};

export function BuyerDashboard() {
  const [activeTab, setActiveTab] = useState("library");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(false);
  const [purchasedCompositions] = useState(mockPurchasedCompositions);
  const [cart, setCart] = useState(mockCartItems);
  const [downloadingPurchaseId, setDownloadingPurchaseId] = useState<
    string | null
  >(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const totalSpent = purchasedCompositions.reduce(
    (sum, p) => sum + p.price_paid,
    0,
  );

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.composition.price * item.quantity,
    0,
  );

  const handleCheckout = () => {
    alert("Proceeding to checkout...");
  };

  const handleRemoveItem = (compositionId: string) => {
    setCart(cart.filter((item) => item.composition.id !== compositionId));
  };

  const handleDownloadComposition = async (purchaseId: string) => {
    if (!purchaseId) return;

    try {
      setDownloadingPurchaseId(purchaseId);
      // Simulate download
      await new Promise((resolve) => setTimeout(resolve, 1500));
      alert("Download started!");
    } catch (err) {
      alert("Download failed");
    } finally {
      setDownloadingPurchaseId(null);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600">
                <User className="size-6" />
              </div>
              <h1 className="text-2xl font-bold">Your Library</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
              >
                <Search className="size-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/10"
              >
                <Plus className="size-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab("library")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "library"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "library"
                ? "bg-white/10 text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Compositions
          </button>
          <button
            onClick={() => setActiveTab("checkout")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "checkout"
                ? "bg-white text-black"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            Cart {cart.length > 0 && `(${cart.length})`}
          </button>
        </div>

        {activeTab === "library" && (
          <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Recent Purchases</h2>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className={`text-white hover:bg-white/10 ${viewMode === "list" ? "bg-white/20" : ""}`}
                >
                  <List className="size-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className={`text-white hover:bg-white/10 ${viewMode === "grid" ? "bg-white/20" : ""}`}
                >
                  <Grid3x3 className="size-5" />
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <Loader className="size-12 animate-spin text-white" />
              </div>
            ) : purchasedCompositions.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <Music className="mx-auto mb-4 size-16 text-white/40" />
                  <h3 className="mb-2 text-xl font-semibold">
                    Your library is empty
                  </h3>
                  <p className="mb-6 text-white/60">
                    Start building your collection of beautiful compositions
                  </p>
                  <Button className="bg-white text-black hover:bg-white/90">
                    Browse Marketplace
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {purchasedCompositions.map(
                  ({ composition, purchased_at, id }) => (
                    <div
                      key={id}
                      className="group cursor-pointer rounded-lg bg-white/5 p-4 transition-all hover:bg-white/10"
                      onMouseEnter={() => setHoveredCard(id)}
                      onMouseLeave={() => setHoveredCard(null)}
                    >
                      {/* Album Art */}
                      <div className="relative mb-4 aspect-square overflow-hidden rounded-md shadow-xl">
                        <div
                          className={`flex h-full items-center justify-center bg-gradient-to-br ${composition.color || "from-purple-500 to-pink-600"}`}
                        >
                          <Music className="size-16 text-white/90" />
                        </div>

                        {/* Download Button Overlay */}
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

                      {/* Info */}
                      <div className="space-y-1">
                        <h3 className="truncate font-semibold text-white">
                          {composition.title}
                        </h3>
                        <p className="truncate text-sm text-white/60">
                          {composition.composerName}
                        </p>
                        {composition.voiceParts &&
                          composition.voiceParts.length > 0 && (
                            <p className="truncate text-xs text-white/40">
                              {composition.voiceParts.join(", ")}
                            </p>
                          )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {purchasedCompositions.map(
                  ({ composition, purchased_at, id }) => (
                    <div
                      key={id}
                      className="group flex cursor-pointer items-center gap-4 rounded-lg p-2 transition-colors hover:bg-white/10"
                      onClick={() => void handleDownloadComposition(id)}
                    >
                      <div
                        className={`h-14 w-14 flex-shrink-0 rounded-md bg-gradient-to-br ${composition.color || "from-purple-500 to-pink-600"} flex items-center justify-center shadow-lg`}
                      >
                        <Music className="size-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate font-semibold text-white">
                          {composition.title}
                        </h3>
                        <p className="truncate text-sm text-white/60">
                          {composition.composerName}
                        </p>
                        {composition.voiceParts &&
                          composition.voiceParts.length > 0 && (
                            <p className="truncate text-xs text-white/40">
                              {composition.voiceParts.join(", ")}
                            </p>
                          )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                        disabled={downloadingPurchaseId === id}
                      >
                        {downloadingPurchaseId === id ? (
                          <Loader className="size-5 animate-spin" />
                        ) : (
                          <Download className="size-5" />
                        )}
                      </Button>
                    </div>
                  ),
                )}
              </div>
            )}

            {/* Quick Stats Section */}
            <div className="mt-8 rounded-2xl bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6">
              <h3 className="mb-4 text-lg font-semibold">Your Stats</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-3xl font-bold">
                    {purchasedCompositions.length}
                  </div>
                  <p className="text-sm text-white/60">Compositions</p>
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {formatKesAmount(totalSpent)}
                  </div>
                  <p className="text-sm text-white/60">Total Spent</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <div className="text-3xl font-bold">
                    {new Date(
                      purchasedCompositions[0]?.purchased_at,
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <p className="text-sm text-white/60">Member Since</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "checkout" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Shopping Cart</h2>

            {cart.length === 0 ? (
              <div className="flex min-h-[400px] items-center justify-center rounded-2xl bg-white/5 p-8">
                <div className="text-center">
                  <ShoppingBag className="mx-auto mb-4 size-16 text-white/40" />
                  <h3 className="mb-2 text-xl font-semibold">
                    Your cart is empty
                  </h3>
                  <p className="mb-6 text-white/60">
                    Add compositions to get started
                  </p>
                  <Button className="bg-white text-black hover:bg-white/90">
                    Browse Marketplace
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  {cart.map((item) => (
                    <div
                      key={item.composition.id}
                      className="flex items-start gap-4 rounded-2xl bg-white/5 p-4 transition-colors hover:bg-white/10"
                    >
                      <div
                        className={`h-20 w-20 flex-shrink-0 rounded-lg bg-gradient-to-br ${item.composition.color || "from-purple-500 to-pink-600"} flex items-center justify-center shadow-lg`}
                      >
                        <Music className="size-10 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate font-semibold text-white">
                          {item.composition.title}
                        </h4>
                        <p className="truncate text-sm text-white/60">
                          {item.composition.composerName}
                        </p>
                        {item.composition.voiceParts &&
                          item.composition.voiceParts.length > 0 && (
                            <p className="mt-1 truncate text-xs text-white/40">
                              {item.composition.voiceParts.join(", ")}
                            </p>
                          )}
                        <p className="mt-2 text-lg font-bold text-white">
                          {formatKesAmount(item.composition.price)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.composition.id)}
                        className="text-white/60 hover:bg-white/10 hover:text-white"
                      >
                        <Trash2 className="mr-1 size-4" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <div className="rounded-2xl bg-white/5 p-6">
                    <h3 className="mb-4 text-xl font-bold">Order Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">
                          Subtotal ({cart.length}{" "}
                          {cart.length === 1 ? "item" : "items"})
                        </span>
                        <span className="font-medium">
                          {formatKesAmount(cartTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Processing Fee</span>
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

                    <div className="mt-4 space-y-2 rounded-lg bg-white/5 p-4">
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span>Secure checkout</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span>Instant download</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
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
