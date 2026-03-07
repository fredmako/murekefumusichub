import { useState, useEffect } from "react";
import { Search, Filter } from "lucide-react";
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
import { compositionService } from "@/services/api";
import { toast } from "sonner";
import { ensureArray } from "@/lib/ensureArray";

interface Composition {
  id: string;
  title: string;
  composerName: string;
  price: number;
  description?: string;
  difficulty: string;
  duration: string;
  language: string;
  accompaniment: string;
  voiceParts: string[];
  pdfUrl?: string;
  createdAt: string;
  stats: {
    views: number;
    purchases: number;
  };
}

interface MarketplaceProps {
  onAddToCart?: (composition: Composition) => void;
}

export function Marketplace({ onAddToCart }: MarketplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [accompanimentFilter, setAccompanimentFilter] = useState<string>("all");
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch compositions from Supabase
  useEffect(() => {
    const fetchCompositions = async () => {
      try {
        setLoading(true);
        // Use public backend endpoint to avoid anon RLS issues and N+1 client queries.
        const compositionsPayload = await compositionService.getAll();
        const compositionsData = ensureArray<any>(compositionsPayload, ["compositions"]);
        const mapped = compositionsData.map((comp: any) => ({
          id: comp.id,
          title: comp.title,
          composerName: comp.composers?.users?.display_name || "Unknown Composer",
          price: Number(comp.price || 0),
          description: comp.description || "",
          difficulty: comp.difficulty || "Intermediate",
          duration: comp.duration || "",
          language: comp.language || "",
          accompaniment: comp.accompaniment || "",
          voiceParts: Array.isArray(comp.voice_parts) ? comp.voice_parts : [],
          pdfUrl: comp.pdf_url || undefined,
          createdAt: comp.created_at || "",
          stats: comp.composition_stats?.[0] || {
            views: 0,
            purchases: 0,
          },
        })) as Composition[];

        setCompositions(mapped);
      } catch (error) {
        console.error("Error fetching compositions:", error);
        toast.error("Failed to load compositions");
      } finally {
        setLoading(false);
      }
    };

    fetchCompositions();
  }, []);
  const filteredCompositions = compositions.filter((comp) => {
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
      comp.accompaniment === accompanimentFilter;

    return (
      matchesSearch &&
      matchesDifficulty &&
      matchesLanguage &&
      matchesAccompaniment
    );
  });

  return (
    <div className="section-shell">
      {/* Header */}
      <div className="mb-10 rounded-2xl border border-border/70 bg-gradient-to-r from-[#0d3e47] to-primary p-8 text-white shadow-[0_20px_40px_-30px_rgba(15,23,42,0.7)]">
        <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]">
          Music Hub
        </span>
        <h1 className="mt-4 text-4xl font-semibold">Discover Choral Music</h1>
        <p className="mt-3 max-w-2xl text-white/85">
          Browse and purchase high-quality choral compositions from talented
          composers worldwide
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8 rounded-2xl border border-border/70 bg-card p-6 shadow-[0_20px_30px_-28px_rgba(15,23,42,0.6)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search compositions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>

          {/* Difficulty Filter */}
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

          {/* Language Filter */}
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

          {/* Accompaniment Filter */}
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

        {/* Clear Filters */}
        {(searchTerm ||
          difficultyFilter !== "all" ||
          languageFilter !== "all" ||
          accompanimentFilter !== "all") && (
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setDifficultyFilter("all");
                setLanguageFilter("all");
                setAccompanimentFilter("all");
              }}
            >
              <Filter className="size-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="mb-4">
        <p className="text-sm font-medium text-muted-foreground">
          {loading
            ? "Loading compositions..."
            : `${filteredCompositions.length} composition${filteredCompositions.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-96 animate-pulse rounded-xl border border-border/60 bg-muted/60"
            ></div>
          ))}
        </div>
      )}

      {/* Compositions Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="text-center py-12">
          <p className="text-gray-500">
            {compositions.length === 0
              ? "No compositions available yet. Check back soon!"
              : "No compositions found matching your criteria."}
          </p>
          {compositions.length > 0 && (
            <Button
              variant="link"
              onClick={() => {
                setSearchTerm("");
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
