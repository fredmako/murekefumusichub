import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { CompositionCard } from "@/app/components/CompositionCard";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
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
  const [preferenceSavingCategoryId, setPreferenceSavingCategoryId] = useState<
    number | null
  >(null);

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

        setCompositions(mapped);
        setCategories(Array.isArray(categoriesPayload) ? categoriesPayload : []);
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
      return;
    }

    const fetchRecommendations = async () => {
      try {
        setRecommendationsLoading(true);
        const payload = await fypService.getRecommendations(appUser.id, 6);
        const rows = ensureArray<any>(payload, ["recommendations"]);
        setRecommendedCompositions(rows.map(mapComposition));
      } catch (error) {
        console.error("[marketplace] recommendation fetch failed:", error);
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

      const matchesDifficulty =
        difficultyFilter === "all" || comp.difficulty === difficultyFilter;
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
        matchesDifficulty &&
        matchesLanguage &&
        matchesAccompaniment &&
        matchesCategory
      );
    });
  }, [
    accompanimentFilter,
    categoryFilter,
    compositions,
    difficultyFilter,
    languageFilter,
    searchTerm,
  ]);

  const handlePreferenceBoost = async (categoryId: number) => {
    if (!appUser?.id) {
      toast.info("Sign in to personalize your recommendations.");
      return;
    }

    setPreferenceSavingCategoryId(categoryId);
    try {
      await fypService.updatePreferences(appUser.id, categoryId, 1);
      toast.success("Preference saved. Recommendations updated.");
      const payload = await fypService.getRecommendations(appUser.id, 6);
      const rows = ensureArray<any>(payload, ["recommendations"]);
      setRecommendedCompositions(rows.map(mapComposition));
    } catch (error: any) {
      console.error("[marketplace] preference update failed:", error);
      toast.error(error?.message || "Failed to update recommendation preference");
    } finally {
      setPreferenceSavingCategoryId(null);
    }
  };

  return (
    <div className="section-shell">
      <div className="route-backdrop-panel route-backdrop-panel-strong mb-10 overflow-hidden rounded-2xl border border-white/15 bg-card/20 p-8 text-white shadow-[0_20px_40px_-30px_rgba(15,23,42,0.7)] dark:border-white/10 dark:bg-card/25">
        <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
          Music Hub
        </span>
        <h1 className="mt-4 text-4xl font-semibold">Discover Choral Music</h1>
        <p className="mt-3 max-w-2xl text-white/85">
          Browse, filter, and personalize your discovery feed using the same
          backend recommendation and category services that power buyer data.
        </p>
      </div>

      {appUser ? (
        <div className="route-backdrop-panel mb-8 overflow-hidden rounded-2xl border border-white/45 bg-card/35 p-6 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)] dark:border-white/10 dark:bg-card/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                <Sparkles className="size-3.5" />
                Recommended For You
              </div>
              <h2 className="mt-3 text-2xl font-semibold">Buyer suggestions</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                This section is now wired to the backend recommendation endpoint
                and buyer preference updates.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 6).map((category) => (
                <Button
                  key={category.id}
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

          <div className="mt-6">
            {recommendationsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading recommendations...
              </div>
            ) : recommendedCompositions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No personalized recommendations yet. Pick a preferred category to
                seed them.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {recommendedCompositions.map((composition) => (
                  <CompositionCard
                    key={`recommended-${composition.id}`}
                    composition={composition}
                    onAddToCart={onAddToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="mb-8 rounded-2xl border border-border/70 bg-card p-6 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search compositions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white pl-10"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
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

          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="Easy">Easy</SelectItem>
              <SelectItem value="Intermediate">Intermediate</SelectItem>
              <SelectItem value="Advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>

          <Select value={languageFilter} onValueChange={setLanguageFilter}>
            <SelectTrigger>
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
            <SelectTrigger>
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

        {(searchTerm ||
          categoryFilter !== "all" ||
          difficultyFilter !== "all" ||
          languageFilter !== "all" ||
          accompanimentFilter !== "all") && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setCategoryFilter("all");
                setDifficultyFilter("all");
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

      {!loading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompositions.map((composition) => (
            <CompositionCard
              key={composition.id}
              composition={composition}
              onAddToCart={onAddToCart}
            />
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
                setDifficultyFilter("all");
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
  );
}

export default Marketplace;
