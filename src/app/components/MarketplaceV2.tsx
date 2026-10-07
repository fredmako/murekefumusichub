/**
 * MarketplaceV2
 * ------------------------------------------------------------------
 * Content-first redesign of the Murekefu Music Hub marketplace.
 *
 * Layout (mobile-first, no horizontal overflow):
 *   1. Simplified header  – logo, single search bar, bell, avatar
 *   2. Category chips      – horizontally scrollable
 *   3. Filter & Sort       – compact button -> bottom Sheet
 *   4. Featured arrangement
 *   5. Popular arrangements
 *   6. Recently added
 *   7. All arrangements
 *   8. Fixed mobile bottom nav (Home | Browse | Saved | Profile)
 *
 * All existing API calls, auth, search, filters, sorting, previews,
 * purchases and arrangement routes are preserved.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  Filter,
  Grid2x2,
  Heart,
  Home,
  LayoutGrid,
  List,
  Loader2,
  Music2,
  Play,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { MidiPreviewPlayer } from "@/app/components/MidiPreviewPlayer";
import {
  arrangementService,
  categoryService,
  compositionService,
  fypService,
} from "@/services/api";
import { ensureArray } from "@/lib/ensureArray";
import { formatKesAmount } from "@/lib/currency";
import { buildApiUrl } from "@/lib/apiBase";
import { parseAccompanimentList } from "@/lib/compositionMeta";
import { getOptimizedProfileImageUrl } from "@/services/profileImageService";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface MarketplaceItem {
  id: string;
  title: string;
  composerName: string;
  price: number;
  priceCurrency?: string | null;
  description?: string;
  difficulty?: string;
  duration?: string;
  language?: string;
  accompaniment: string[];
  voiceParts: string[];
  pdfUrl?: string;
  midiUrl?: string;
  thumbnailUrl?: string;
  createdAt?: string;
  categoryId?: number | null;
  categoryName?: string;
  isArrangement: boolean;
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

type SortMode =
  | "popular"
  | "newest"
  | "oldest"
  | "title"
  | "price-low"
  | "price-high";

type ViewMode = "grid" | "list";
type ViewSize = "compact" | "comfortable" | "large";
type ChipId = "all" | "arrangements" | "compositions";

interface MarketplaceV2Props {
  onAddToCart?: (composition: MarketplaceItem) => void;
}

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const ALLOWED_CATEGORY_NAMES = new Set(["arrangements", "compositions"]);

const isAllowedCategory = (
  category: Partial<CategoryOption> | null | undefined,
) =>
  ALLOWED_CATEGORY_NAMES.has(
    String(category?.name || "").trim().toLowerCase(),
  );

const CARD_GRADIENTS = [
  "from-violet-500/70 via-purple-600/70 to-indigo-800/80",
  "from-emerald-500/70 via-teal-600/70 to-cyan-800/80",
  "from-amber-500/70 via-orange-600/70 to-rose-800/80",
  "from-sky-500/70 via-blue-600/70 to-indigo-800/80",
  "from-fuchsia-500/70 via-pink-600/70 to-purple-800/80",
];

const gradientForIndex = (index: number) =>
  CARD_GRADIENTS[Math.abs(index) % CARD_GRADIENTS.length];

const LANGUAGE_OPTIONS = [
  "English",
  "Latin",
  "German",
  "French",
  "Swahili",
  "Italian",
  "Spanish",
];

const TYPE_OPTIONS = [
  "A cappella",
  "Piano",
  "Organ",
  "String Quartet",
  "Orchestra",
  "Guitar",
  "Brass",
];

const SAVED_STORAGE_KEY = "murekefu_marketplace_saved";

const CHIPS: Array<{ id: ChipId; label: string }> = [
  { id: "all", label: "All" },
  { id: "arrangements", label: "Arrangements" },
  { id: "compositions", label: "Compositions" },
];

/* ------------------------------------------------------------------ */
/* Data mapping                                                       */
/* ------------------------------------------------------------------ */

function mapComposition(comp: any): MarketplaceItem {
  const hasMidi = Boolean(comp?.midi_url);
  const id = comp?.id || comp?.composition_id || "";
  return {
    id: String(id),
    title: comp?.title || "Untitled",
    composerName:
      comp?.composer_name ||
      comp?.composers?.users?.display_name ||
      "Unknown Composer",
    price: Number(comp?.price || 0),
    priceCurrency: comp?.price_currency || "KES",
    description: comp?.description || "",
    difficulty: comp?.difficulty || "",
    duration: comp?.duration || "",
    language: comp?.language || "",
    accompaniment: parseAccompanimentList(comp?.accompaniment),
    voiceParts: Array.isArray(comp?.voice_parts) ? comp.voice_parts : [],
    pdfUrl: comp?.pdf_url || undefined,
    midiUrl: hasMidi ? buildApiUrl(`/compositions/${id}/midi`) : undefined,
    thumbnailUrl: comp?.thumbnail_url || comp?.thumbnailUrl || undefined,
    createdAt: comp?.created_at || "",
    categoryId:
      typeof comp?.category_id === "number" ? comp.category_id : null,
    categoryName: comp?.categories?.name || comp?.category_name || "",
    isArrangement: false,
    stats: comp?.composition_stats?.[0] || { views: 0, purchases: 0 },
  };
}

function mapArrangement(arr: any): MarketplaceItem {
  return {
    id: String(arr?.id || ""),
    title: arr?.title || "Untitled",
    composerName:
      arr?.arranger_name ||
      arr?.arrangers?.users?.display_name ||
      arr?.arranger ||
      "Arranger",
    price: Number(arr?.price || 0),
    priceCurrency: arr?.price_currency || "KES",
    description: arr?.description || "",
    difficulty: arr?.difficulty || "",
    duration: arr?.duration || "",
    language: arr?.language || "",
    accompaniment: parseAccompanimentList(arr?.accompaniment),
    voiceParts: Array.isArray(arr?.voice_parts) ? arr.voice_parts : [],
    pdfUrl: arr?.file_url || arr?.pdf_url || undefined,
    midiUrl: arr?.midi_url
      ? buildApiUrl(`/arrangements/${arr.id}/midi`)
      : undefined,
    thumbnailUrl: arr?.thumbnail_url || arr?.thumbnailUrl || undefined,
    createdAt: arr?.created_at || "",
    categoryId:
      typeof arr?.category_id === "number" ? arr.category_id : null,
    categoryName: arr?.categories?.name || arr?.category_name || "arrangements",
    isArrangement: true,
    stats: arr?.arrangement_stats?.[0] || {
      views: Number(arr?.views || 0),
      purchases: Number(arr?.purchases || 0),
    },
  };
}

function readSavedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Cover art                                                          */
/* ------------------------------------------------------------------ */

function CoverArt({
  item,
  index,
  className,
  iconClassName,
}: {
  item: MarketplaceItem;
  index: number;
  className?: string;
  iconClassName?: string;
}) {
  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt={`${item.title} cover art`}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${gradientForIndex(
        index,
      )} ${className ?? ""}`}
    >
      <Music2 className={`size-10 text-white/80 ${iconClassName ?? ""}`} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Arrangement / composition card                                     */
/* ------------------------------------------------------------------ */

function ItemCard({
  item,
  index,
  saved,
  onToggleSaved,
  onPreview,
  onView,
  layout = "grid",
}: {
  item: MarketplaceItem;
  index: number;
  saved: boolean;
  onToggleSaved: (item: MarketplaceItem) => void;
  onPreview: (item: MarketplaceItem) => void;
  onView: (item: MarketplaceItem) => void;
  onCheckout: (item: MarketplaceItem) => void;
  layout?: ViewMode;
}) {
  if (layout === "list") {
    return (
      <div className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
        <button
          type="button"
          onClick={() => onView(item)}
          className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl sm:h-20 sm:w-20"
          aria-label={`View ${item.title}`}
        >
          <CoverArt item={item} index={index} iconClassName="size-7" />
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onView(item)}
            className="block max-w-full text-left"
          >
            <h3 className="truncate text-sm font-semibold text-foreground sm:text-base">
              {item.title}
            </h3>
            <p className="truncate text-xs text-muted-foreground sm:text-sm">
              {item.composerName}
            </p>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
            <span className="font-semibold text-emerald-300">
              {formatKesAmount(item.price)}
            </span>
            {item.stats?.views > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Eye className="size-3" />
                {item.stats.views.toLocaleString()}
              </span>
            ) : null}
            {item.language ? <span>{item.language}</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-rose-300"
            onClick={() => onToggleSaved(item)}
            aria-label={saved ? "Remove from saved" : "Save"}
          >
            <Heart className={`size-4 ${saved ? "fill-rose-400 text-rose-400" : ""}`} />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-400"
            onClick={() => onPreview(item)}
            aria-label={`Preview ${item.title}`}
          >
            <Play className="size-4 fill-white" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="hidden sm:inline-flex"
            onClick={() => onCheckout(item)}
          >
            Buy
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10">
      <div className="relative aspect-square w-full overflow-hidden">
        <button
          type="button"
          onClick={() => onCheckout(item)}
          className="block h-full w-full"
          aria-label={`Buy ${item.title}`}
        >
          <CoverArt item={item} index={index} />
        </button>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleSaved(item);
          }}
          className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          aria-label={saved ? "Remove from saved" : "Save"}
        >
          <Heart className={`size-4 ${saved ? "fill-rose-400 text-rose-400" : ""}`} />
        </button>
        <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[10px] font-medium text-white backdrop-blur">
          <Play className="size-3 fill-white" />
          Preview
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">
            {item.title}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {item.isArrangement ? "Choral Arrangement" : "Choral Composition"}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-emerald-300">
            {formatKesAmount(item.price)}
          </span>
          {item.stats?.views > 0 ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Eye className="size-3" />
              {item.stats.views.toLocaleString()}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="flex-1 bg-emerald-500 hover:bg-emerald-400"
            onClick={() => onPreview(item)}
          >
            <Play className="size-3.5 fill-white" />
            Preview
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => onCheckout(item)}
          >
            Buy
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Featured arrangement card                                          */
/* ------------------------------------------------------------------ */

function FeaturedCard({
  item,
  saved,
  onToggleSaved,
  onPreview,
  onView,
  onCheckout,
}: {
  item: MarketplaceItem;
  saved: boolean;
  onToggleSaved: (item: MarketplaceItem) => void;
  onPreview: (item: MarketplaceItem) => void;
  onView: (item: MarketplaceItem) => void;
  onCheckout: (item: MarketplaceItem) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/40 via-purple-700/30 to-slate-950/60 shadow-[0_30px_60px_-40px_rgba(79,70,229,0.8)]">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative aspect-[16/10] w-full overflow-hidden md:aspect-auto md:h-full md:min-h-[260px]">
          <CoverArt item={item} index={0} iconClassName="size-16" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:bg-gradient-to-r" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
            <Sparkles className="size-3.5" />
            Featured
          </span>
        </div>

        <div className="flex flex-col justify-center gap-3 p-5 sm:p-6">
          <div>
            <h2 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.isArrangement ? "Choral Arrangement" : "Choral Composition"}
              {item.composerName && item.composerName !== "Arranger" && item.composerName !== "Unknown Composer" ? ` • ${item.composerName}` : ""}
            </p>
          </div>

          {item.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground/90">
              {item.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="text-lg font-semibold text-emerald-300">
              {formatKesAmount(item.price)}
            </span>
            {item.stats?.views > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="size-3.5" />
                {item.stats.views.toLocaleString()} views
              </span>
            ) : null}
            {item.language ? (
              <span className="text-xs text-muted-foreground">
                {item.language}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              className="bg-emerald-500 hover:bg-emerald-400"
              onClick={() => onPreview(item)}
            >
              <Play className="size-4 fill-white" />
              Preview
            </Button>
            <Button type="button" variant="outline" onClick={() => onCheckout(item)}>
              Buy Now
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full text-white/80 hover:text-rose-300"
              onClick={() => onToggleSaved(item)}
              aria-label={saved ? "Remove from saved" : "Save"}
            >
              <Heart className={`size-5 ${saved ? "fill-rose-400 text-rose-400" : ""}`} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section shell                                                      */
/* ------------------------------------------------------------------ */

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          {typeof count === "number" ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-muted-foreground">
              {count}
            </span>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */

export function MarketplaceV2({ onAddToCart }: MarketplaceV2Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { appUser } = useAuth();

  const forcedCategoryName = useMemo(() => {
    if (location.pathname === "/marketplace/arrangements") return "arrangements";
    if (location.pathname === "/marketplace/compositions") return "compositions";
    return null;
  }, [location.pathname]);

  const [compositions, setCompositions] = useState<MarketplaceItem[]>([]);
  const [arrangements, setArrangements] = useState<MarketplaceItem[]>([]);
  const [recommended, setRecommended] = useState<MarketplaceItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeChip, setActiveChip] = useState<ChipId>("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("popular");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [viewSize, setViewSize] = useState<ViewSize>("comfortable");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const [savedIds, setSavedIds] = useState<string[]>(() => readSavedIds());
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);
  const [detailFocus, setDetailFocus] = useState<"preview" | "detail">("detail");

  const itemLabelPlural = forcedCategoryName ?? "choral works";

  /* -------------------- data fetching -------------------- */

  useEffect(() => {
    let cancelled = false;

    const fetchMarketplaceData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [compositionsPayload, categoriesPayload] = await Promise.all([
          compositionService.getAll().catch(() => []),
          categoryService.getAll().catch(() => []),
        ]);

        if (cancelled) return;

        const compositionRows = ensureArray<any>(compositionsPayload, [
          "compositions",
        ]).map(mapComposition);

        const normalizedCategories = ensureArray<CategoryOption>(
          categoriesPayload,
        ).filter(isAllowedCategory);

        setCompositions(compositionRows);
        setCategories(normalizedCategories);

        if (forcedCategoryName === "arrangements") {
          try {
            const arrangementsPayload = await arrangementService.getAll();
            const arrangementRows = ensureArray<any>(arrangementsPayload, [
              "arrangements",
            ]).map(mapArrangement);
            if (!cancelled) setArrangements(arrangementRows);
          } catch (err) {
            console.error("[MarketplaceV2] arrangements fetch failed:", err);
          }
        }

        if (compositionRows.length === 0) {
          setError(null);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error("[MarketplaceV2] marketplace fetch failed:", err);
        setError("We couldn't load the marketplace right now.");
        toast.error("Failed to load marketplace");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchMarketplaceData();
    return () => {
      cancelled = true;
    };
  }, [forcedCategoryName]);

  useEffect(() => {
    if (!appUser?.id) {
      setRecommended([]);
      return;
    }
    let cancelled = false;

    const fetchRecommendations = async () => {
      try {
        setRecommendationsLoading(true);
        const payload = (await fypService.getRecommendations(
          appUser.id,
          6,
        )) as any;
        if (cancelled) return;
        const rows = ensureArray<any>(payload, ["recommendations"]).map(
          mapComposition,
        );
        setRecommended(rows);
      } catch (err) {
        if (cancelled) return;
        console.warn("[MarketplaceV2] recommendations unavailable:", err);
        setRecommended([]);
      } finally {
        if (!cancelled) setRecommendationsLoading(false);
      }
    };

    void fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [appUser?.id]);

  /* -------------------- saved (favorites) -------------------- */

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        SAVED_STORAGE_KEY,
        JSON.stringify(savedIds),
      );
    } catch {
      /* ignore quota / privacy errors */
    }
  }, [savedIds]);

  const toggleSaved = (item: MarketplaceItem) => {
    setSavedIds((prev) =>
      prev.includes(item.id)
        ? prev.filter((id) => id !== item.id)
        : [...prev, item.id],
    );
  };

  /* -------------------- derived pools -------------------- */

  const categoryRestricted = useMemo(() => {
    const source = forcedCategoryName === "arrangements" ? arrangements : compositions;
    if (!forcedCategoryName) {
      // /marketplace shows everything available.
      return [...arrangements, ...compositions];
    }
    return source.filter((item) => {
      const normalized = String(item.categoryName || "").trim().toLowerCase();
      return normalized === forcedCategoryName;
    });
  }, [arrangements, compositions, forcedCategoryName]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return categoryRestricted.filter((item) => {
      const matchesSearch =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.composerName.toLowerCase().includes(term) ||
        (item.description || "").toLowerCase().includes(term) ||
        (item.categoryName || "").toLowerCase().includes(term);

      const matchesLanguage =
        languageFilter === "all" || item.language === languageFilter;

      const matchesType =
        typeFilter === "all" || item.accompaniment.includes(typeFilter);

      const matchesCategory =
        categoryFilter === "all" ||
        String(item.categoryId || "") === categoryFilter;

      return matchesSearch && matchesLanguage && matchesType && matchesCategory;
    });
  }, [
    categoryRestricted,
    searchTerm,
    languageFilter,
    typeFilter,
    categoryFilter,
  ]);

  const sortedItems = useMemo(() => {
    const rows = [...filteredItems];
    switch (sortMode) {
      case "newest":
        return rows.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime(),
        );
      case "oldest":
        return rows.sort(
          (a, b) =>
            new Date(a.createdAt || 0).getTime() -
            new Date(b.createdAt || 0).getTime(),
        );
      case "title":
        return rows.sort((a, b) => a.title.localeCompare(b.title));
      case "price-low":
        return rows.sort((a, b) => a.price - b.price);
      case "price-high":
        return rows.sort((a, b) => b.price - a.price);
      case "popular":
      default:
        return rows.sort(
          (a, b) =>
            (b.stats?.purchases ?? 0) - (a.stats?.purchases ?? 0) ||
            (b.stats?.views ?? 0) - (a.stats?.views ?? 0),
        );
    }
  }, [filteredItems, sortMode]);

  const hasActiveFilters =
    Boolean(searchTerm.trim()) ||
    languageFilter !== "all" ||
    typeFilter !== "all" ||
    categoryFilter !== "all";

  // Product type chips (Arrangements / Compositions) filter the pool.
  const chipItems = useMemo(() => {
    if (activeChip === "all") return sortedItems;
    if (activeChip === "arrangements") return sortedItems.filter((item) => item.isArrangement);
    if (activeChip === "compositions") return sortedItems.filter((item) => !item.isArrangement);
    return sortedItems;
  }, [sortedItems, activeChip]);

  const showCuratedSections = !hasActiveFilters && activeChip === "all";

  /* -------------------- curated sections -------------------- */

  const featuredItem = useMemo(() => {
    if (chipItems.length === 0) return null;
    if (recommended.length > 0 && !hasActiveFilters) {
      const match = chipItems.find((item) =>
        recommended.some((rec) => rec.id === item.id),
      );
      if (match) return match;
    }
    return [...chipItems].sort(
      (a, b) =>
        (b.stats?.purchases ?? 0) - (a.stats?.purchases ?? 0) ||
        (b.stats?.views ?? 0) - (a.stats?.views ?? 0),
    )[0];
  }, [chipItems, recommended, hasActiveFilters]);

  const popularItems = useMemo(() => {
    const pool = chipItems.filter((item) => item.id !== featuredItem?.id);
    return [...pool]
      .sort(
        (a, b) =>
          (b.stats?.views ?? 0) - (a.stats?.views ?? 0) ||
          (b.stats?.purchases ?? 0) - (a.stats?.purchases ?? 0),
      )
      .slice(0, 8);
  }, [chipItems, featuredItem?.id]);

  const recentItems = useMemo(() => {
    const used = new Set([
      featuredItem?.id,
      ...popularItems.map((item) => item.id),
    ]);
    return chipItems
      .filter((item) => !used.has(item.id))
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      )
      .slice(0, 8);
  }, [chipItems, featuredItem?.id, popularItems]);

  const remainingItems = useMemo(() => {
    const used = new Set([
      featuredItem?.id,
      ...popularItems.map((item) => item.id),
      ...recentItems.map((item) => item.id),
    ]);
    return chipItems.filter((item) => !used.has(item.id));
  }, [chipItems, featuredItem?.id, popularItems, recentItems]);

  /* -------------------- chip handling -------------------- */

  const handleChipSelect = (chip: ChipId) => {
    setActiveChip(chip);
    setSortMode("popular");
  };

  /* -------------------- actions -------------------- */

  const handlePreview = (item: MarketplaceItem) => {
    setDetailFocus("preview");
    setDetailItem(item);
  };

  const handleView = (item: MarketplaceItem) => {
    setDetailFocus("detail");
    setDetailItem(item);
  };

  const handlePurchase = (item: MarketplaceItem) => {
    flushSync(() => {
      setDetailItem(null);
      if (onAddToCart) onAddToCart(item);
    });
    navigate("/checkout");
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setLanguageFilter("all");
    setTypeFilter("all");
    setCategoryFilter("all");
    setActiveChip("all");
  };

  const activeFilterCount =
    (languageFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0);

  const gridClass = useMemo(() => {
    if (viewMode === "list") return "grid grid-cols-1 gap-3";
    if (viewSize === "compact")
      return "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    if (viewSize === "large")
      return "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";
    return "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
  }, [viewMode, viewSize]);

  const renderGrid = (items: MarketplaceItem[], startIndex = 0) => (
    <div className={gridClass}>
      {items.map((item, i) => (
        <ItemCard
          key={item.id}
          item={item}
          index={index}
          saved={savedIds.includes(item.id)}
          onToggleSaved={toggleSaved}
          onPreview={handlePreview}
          onView={handleView}
          onCheckout={handlePurchase}
          layout={viewMode}
        />
      ))}
    </div>
  );

  const avatarUrl = getOptimizedProfileImageUrl(appUser?.avatar_url ?? null, {
    width: 80,
    height: 80,
  });

  const totalAvailable = categoryRestricted.length;

  /* -------------------- render -------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-950/30 via-background to-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:pb-10">
        {/* ---------------- HEADER ---------------- */}
        <header className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/marketplace"
              className="flex items-center gap-2"
              aria-label="Music Hub home"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
                <Music2 className="size-5" />
              </span>
              <span className="text-base font-bold tracking-tight sm:text-lg">
                Music Hub
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  appUser
                    ? navigate("/messenger")
                    : toast.info("Sign in to view notifications.")
                }
                className="relative flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-emerald-400" />
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(appUser ? "/manage-account" : "/login")
                }
                className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:text-foreground"
                aria-label="Profile"
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="size-4" />
                )}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search arrangements, songs, or arrangers..."
              className="h-11 border-white/15 bg-white/10 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
              aria-label="Search arrangements, songs, or arrangers"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-muted-foreground transition hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
        </header>

        {/* ---------------- CATEGORY CHIPS ---------------- */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CHIPS.map((chip) => {
              const active = activeChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleChipSelect(chip.id)}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Filter & Sort */}
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="relative inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-white/10"
            aria-label="Filter and sort"
          >
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">Filter &amp; Sort</span>
            {activeFilterCount > 0 ? (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* ---------------- CONTENT ---------------- */}
        <div className="mt-4 space-y-8">
          {loading ? (
            <div className={gridClass}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-64 animate-pulse rounded-2xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          ) : totalAvailable === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
              <Music2 className="mx-auto size-10 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">
                {error
                  ? error
                  : `No ${itemLabelPlural} available yet. Check back soon.`}
              </p>
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
              <Search className="mx-auto size-9 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">
                No {itemLabelPlural} found matching your criteria.
              </p>
              <Button
                variant="link"
                className="mt-1"
                onClick={clearAllFilters}
              >
                Clear all filters
              </Button>
            </div>
          ) : showCuratedSections ? (
            <>
              {/* Featured */}
              {featuredItem ? (
                <FeaturedCard
                  item={featuredItem}
                  saved={savedIds.includes(featuredItem.id)}
                  onToggleSaved={toggleSaved}
                  onPreview={handlePreview}
                  onView={handleView}
                  onCheckout={handlePurchase}
                />
              ) : null}

              {/* Popular */}
              {popularItems.length > 0 ? (
                <Section
                  title="Choral Arrangements"
                  icon={<TrendingUp className="size-5 text-emerald-400" />}
                  count={popularItems.length}
                >
                  {renderGrid(popularItems, 1)}
                </Section>
              ) : null}

              {/* Recently added */}
              {recentItems.length > 0 ? (
                <Section
                  title="Recently Added"
                  icon={<Clock className="size-5 text-sky-400" />}
                  count={recentItems.length}
                >
                  {renderGrid(recentItems, 5)}
                </Section>
              ) : null}

              {/* More / All */}
              {remainingItems.length > 0 ? (
                <Section
                  title={`More ${itemLabelPlural}`}
                  icon={<LayoutGrid className="size-5 text-violet-400" />}
                  count={remainingItems.length}
                >
                  {renderGrid(remainingItems, 9)}
                </Section>
              ) : null}
            </>
          ) : (
            <>
              <Section
                title="Search Results"
                icon={<Filter className="size-5 text-primary" />}
                count={chipItems.length}
              >
                {chipItems.length > 0 ? (
                  renderGrid(chipItems)
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/5 py-14 text-center">
                    <p className="text-sm text-muted-foreground">
                      No {itemLabelPlural} match your criteria.
                    </p>
                    <Button
                      variant="link"
                      className="mt-1"
                      onClick={clearAllFilters}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}
              </Section>
            </>
          )}

          {/* Recommendation hint */}
          {!loading && appUser && recommendationsLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Personalising your marketplace…
            </p>
          ) : null}
        </div>
      </div>

      {/* ---------------- FILTER & SORT SHEET ---------------- */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-white/10 bg-card/95 pb-8"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" />
              Filter &amp; Sort
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-5 px-4">
            {/* Category (only when not on a forced category route) */}
            {!forcedCategoryName && categories.length > 0 ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Category
                </label>
                <Select
                  value={categoryFilter}
                  onValueChange={setCategoryFilter}
                >
                  <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
                    <SelectValue placeholder="All Categories" />
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
              </div>
            ) : null}

            {/* Language */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Language
              </label>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
                  <SelectValue placeholder="All Languages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  {LANGUAGE_OPTIONS.map((language) => (
                    <SelectItem key={language} value={language}>
                      {language}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Type
              </label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Sort by
              </label>
              <Select
                value={sortMode}
                onValueChange={(value) => setSortMode(value as SortMode)}
              >
                <SelectTrigger className="border-white/10 bg-white/10 text-foreground">
                  <SelectValue placeholder="Sort results" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="title">Title A-Z</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                View
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                  <Button
                    type="button"
                    size="icon"
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    className="h-8 w-8 rounded-full"
                    onClick={() => setViewMode("list")}
                    aria-label="List view"
                  >
                    <List className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    className="h-8 w-8 rounded-full"
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="size-4" />
                  </Button>
                </div>

                {viewMode === "grid" ? (
                  <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
                    <Button
                      type="button"
                      size="icon"
                      variant={viewSize === "compact" ? "secondary" : "ghost"}
                      className="h-8 w-8 rounded-full"
                      onClick={() => setViewSize("compact")}
                      aria-label="Compact grid"
                    >
                      <Grid2x2 className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={
                        viewSize === "comfortable" ? "secondary" : "ghost"
                      }
                      className="h-8 w-8 rounded-full"
                      onClick={() => setViewSize("comfortable")}
                      aria-label="Comfortable grid"
                    >
                      <LayoutGrid className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant={viewSize === "large" ? "secondary" : "ghost"}
                      className="h-8 w-8 rounded-full"
                      onClick={() => setViewSize("large")}
                      aria-label="Large grid"
                    >
                      <Grid2x2 className="size-4 rotate-45" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={clearAllFilters}
              >
                Reset
              </Button>
              <Button
                className="flex-1"
                onClick={() => setFilterSheetOpen(false)}
              >
                Show {sortedItems.length} result
                {sortedItems.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ---------------- DETAIL / PREVIEW DIALOG ---------------- */}
      <Dialog
        open={Boolean(detailItem)}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
      >
        <DialogContent className="max-h-[88vh] w-[min(94vw,52rem)] max-w-[min(94vw,52rem)] overflow-y-auto border-border/70 bg-card/95 text-foreground dark:border-white/10 dark:bg-slate-950/95">
          {detailItem ? (
            <>
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl font-semibold">
                  {detailItem.title}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {detailItem.composerName}
                </p>
              </DialogHeader>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="relative aspect-[16/9] overflow-hidden rounded-xl border border-border/70 bg-muted/20 dark:border-white/10 dark:bg-white/5">
                    <CoverArt
                      item={detailItem}
                      index={0}
                      iconClassName="size-14"
                    />
                  </div>

                  {detailItem.midiUrl ? (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Preview
                      </p>
                      <MidiPreviewPlayer
                        midiUrl={detailItem.midiUrl}
                        previewRatio={0.33}
                        className="mt-3"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {detailFocus === "preview"
                        ? "Audio preview isn't available for this item yet."
                        : "MIDI preview not available for this item."}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Details
                    </p>
                    <div className="mt-3 grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-semibold text-emerald-300">
                          {formatKesAmount(detailItem.price)}
                        </span>
                      </div>
                      {detailItem.language ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Language</span>
                          <span>{detailItem.language}</span>
                        </div>
                      ) : null}
                      {detailItem.duration ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Duration</span>
                          <span>{detailItem.duration}</span>
                        </div>
                      ) : null}
                      {detailItem.difficulty ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Difficulty
                          </span>
                          <span>{detailItem.difficulty}</span>
                        </div>
                      ) : null}
                      {detailItem.voiceParts?.length ? (
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-muted-foreground">
                            Voice Parts
                          </span>
                          <span className="text-right">
                            {detailItem.voiceParts.join(", ")}
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Views</span>
                        <span>
                          {(detailItem.stats?.views ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {detailItem.description ? (
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-4 dark:border-white/10 dark:bg-white/5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Description
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {detailItem.description}
                      </p>
                    </div>
                  ) : null}

                  <Badge variant="secondary" className="capitalize">
                    {detailItem.isArrangement ? "Choral Arrangement" : "Choral Composition"}
                  </Badge>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" onClick={() => setDetailItem(null)}>
                  Close
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => toggleSaved(detailItem)}
                    aria-label={
                      savedIds.includes(detailItem.id)
                        ? "Remove from saved"
                        : "Save"
                    }
                  >
                    <Heart
                      className={`size-5 ${
                        savedIds.includes(detailItem.id)
                          ? "fill-rose-400 text-rose-400"
                          : ""
                      }`}
                    />
                  </Button>
                  <Button
                    className="gap-2"
                    onClick={() => handlePurchase(detailItem)}
                  >
                    <ShoppingBag className="size-4" />
                    Purchase &amp; Checkout
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ---------------- MOBILE BOTTOM NAV ---------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-background/95 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {[
            { label: "Home", icon: Home, path: "/marketplace" },
            { label: "Browse", icon: Compass, path: "/marketplace/arrangements" },
            { label: "Saved", icon: Heart, path: "/my-arrangements" },
            { label: "Profile", icon: User, path: "/manage-account" },
          ].map((entry) => {
            const Icon = entry.icon;
            const active =
              location.pathname === entry.path ||
              (entry.path === "/marketplace" &&
                location.pathname.startsWith("/marketplace/") &&
                location.pathname !== "/marketplace/arrangements");
            return (
              <Link
                key={entry.path}
                to={entry.path}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" />
                {entry.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}

export default MarketplaceV2;
