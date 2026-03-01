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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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

interface User {
  id: string;
  email: string;
  display_name: string;
}

interface MarketplaceProps {
  currentUser?: User;
  onAddToCart?: (composition: Composition) => void;
}

export function Marketplace({ currentUser, onAddToCart }: MarketplaceProps) {
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

        // Fetch published compositions with composer details
        const { data: compositionsData, error: compError } = await supabase
          .from("compositions")
          .select(
            `
            id,
            title,
            description,
            price,
            pdf_url,
            created_at,
            is_published,
            composer_id,
            composers(user_id),
            composition_stats(views, purchases)
          `,
          )
          .eq("is_published", true)
          .eq("deleted", false);

        if (compError) {
          console.error("Error fetching compositions:", compError);
          toast.error("Failed to load compositions");
          setLoading(false);
          return;
        }

        // Get composer details for each composition
        if (compositionsData && compositionsData.length > 0) {
          const compositionsWithComposers = await Promise.all(
            compositionsData.map(async (comp: any) => {
              // Get composer's user info
              const { data: composerUser } = await supabase
                .from("users")
                .select("display_name")
                .eq("id", comp.composers.user_id)
                .maybeSingle();

              return {
                id: comp.id,
                title: comp.title,
                composerName: composerUser?.display_name || "Unknown Composer",
                price: comp.price,
                description: comp.description,
                difficulty: "Intermediate", // Default value - will be available after migrations
                duration: "", // Default value - will be available after migrations
                language: "", // Default value - will be available after migrations
                accompaniment: "", // Default value - will be available after migrations
                voiceParts: [], // Default value - will be available after migrations
                pdfUrl: comp.pdf_url,
                createdAt: comp.created_at,
                stats: comp.composition_stats?.[0] || {
                  views: 0,
                  purchases: 0,
                },
              } as Composition;
            }),
          );

          setCompositions(compositionsWithComposers);
        } else {
          setCompositions([]);
        }
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
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Discover Choral Music</h1>
        <p className="text-gray-600">
          Browse and purchase high-quality choral compositions from talented
          composers worldwide
        </p>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-lg shadow-sm border mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder="Search compositions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
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
        <p className="text-gray-600">
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
              className="bg-gray-200 animate-pulse rounded-lg h-96"
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
