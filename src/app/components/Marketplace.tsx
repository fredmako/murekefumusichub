import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Music2, Search, Sparkles, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { Checkbox } from "@/app/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { CompositionCard } from "@/app/components/ui/CompositionCard";
import { MidiPreviewPlayer } from "@/app/components/MidiPreviewPlayer";
import {
  categoryService,
  compositionService,
  fypService,
} from "@/services/api";
import { toast } from "sonner";
import { ensureArray } from "@/lib/ensureArray";
import { parseAccompanimentList } from "@/lib/compositionMeta";

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
    midiUrl: comp.midi_url || undefined,
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
  const [preferenceSavingCategoryId, setPreferenceSavingCategoryId] = useState<
    number | null
  >(null);
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

  useEffect(() => {
    const source =
      activeFeed === "for-you" ? recommendedCompositions : filteredCompositions;
    if (source.length === 0) {
      setPreviewComposition(null);
      return;
    }
    setPreviewComposition((current) => {
      if (current && source.some((comp) => comp.id === current.id)) {
        return current;
      }
      return source[0];
    });
  }, [activeFeed, filteredCompositions, recommendedCompositions]);

  const handlePreferenceBoost = async (categoryId: number) => {
    if (!appUser?.id) {
      toast.info("Sign in to personalize your recommendations.");
      return;
    }

    if (
      recommendationMeta.mode === "cold_start" &&
      recommendationMeta.purchaseCount < recommendationMeta.minimumPurchasesForPersonalized
    ) {
      toast.info(
        recommendationMeta.message ||
          `Make ${recommendationMeta.minimumPurchasesForPersonalized} purchases to unlock personalized recommendations.`,
      );
      return;
    }

    setPreferenceSavingCategoryId(categoryId);
    try {
      await fypService.updatePreferences(appUser.id, categoryId, 1);
      toast.success("Preference saved. Recommendations updated.");
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
    } catch (error: any) {
      console.error("[marketplace] preference update failed:", error);
      toast.error(error?.message || "Failed to update recommendation preference");
    } finally {
      setPreferenceSavingCategoryId(null);
    }
  };

  return (
    <div className="section-shell space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Music Hub
          </span>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">
            Discover Choral Music
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Browse, filter, and personalize your feed with compositions and
            arrangements curated for you.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1.5 backdrop-blur">
          {([
            { id: "all", label: "All" },
            { id: "for-you", label: "For You" },
            { id: "discover", label: "Discover More" },
          ] as const).map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={activeFeed === item.id ? "default" : "ghost"}
              className="rounded-full px-4 text-xs font-semibold"
              onClick={() => setActiveFeed(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {categories.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="size-3.5" />
                Personalize
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell us what you want more of and we will shape your feed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 6).map((category) => (
                <Button
                  key={`personalize-${category.id}`}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={preferenceSavingCategoryId === category.id}
                  onClick={() => void handlePreferenceBoost(category.id)}
                >
                  {preferenceSavingCategoryId === category.id ? (
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                  ) : null}
                  Prefer {category.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeFeed === "for-you" ? (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)] backdrop-blur">
          {!appUser ? (
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="size-3.5" />
                For You
              </div>
              <p className="text-sm text-muted-foreground">
                Sign in to unlock personalized recommendations.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                    <Sparkles className="size-3.5" />
                    Recommended For You
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold">
                    Buyer suggestions
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {recommendationMeta.message ||
                      "This section adapts once your purchase history is strong enough to personalize recommendations."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.slice(0, 6).map((category) => (
                    <Button
                      key={category.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        preferenceSavingCategoryId === category.id ||
                        recommendationMeta.mode === "cold_start"
                      }
                      onClick={() => void handlePreferenceBoost(category.id)}
                    >
                      {preferenceSavingCategoryId === category.id ? (
                        <Loader2 className="mr-2 size-3.5 animate-spin" />
                      ) : null}
                      Prefer {category.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                {recommendationsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading recommendations...
                  </div>
                ) : recommendationMeta.mode === "cold_start" ? (
                  <p className="text-sm text-muted-foreground">
                    {recommendationMeta.message ||
                      "Make a few purchases to unlock personalized recommendations."}
                  </p>
                ) : recommendationMeta.mode === "degraded" ? (
                  <p className="text-sm text-muted-foreground">
                    {recommendationMeta.message ||
                      "Recommendations are temporarily unavailable."}
                  </p>
                ) : recommendedCompositions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No personalized recommendations yet. Pick a preferred category
                    to seed them.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {recommendedCompositions.map((composition) => (
                      <div
                        key={`recommended-${composition.id}`}
                        onMouseEnter={() => setPreviewComposition(composition)}
                        onFocus={() => setPreviewComposition(composition)}
                      >
                        <CompositionCard
                          composition={composition}
                          onAddToCart={onAddToCart}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeFeed === "discover" ? (
        <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)] backdrop-blur">
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              <Sparkles className="size-3.5" />
              Discover More
            </div>
            <p className="text-sm text-muted-foreground">
              Explore by category or jump straight into a new vibe.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={categoryFilter === "all" ? "default" : "outline"}
                onClick={() => setCategoryFilter("all")}
              >
                All Categories
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  size="sm"
                  variant={
                    categoryFilter === String(category.id) ? "default" : "outline"
                  }
                  onClick={() => setCategoryFilter(String(category.id))}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)] backdrop-blur">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search compositions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-white/10 bg-white/10 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/20 text-muted-foreground transition hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

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

      <div className="mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          {loading
            ? "Loading compositions..."
            : `${filteredCompositions.length} composition${filteredCompositions.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {loading && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-96 animate-pulse rounded-xl border border-border/60 bg-muted/60"
                />
              ))}
            </div>
          )}

          {!loading && filteredCompositions.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredCompositions.map((composition) => (
                <div
                  key={composition.id}
                  onMouseEnter={() => setPreviewComposition(composition)}
                  onFocus={() => setPreviewComposition(composition)}
                >
                  <CompositionCard
                    composition={composition}
                    onAddToCart={onAddToCart}
                  />
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

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            {previewComposition ? (
              <>
                <div className="relative aspect-square overflow-hidden rounded-xl bg-white/5">
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
                <div className="space-y-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {previewComposition.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {previewComposition.composerName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {previewComposition.language ? (
                    <span>{previewComposition.language}</span>
                  ) : null}
                  {previewComposition.duration ? (
                    <span>{previewComposition.duration}</span>
                  ) : null}
                  {previewComposition.difficulty ? (
                    <span>{previewComposition.difficulty}</span>
                  ) : null}
                </div>
                {previewComposition.midiUrl ? (
                  <MidiPreviewPlayer
                    midiUrl={previewComposition.midiUrl}
                    compact
                    className="mt-2"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    MIDI preview not available for this composition.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => onAddToCart?.(previewComposition)}
                    disabled={!onAddToCart}
                  >
                    Add to cart
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setSearchTerm(previewComposition.composerName)
                    }
                  >
                    More like this
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center text-sm text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <Music2 className="size-6" />
                </div>
                <p>Hover a composition to preview it here.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Marketplace;
