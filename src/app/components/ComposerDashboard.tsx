import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  DollarSign,
  Music,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
  Loader,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { Textarea } from "@/app/components/ui/textarea";
import { UploadComposition } from "@/app/components/UploadComposition";
import { SupportIssueButton } from "@/app/components/SupportIssueButton";
import { supabase } from "@/lib/supabase";
import { compositionService } from "@/services/api";
import { toast } from "sonner";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { formatKesAmount } from "@/lib/currency";

interface CompositionWithStats {
  id: string;
  title: string;
  description: string;
  price: number;
  created_at: string;
  updated_at?: string;
  is_published: boolean;
  difficulty?: string;
  duration?: string;
  language?: string;
  accompaniment?: string;
  voice_parts?: string[];
  pdf_url?: string;
  category_id?: number | null;
  categories?: { name?: string | null } | null;
  category_name?: string | null;
  composition_stats: {
    views: number;
    purchases: number;
  }[];
}

interface ComposerStats {
  composerCompositions: CompositionWithStats[];
  totalRevenue: number;
  totalSales: number;
  purchases: Array<{ composition_id?: string | null; price_paid?: number | null }>;
  loading: boolean;
}

export function ComposerDashboard() {
  const { appUser, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const previousUploadOpen = useRef(false);
  const compositionsSectionRef = useRef<HTMLDivElement | null>(null);
  const [selectedComposition, setSelectedComposition] =
    useState<CompositionWithStats | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: "",
    is_published: true,
    difficulty: "",
    duration: "",
    language: "",
    accompaniment: "",
    voice_parts: [] as string[],
  });
  const [stats, setStats] = useState<ComposerStats>({
    composerCompositions: [],
    totalRevenue: 0,
    totalSales: 0,
    purchases: [],
    loading: true,
  });
  const resolveCategoryTab = () => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab === "arrangements" || tab === "compositions") return tab;
    return "all";
  };
  const [activeCategory, setActiveCategory] = useState<
    "all" | "arrangements" | "compositions"
  >(resolveCategoryTab());

  // Function to fetch composer data
  const fetchComposerData = async () => {
    try {
      if (!appUser?.auth_uid) {
        toast.error("Not authenticated");
        return;
      }

      // Step 1: Get user's UUID from auth UID
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_uid", appUser.auth_uid)
        .maybeSingle();

      if (userError || !userData) {
        toast.error("User profile not found");
        setStats((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Step 2: Get composer record by user UUID
      const { data: composerData, error: composerError } = await supabase
        .from("composers")
        .select("id")
        .eq("user_id", userData.id)
        .single();

      if (composerError || !composerData) {
        toast.error("Composer profile not found");
        setStats((prev) => ({ ...prev, loading: false }));
        return;
      }

      // Get composer's compositions with stats
      const { data: compositions, error: compError } = await supabase
        .from("compositions")
        .select(
          `
          id,
          title,
          description,
          price,
          created_at,
          updated_at,
          is_published,
          difficulty,
          duration,
          language,
          accompaniment,
          voice_parts,
          pdf_url,
          category_id,
          categories(name),
          composition_stats(views, purchases)
        `,
        )
        .eq("composer_id", composerData.id)
        .eq("deleted", false);

      if (compError) throw compError;

      // Get total sales and revenue
      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases")
        .select("price_paid, composition_id")
        .in("composition_id", compositions?.map((c) => c.id) || [])
        .eq("is_active", true);

      if (purchaseError) throw purchaseError;

      const totalRevenue =
        purchases?.reduce((sum, p) => sum + (p.price_paid || 0), 0) || 0;
      const totalSales = purchases?.length || 0;

      setStats({
        composerCompositions: compositions || [],
        totalRevenue,
        totalSales,
        purchases: purchases || [],
        loading: false,
      });
    } catch (error) {
      console.error("Error fetching composer data:", error);
      toast.error("Failed to load dashboard");
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchComposerData();
  }, [appUser?.auth_uid]);

  // Refetch when upload dialog transitions from open -> closed.
  useEffect(() => {
    if (previousUploadOpen.current && !isUploadOpen) {
      fetchComposerData();
    }
    previousUploadOpen.current = isUploadOpen;
  }, [isUploadOpen]);

  useEffect(() => {
    setActiveCategory(resolveCategoryTab());
  }, [location.search]);

  // Redirect unauthenticated users to login and preserve their original route.
  useEffect(() => {
    if (!authLoading && appUser === null) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [appUser, authLoading, location.hash, location.pathname, location.search, navigate]);

  const { composerCompositions, loading, purchases } = stats;
  const resolveCategoryName = (composition: CompositionWithStats) =>
    String(
      composition.categories?.name || composition.category_name || "",
    ).trim().toLowerCase();
  const filteredCompositions = composerCompositions.filter((composition) => {
    if (activeCategory === "all") return true;
    return resolveCategoryName(composition) === activeCategory;
  });
  const compositionIdSet = new Set(filteredCompositions.map((comp) => comp.id));
  const scopedPurchases =
    activeCategory === "all"
      ? purchases
      : purchases.filter((purchase) =>
          compositionIdSet.has(String(purchase.composition_id || "")),
        );
  const totalRevenue =
    scopedPurchases.reduce((sum, purchase) => sum + (purchase.price_paid || 0), 0) ||
    0;
  const totalSales = scopedPurchases.length;
  const publishedCount = filteredCompositions.filter(
    (composition) => composition.is_published,
  ).length;
  const averagePrice =
    filteredCompositions.length > 0
      ? filteredCompositions.reduce((sum, composition) => sum + composition.price, 0) /
        filteredCompositions.length
      : 0;
  const activeCategoryTitle =
    activeCategory === "arrangements"
      ? "My Arrangements"
      : activeCategory === "compositions"
        ? "My Compositions"
        : "My Works";
  const activeCategoryDescription =
    activeCategory === "arrangements"
      ? "Track your arrangement listings and performance."
      : activeCategory === "compositions"
        ? "Manage and track your original compositions."
        : "Track performance across your catalog.";
  const isArrangementsView = activeCategory === "arrangements";
  const isCompositionsView = activeCategory === "compositions";
  const heroBadge = isArrangementsView
    ? "Arrangements Workspace"
    : isCompositionsView
      ? "Compositions Workspace"
      : "My Works";
  const heroTitle = isArrangementsView
    ? "My Arrangements"
    : isCompositionsView
      ? "My Compositions"
      : "My Works";
  const heroDescription = isArrangementsView
    ? "Manage arrangement listings, update pricing, and monitor engagement."
    : isCompositionsView
      ? "Manage original compositions, update listings, and track performance."
      : "Manage your catalog, pricing, and performance in one place.";
  const entryLabel = isArrangementsView
    ? "Arrangement"
    : isCompositionsView
      ? "Composition"
      : "Work";
  const emptyStateMessage =
    activeCategory === "arrangements"
      ? "You have not uploaded any arrangements yet."
      : activeCategory === "compositions"
        ? "You have not uploaded any compositions yet."
        : "You have not uploaded any works yet.";
  const scrollToCompositions = () => {
    compositionsSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };
  const handleViewComposition = (composition: CompositionWithStats) => {
    setSelectedComposition(composition);
    setIsViewOpen(true);
  };

  const handleOpenEdit = (composition: CompositionWithStats) => {
    setSelectedComposition(composition);
    setEditForm({
      title: composition.title || "",
      description: composition.description || "",
      price: String(composition.price ?? 0),
      is_published: Boolean(composition.is_published),
      difficulty: composition.difficulty || "",
      duration: composition.duration || "",
      language: composition.language || "",
      accompaniment: composition.accompaniment || "",
      voice_parts: Array.isArray(composition.voice_parts)
        ? composition.voice_parts
        : [],
    });
    setIsEditOpen(true);
  };

  const updateEditField = <K extends keyof typeof editForm>(
    key: K,
    value: (typeof editForm)[K],
  ) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveEdit = async () => {
    if (!selectedComposition?.id) return;
    const parsedPrice = Number(editForm.price);
    if (!editForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      toast.error("Enter a valid non-negative price");
      return;
    }

    setSaveLoading(true);
    try {
      await compositionService.update(selectedComposition.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price: parsedPrice,
        price_currency: "KES",
        is_published: editForm.is_published,
        difficulty: editForm.difficulty || null,
        duration: editForm.duration || null,
        language: editForm.language || null,
        accompaniment: editForm.accompaniment || null,
        voice_parts: editForm.voice_parts,
      });

      toast.success("Composition updated");
      setIsEditOpen(false);
      setSelectedComposition(null);
      await fetchComposerData();
    } catch (error: any) {
      console.error("[composer-dashboard] update failed:", error);
      toast.error(error?.message || "Failed to update composition");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteComposition = async (composition: CompositionWithStats) => {
    const confirmed = window.confirm(
      `Delete "${composition.title}"? This will remove it from the marketplace and revoke access for buyers who own it.`,
    );
    if (!confirmed) return;

    setActionLoadingId(composition.id);
    try {
      await compositionService.delete(composition.id);
      toast.success("Composition deleted");
      await fetchComposerData();
    } catch (error: any) {
      console.error("[composer-dashboard] delete failed:", error);
      toast.error(error?.message || "Failed to delete composition");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenPdf = async () => {
    if (!selectedComposition?.id) return;

    try {
      const latest = (await compositionService.getById(
        selectedComposition.id,
      )) as any;
      const pdfUrl = latest?.pdf_url || selectedComposition.pdf_url;
      if (!pdfUrl) {
        toast.error("No PDF URL found for this composition");
        return;
      }

      window.open(pdfUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      console.error("[composer-dashboard] open PDF failed:", error);
      toast.error(error?.message || "Failed to open composition PDF");
    }
  };

  return (
    <section className="section-shell">
      <div className="space-y-8">
        <div className="route-backdrop-panel route-backdrop-panel-strong motion-reveal overflow-hidden rounded-3xl border border-white/15 bg-card/20 text-white shadow-[0_24px_44px_-30px_rgba(15,23,42,0.9)]">
          <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/95">
                {heroBadge}
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                {heroTitle}
              </h1>
              <p className="mt-3 text-sm text-white/85 sm:text-base">
                {heroDescription}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SupportIssueButton context="composer-dashboard" />
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-white text-[#0b4b56] shadow-[0_16px_30px_-20px_rgba(15,23,42,0.9)] hover:bg-white/90"
                  >
                    <Plus className="mr-2 size-5" />
                    Upload New {entryLabel}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto border-border/70 bg-card/95 sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload New {entryLabel}</DialogTitle>
                    <DialogDescription>
                      Add a new choral {entryLabel.toLowerCase()} to the
                      marketplace
                    </DialogDescription>
                  </DialogHeader>
                  <UploadComposition
                    onClose={() => setIsUploadOpen(false)}
                    defaultCategoryName={
                      isArrangementsView
                        ? "arrangements"
                        : isCompositionsView
                          ? "compositions"
                          : undefined
                    }
                    entryLabel={entryLabel}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
          <DialogContent className="border-border/70 bg-card/95 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedComposition?.title || "Composition"}
              </DialogTitle>
              <DialogDescription>
                Composition details and performance.
              </DialogDescription>
            </DialogHeader>
            {selectedComposition && (
              <div className="space-y-5">
                <p className="rounded-xl border border-border/60 bg-muted/45 p-4 text-sm leading-relaxed text-muted-foreground">
                  {selectedComposition.description || "No description provided."}
                </p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Price
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {formatKesAmount(Number(selectedComposition.price || 0))}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {selectedComposition.is_published ? "Published" : "Draft"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Difficulty
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {selectedComposition.difficulty || "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Language
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {selectedComposition.language || "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Views
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {selectedComposition.composition_stats?.[0]?.views || 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Purchases
                    </p>
                    <p className="mt-1 text-base font-semibold">
                      {selectedComposition.composition_stats?.[0]?.purchases || 0}
                    </p>
                  </div>
                </div>
                {selectedComposition.pdf_url && (
                  <Button variant="outline" onClick={() => void handleOpenPdf()}>
                    Open PDF Score
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto border-border/70 bg-card/95 sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Composition</DialogTitle>
              <DialogDescription>Update listing details.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Title
                </p>
                <Input
                  value={editForm.title}
                  onChange={(e) => updateEditField("title", e.target.value)}
                  disabled={saveLoading}
                  className="bg-background/80"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Description
                </p>
                <Textarea
                  value={editForm.description}
                  onChange={(e) => updateEditField("description", e.target.value)}
                  disabled={saveLoading}
                  className="min-h-[7rem] bg-background/80"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Price (KES)
                </p>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.price}
                  onChange={(e) => updateEditField("price", e.target.value)}
                  disabled={saveLoading}
                  className="bg-background/80"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Difficulty
                  </p>
                  <Input
                    value={editForm.difficulty}
                    onChange={(e) => updateEditField("difficulty", e.target.value)}
                    disabled={saveLoading}
                    className="bg-background/80"
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Duration
                  </p>
                  <Input
                    value={editForm.duration}
                    onChange={(e) => updateEditField("duration", e.target.value)}
                    disabled={saveLoading}
                    className="bg-background/80"
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Language
                  </p>
                  <Input
                    value={editForm.language}
                    onChange={(e) => updateEditField("language", e.target.value)}
                    disabled={saveLoading}
                    className="bg-background/80"
                  />
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium text-muted-foreground">
                    Accompaniment
                  </p>
                  <Input
                    value={editForm.accompaniment}
                    onChange={(e) =>
                      updateEditField("accompaniment", e.target.value)
                    }
                    disabled={saveLoading}
                    className="bg-background/80"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-muted-foreground">
                  Voice Parts (comma separated)
                </p>
                <Input
                  value={editForm.voice_parts.join(", ")}
                  onChange={(e) =>
                    updateEditField(
                      "voice_parts",
                      e.target.value
                        .split(",")
                        .map((part) => part.trim())
                        .filter(Boolean),
                    )
                  }
                  disabled={saveLoading}
                  className="bg-background/80"
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/45 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.is_published}
                  onChange={(e) =>
                    updateEditField("is_published", e.target.checked)
                  }
                  disabled={saveLoading}
                  className="size-4 rounded border-border"
                />
                Published
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={saveLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saveLoading}>
                {saveLoading ? (
                  <>
                    <Loader className="mr-2 size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card role="button" tabIndex={0} onClick={scrollToCompositions} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); scrollToCompositions(); } }} className="texture-speckle lift-card hover:cursor-pointer border-0 bg-gradient-to-br from-[#0f766e] to-[#0b4a52] text-white shadow-[0_24px_40px_-34px_rgba(15,23,42,0.95)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Total Revenue
              </CardTitle>
              <DollarSign className="size-5 text-white/95" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">
                {formatKesAmount(totalRevenue)}
              </div>
              <p className="mt-1 text-xs text-white/80">From {totalSales} sales</p>
            </CardContent>
          </Card>

          <Card role="button" tabIndex={0} onClick={scrollToCompositions} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); scrollToCompositions(); } }} className="texture-speckle lift-card hover:cursor-pointer border-0 bg-gradient-to-br from-[#174f3b] to-[#1f7a59] text-white shadow-[0_24px_40px_-34px_rgba(15,23,42,0.95)]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Published Works
              </CardTitle>
              <Music className="size-5 text-white/95" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">
                {publishedCount}
              </div>
              <p className="mt-1 text-xs text-white/80">
                {filteredCompositions.length - publishedCount} draft
                {filteredCompositions.length - publishedCount === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>

          <Card role="button" tabIndex={0} onClick={scrollToCompositions} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); scrollToCompositions(); } }} className="texture-speckle lift-card hover:cursor-pointer border-0 bg-gradient-to-br from-[#7c4a03] to-[#b45309] text-white shadow-[0_24px_40px_-34px_rgba(15,23,42,0.95)] sm:col-span-2 xl:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-white/90">
                Average Price
              </CardTitle>
              <TrendingUp className="size-5 text-white/95" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">
                {formatKesAmount(averagePrice)}
              </div>
              <p className="mt-1 text-xs text-white/80">
                Across {filteredCompositions.length} listing
                {filteredCompositions.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card ref={compositionsSectionRef} className="lift-card overflow-hidden border border-border/70 bg-card/95 shadow-[0_24px_38px_-32px_rgba(15,23,42,0.85)]">
          <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/12 via-secondary/20 to-transparent">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{activeCategoryTitle}</CardTitle>
                <CardDescription>{activeCategoryDescription}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <Loader className="mb-4 size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading your compositions...
                </p>
              </div>
            ) : filteredCompositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 rounded-full border border-border/70 bg-muted/50 p-5">
                  <Music className="size-8 text-muted-foreground" />
                </div>
                <p className="mb-5 max-w-md text-sm text-muted-foreground">
                  {emptyStateMessage}
                </p>
                <Button onClick={() => setIsUploadOpen(true)}>
                  <Plus className="mr-2 size-4" />
                  Upload Your First {entryLabel}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60 bg-muted/35">
                      <TableHead className="min-w-56">Title</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                      <TableHead className="text-right">Purchases</TableHead>
                      <TableHead>Date Added</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompositions.map((comp) => {
                      const compStats = comp.composition_stats?.[0] || {
                        views: 0,
                        purchases: 0,
                      };
                      const description =
                        comp.description?.trim() || "No description provided.";
                      const descriptionPreview =
                        description.length > 72
                          ? `${description.slice(0, 72)}...`
                          : description;

                      return (
                        <TableRow key={comp.id} className="border-border/45">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground">
                                {comp.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {descriptionPreview}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatKesAmount(comp.price)}
                          </TableCell>
                          <TableCell className="text-right">
                            {compStats.views}
                          </TableCell>
                          <TableCell className="text-right">
                            {compStats.purchases}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {new Date(comp.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                comp.is_published ? "default" : "secondary"
                              }
                            >
                              {comp.is_published ? "Published" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View"
                                onClick={() => handleViewComposition(comp)}
                                disabled={actionLoadingId === comp.id || saveLoading}
                              >
                                <Eye className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit"
                                onClick={() => handleOpenEdit(comp)}
                                disabled={actionLoadingId === comp.id || saveLoading}
                              >
                                <Edit className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => handleDeleteComposition(comp)}
                                disabled={actionLoadingId === comp.id || saveLoading}
                              >
                                {actionLoadingId === comp.id ? (
                                  <Loader className="size-4 animate-spin text-red-600" />
                                ) : (
                                  <Trash2 className="size-4 text-red-600" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

