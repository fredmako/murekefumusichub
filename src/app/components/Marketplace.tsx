import { useEffect, useMemo, useState } from "react";
import {
  Filter,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  Loader2,
  Music2,
  Play,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { CompositionCard } from "@/app/components/ui/CompositionCard";
import { MidiPreviewPlayer } from "@/app/components/MidiPreviewPlayer";
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group";
import { DashboardShell } from "@/app/components/DashboardShell";
import {
  categoryService,
  compositionService,
  fypService,
} from "@/services/api";
import { toast } from "sonner";
import { ensureArray } from "@/lib/ensureArray";
import { parseAccompanimentList } from "@/lib/compositionMeta";
import { buildApiUrl } from "@/lib/apiBase";
import { useNavigate } from "react-router-dom";

interface Composition {
  id: string;
  title: string;
  composerName: string;
  price: number;
  priceCurrency?: string | null;
  description?: string;
  difficulty?: string;
  duration: string;
  language: string;
  accompaniment: string[];
  voiceParts: string[];
  pdfUrl?: string;
  midiUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  categoryId?: number | null;
  categoryName?: string;
  stats: {
    views: number;
    purchases: number;
  };
}

interface CategoryOption {
  id: number;
  name: string;
  description?: string | null;
}

interface RecommendationMeta {
  mode: "idle" | "cold_start" | "fallback" | "personalized" | "degraded";
  purchaseCount: number;
  minimumPurchasesForPersonalized: number;
  message: string;
}

const ALLOWED_CATEGORY_NAMES = new Set(["arrangements", "compositions"]);

function isAllowedCategory(category: Partial<CategoryOption> | null | undefined) {
  return ALLOWED_CATEGORY_NAMES.has(String(category?.name || "").trim().toLowerCase());
}

function extractInitial(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  const initial = trimmed[0]?.toUpperCase();
  return /^[A-Z]$/.test(initial) ? initial : "";
}

interface MarketplaceProps {
  onAddToCart?: (composition: Composition) => void;
}

function mapComposition(comp: any): Composition {
  const hasMidi = Boolean(comp.midi_url);
  return {
    id: comp.id || comp.composition_id,
    title: comp.title || "Untitled",
    composerName:
      comp.composer_name ||
      comp.composers?.users?.display_name ||
      "Unknown Composer",
    price: Number(comp.price || 0),
    priceCurrency: comp.price_currency || "KES",
    description: comp.description || "",
    difficulty: comp.difficulty || "",
    duration: comp.duration || "",
    language: comp.language || "",
    accompaniment: parseAccompanimentList(comp.accompaniment),
    voiceParts: Array.isArray(comp.voice_parts) ? comp.voice_parts : [],
    pdfUrl: comp.pdf_url || undefined,
    midiUrl: hasMidi ? buildApiUrl(`/compositions/${comp.id || comp.composition_id}/midi`) : undefined,
    thumbnailUrl: comp.thumbnail_url || comp.thumbnailUrl || undefined,
    createdAt: comp.created_at || "",
    categoryId:
      typeof comp.category_id === "number" ? comp.category_id : null,
    categoryName: comp.categories?.name || comp.category_name || "",
    stats: comp.composition_stats?.[0] || {
      views: 0,
      purchases: 0,
    },
  };
}

export function Marketplace({ onAddToCart }: MarketplaceProps) {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const [activeFeed, setActiveFeed] = useState<"all" | "for-you" | "discover">(
    "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [initialFilters, setInitialFilters] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [accompanimentFilter, setAccompanimentFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [recommendedCompositions, setRecommendedCompositions] = useState<
    Composition[]
  >([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [previewComposition, setPreviewComposition] = useState<Composition | null>(null);
  const [viewSize, setViewSize] = useState<"compact" | "comfortable" | "large">(
    "comfortable",
  );
  const [recommendationMeta, setRecommendationMeta] = useState<RecommendationMeta>({
    mode: "idle",
    purchaseCount: 0,
    minimumPurchasesForPersonalized: 3,
    message: "",
  });

  useEffect(() => {
    const fetchMarketplaceData = async () => {
      try {
        setLoading(true);

        const [compositionsPayload, categoriesPayload] = await Promise.all([
          compositionService.getAll(),
          categoryService.getAll().catch(() => []),
        ]);

        const compositionsData = ensureArray<any>(compositionsPayload, [
          "compositions",
        ]);
        const mapped = compositionsData.map(mapComposition);
        const normalizedCategories = ensureArray<CategoryOption>(categoriesPayload).filter(
          isAllowedCategory,
        );

        setCompositions(mapped);
        setCategories(normalizedCategories);
      } catch (error) {
        console.error("Error fetching compositions:", error);
        toast.error("Failed to load compositions");
      } finally {
        setLoading(false);
      }
    };

    void fetchMarketplaceData();
  }, []);

  useEffect(() => {
    if (!appUser?.id) {
      setRecommendedCompositions([]);
      setRecommendationMeta({
        mode: "idle",
        purchaseCount: 0,
        minimumPurchasesForPersonalized: 3,
        message: "",
      });
      return;
    }

    const fetchRecommendations = async () => {
      try {
        setRecommendationsLoading(true);
        const payload = await fypService.getRecommendations(appUser.id, 6) as any;
        const rows = ensureArray<any>(payload, ["recommendations"]);
        setRecommendedCompositions(rows.map(mapComposition));
        setRecommendationMeta({
          mode: payload?.mode || "fallback",
          purchaseCount: Number(payload?.purchaseCount || 0),
          minimumPurchasesForPersonalized: Number(
            payload?.minimumPurchasesForPersonalized || 3,
          ),
          message: String(payload?.message || ""),
        });
      } catch (error) {
        console.error("[marketplace] recommendation fetch failed:", error);
        setRecommendedCompositions([]);
        setRecommendationMeta({
          mode: "degraded",
          purchaseCount: 0,
          minimumPurchasesForPersonalized: 3,
          message:
            "Recommendations are temporarily unavailable. You can still browse the marketplace below.",
        });
      } finally {
        setRecommendationsLoading(false);
      }
    };

    void fetchRecommendations();
  }, [appUser?.id]);

  const filteredCompositions = useMemo(() => {
    return compositions.filter((comp) => {
      const matchesSearch =
        comp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.composerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        comp.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        false;

      const matchesInitials =
        initialFilters.length === 0 ||
        initialFilters.some((initial) => {
          const titleInitial = extractInitial(comp.title);
          const composerInitial = extractInitial(comp.composerName);
          return titleInitial === initial || composerInitial === initial;
        });

      const matchesLanguage =
        languageFilter === "all" || comp.language === languageFilter;
      const matchesAccompaniment =
        accompanimentFilter === "all" ||
        comp.accompaniment.includes(accompanimentFilter);
      const matchesCategory =
        categoryFilter === "all" ||
        String(comp.categoryId || "") === categoryFilter;

      return (
        matchesSearch &&
        matchesInitials &&
        matchesLanguage &&
        matchesAccompaniment &&
        matchesCategory
      );
    });
  }, [
    accompanimentFilter,
    categoryFilter,
    compositions,
    languageFilter,
    initialFilters,
    searchTerm,
  ]);

  const availableInitials = useMemo(() => {
    const initials = new Set<string>();
    compositions.forEach((comp) => {
      const titleInitial = extractInitial(comp.title);
      const composerInitial = extractInitial(comp.composerName);
      if (titleInitial) initials.add(titleInitial);
      if (composerInitial) initials.add(composerInitial);
    });
    return Array.from(initials).sort((a, b) => a.localeCompare(b));
  }, [compositions]);

  const featuredCompositions = useMemo(() => {
    const source =
      activeFeed === "for-you" && recommendedCompositions.length > 0
        ? recommendedCompositions
        : compositions;
    return [...source]
      .sort((a, b) => (b.stats?.purchases ?? 0) - (a.stats?.purchases ?? 0))
      .slice(0, 3);
  }, [activeFeed, compositions, recommendedCompositions]);

  const trendingCompositions = useMemo(() => {
    return [...compositions]
      .sort((a, b) => (b.stats?.views ?? 0) - (a.stats?.views ?? 0))
      .slice(0, 6);
  }, [compositions]);

  useEffect(() => {
    if (!previewComposition) return;
    const source =
      activeFeed === "for-you" ? recommendedCompositions : filteredCompositions;
    if (!source.some((comp) => comp.id === previewComposition.id)) {
      setPreviewComposition(null);
    }
  }, [activeFeed, filteredCompositions, previewComposition, recommendedCompositions]);

  const handlePreviewSelect = (composition: Composition) => {
    setPreviewComposition(composition);
  };

  const handlePreviewClear = () => {
    setPreviewComposition(null);
  };

  const handlePurchase = (composition: Composition) => {
    if (onAddToCart) {
      onAddToCart(composition);
    }
    navigate("/checkout");
  };

  const featuredGradients = [
    "from-violet-500/60 to-purple-700/80",
    "from-emerald-500/60 to-teal-700/80",
    "from-amber-500/60 to-orange-700/80",
  ];

  const marketplaceNavItems = [
    {
      id: "all",
      label: "All",
      icon: Music2,
      onSelect: () => setActiveFeed("all"),
    },
    {
      id: "for-you",
      label: "For You",
      icon: Sparkles,
      onSelect: () => setActiveFeed("for-you"),
    },
    {
      id: "discover",
      label: "Discover",
      icon: TrendingUp,
      onSelect: () => setActiveFeed("discover"),
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950/30 via-background to-background text-foreground">
      <DashboardShell
        title="Music Hub"
        description="Browse and filter compositions and arrangements in one place."
        navItems={marketplaceNavItems}
        activeNavId={activeFeed}
      >
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.6)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-3.5" />
              {activeFeed === "for-you"
                ? "For You"
                : activeFeed === "discover"
                  ? "Discover"
                  : "Browse"}
            </div>
            <div className="w-full max-w-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search for compositions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 border-white/15 bg-white/10 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-muted-foreground transition hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {featuredCompositions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Featured</h2>
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setSearchTerm("")}
              >
                Show all
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {featuredCompositions.map((composition, index) => {
                const gradient =
                  featuredGradients[index % featuredGradients.length];

                return (
                  <div
                    key={`featured-${composition.id}`}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:bg-white/10"
                    onClick={() => handlePreviewSelect(composition)}
                  >
                    <div className="relative aspect-[16/9] overflow-hidden">
                      {composition.thumbnailUrl ? (
                        <img
                          src={composition.thumbnailUrl}
                          alt={composition.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={`flex h-full items-center justify-center bg-gradient-to-br ${gradient}`}
                        >
                          <Music2 className="size-12 text-white/80" />
                        </div>
                      )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        className="h-12 w-12 rounded-full bg-emerald-500 shadow-2xl transition-transform hover:scale-105 hover:bg-emerald-400"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePreviewSelect(composition);
                        }}
                      >
                        <Play className="size-5 fill-white" />
                      </Button>
                    </div>
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <h3 className="truncate text-base font-semibold text-foreground">
                        {composition.title}
                      </h3>
                      <p className="truncate text-sm text-muted-foreground">
                        {composition.composerName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      {activeFeed === "for-you" ? (
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)] backdrop-blur">
          {!appUser ? (
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="size-3.5" />
                For You
              </div>
              <p className="text-sm text-muted-foreground">
                Sign in to see your recommendations.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    <Sparkles className="size-3.5" />
                    Recommended
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">For you</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    A quick mix of fresh picks and familiar favorites.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {recommendationsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading recommendations...
                  </div>
                ) : recommendationMeta.mode === "degraded" ? (
                  <p className="text-sm text-muted-foreground">
                    Recommendations are temporarily unavailable.
                  </p>
                ) : recommendedCompositions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recommendations yet. Check back after a few plays.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {recommendedCompositions.map((composition) => (
                      <div
                        key={`recommended-${composition.id}`}
                        onClick={() => handlePreviewSelect(composition)}
                      >
                        <CompositionCard composition={composition} showActions={false} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {trendingCompositions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <TrendingUp className="size-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Trending Now</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {trendingCompositions.map((composition, index) => {
              const gradient =
                featuredGradients[index % featuredGradients.length];

              return (
                <div
                  key={`trending-${composition.id}`}
                  className="group rounded-xl border border-white/10 bg-white/5 p-3 transition-all hover:bg-white/10"
                  onClick={() => handlePreviewSelect(composition)}
                >
                  <div className="relative mb-3 aspect-square overflow-hidden rounded-lg shadow-xl">
                    {composition.thumbnailUrl ? (
                      <img
                        src={composition.thumbnailUrl}
                        alt={composition.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`flex h-full items-center justify-center bg-gradient-to-br ${gradient}`}
                      >
                        <Music2 className="size-10 text-white/80" />
                      </div>
                    )}
                    <div className="absolute right-2 top-2 rounded-full bg-emerald-500/90 px-2 py-1 text-[10px] text-white">
                      <Star className="inline size-3 fill-white text-white" />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        size="icon"
                        className="h-10 w-10 rounded-full bg-emerald-500 shadow-xl transition-transform hover:scale-105 hover:bg-emerald-400"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePreviewSelect(composition);
                        }}
                      >
                        <Play className="size-4 fill-white" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {composition.title}
                  </h3>
                  <p className="truncate text-xs text-muted-foreground">
                    {composition.composerName}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-300/80">
                    {(composition.stats?.views ?? 0).toLocaleString()} views
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)] backdrop-blur">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Latin">Latin</SelectItem>
              <SelectItem value="German">German</SelectItem>
              <SelectItem value="French">French</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={accompanimentFilter}
            onValueChange={setAccompanimentFilter}
          >
            <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
              <SelectValue placeholder="Accompaniment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="A cappella">A cappella</SelectItem>
              <SelectItem value="Piano">Piano</SelectItem>
              <SelectItem value="Organ">Organ</SelectItem>
              <SelectItem value="String Quartet">String Quartet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {availableInitials.length > 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Quick initials
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={initialFilters.length === 0}
                  onCheckedChange={() => setInitialFilters([])}
                />
                All
              </label>
              {availableInitials.map((initial) => (
                <label
                  key={initial}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <Checkbox
                    checked={initialFilters.includes(initial)}
                    onCheckedChange={() =>
                      setInitialFilters((prev) =>
                        prev.includes(initial)
                          ? prev.filter((value) => value !== initial)
                          : [...prev, initial],
                      )
                    }
                  />
                  {initial}
                </label>
              ))}
            </div>
          </div>
        )}

        {(searchTerm ||
          initialFilters.length > 0 ||
          categoryFilter !== "all" ||
          languageFilter !== "all" ||
          accompanimentFilter !== "all") && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setInitialFilters([]);
                setCategoryFilter("all");
                setLanguageFilter("all");
                setAccompanimentFilter("all");
              }}
            >
              <Filter className="mr-2 size-4" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {loading
            ? "Loading compositions..."
            : `${filteredCompositions.length} composition${filteredCompositions.length !== 1 ? "s" : ""} found`}
        </p>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5">
          <span className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            View
          </span>
          <ToggleGroup
            type="single"
            value={viewSize}
            onValueChange={(value) => {
              if (value) setViewSize(value as typeof viewSize);
            }}
            className="flex items-center"
          >
            <ToggleGroupItem value="compact" aria-label="Compact view">
              <Grid3x3 className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="comfortable" aria-label="Comfortable view">
              <LayoutGrid className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="large" aria-label="Large view">
              <Grid2x2 className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="grid gap-4">
        <div>
          {loading && (
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
                viewSize === "compact"
                  ? "lg:grid-cols-4 xl:grid-cols-5"
                  : viewSize === "large"
                    ? "lg:grid-cols-2 xl:grid-cols-3"
                    : "lg:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-96 animate-pulse rounded-xl border border-border/60 bg-muted/60"
                />
              ))}
            </div>
          )}

          {!loading && filteredCompositions.length > 0 && (
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${
                viewSize === "compact"
                  ? "lg:grid-cols-4 xl:grid-cols-5"
                  : viewSize === "large"
                    ? "lg:grid-cols-2 xl:grid-cols-3"
                    : "lg:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {filteredCompositions.map((composition) => (
                <div
                  key={composition.id}
                  onClick={() => handlePreviewSelect(composition)}
                >
                  <CompositionCard composition={composition} showActions={false} />
                </div>
              ))}
            </div>
          )}

          {!loading && filteredCompositions.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-gray-500">
                {compositions.length === 0
                  ? "No compositions available yet. Check back soon."
                  : "No compositions found matching your criteria."}
              </p>
              {compositions.length > 0 && (
                <Button
                  variant="link"
                  onClick={() => {
                    setSearchTerm("");
                    setCategoryFilter("all");
                    setLanguageFilter("all");
                    setAccompanimentFilter("all");
                  }}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}
        </div>

      </div>
      <Dialog
        open={Boolean(previewComposition)}
        onOpenChange={(open) => {
          if (!open) handlePreviewClear();
        }}
      >
        <DialogContent className="max-h-[85vh] w-[min(92vw,56rem)] max-w-[min(92vw,56rem)] overflow-y-auto border-border/70 bg-card/95 text-foreground dark:border-white/10 dark:bg-slate-950/95">
          {previewComposition ? (
            <>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl font-semibold">
                  {previewComposition.title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {previewComposition.composerName}
                </p>
              </DialogHeader>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="relative aspect-[16/9] max-h-[40vh] overflow-hidden rounded-xl border border-border/70 bg-muted/20 dark:border-white/10 dark:bg-white/5">
                    {previewComposition.thumbnailUrl ? (
                      <img
                        src={previewComposition.thumbnailUrl}
                        alt={previewComposition.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
                        <Music2 className="size-16 text-emerald-200/70" />
                      </div>
                    )}
                  </div>
                  {previewComposition.midiUrl ? (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Preview
                      </p>
                      <MidiPreviewPlayer
                        midiUrl={previewComposition.midiUrl}
                        previewRatio={0.33}
                        className="mt-3"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      MIDI preview not available for this composition.
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Details
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-foreground">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-semibold">
                          {previewComposition.priceCurrency || "KES"}{" "}
                          {previewComposition.price.toLocaleString()}
                        </span>
                      </div>
                      {previewComposition.language ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Language</span>
                          <span>{previewComposition.language}</span>
                        </div>
                      ) : null}
                      {previewComposition.duration ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{previewComposition.duration}</span>
                        </div>
                      ) : null}
                      {previewComposition.difficulty ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Difficulty</span>
                          <span>{previewComposition.difficulty}</span>
                        </div>
                      ) : null}
                      {previewComposition.voiceParts?.length ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-muted-foreground">Voice Parts</span>
                          <span className="text-right">
                            {previewComposition.voiceParts.join(", ")}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {previewComposition.description ? (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Description
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {previewComposition.description}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={handlePreviewClear}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePurchase(previewComposition)}
                  className="gap-2"
                >
                  <ShoppingBag className="size-4" />
                  Purchase &amp; Checkout
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      </DashboardShell>
    </main>
  );
}

export default Marketplace;
