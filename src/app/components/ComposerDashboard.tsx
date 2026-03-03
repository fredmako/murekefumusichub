import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
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
import { supabase } from "@/lib/supabase";
import { compositionService } from "@/services/api";
import { toast } from "sonner";

interface ComposerDashboardProps {
  currentUser?: any;
}

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
  composition_stats: {
    views: number;
    purchases: number;
  }[];
}

interface ComposerStats {
  composerCompositions: CompositionWithStats[];
  totalRevenue: number;
  totalSales: number;
  loading: boolean;
}

export function ComposerDashboard({ currentUser }: ComposerDashboardProps) {
  const { appUser } = useAuth();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const previousUploadOpen = useRef(false);
  const [selectedComposition, setSelectedComposition] =
    useState<CompositionWithStats | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: "",
    is_published: true,
  });
  const [stats, setStats] = useState<ComposerStats>({
    composerCompositions: [],
    totalRevenue: 0,
    totalSales: 0,
    loading: true,
  });

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
          composition_stats(views, purchases)
        `,
        )
        .eq("composer_id", composerData.id)
        .eq("deleted", false);

      if (compError) throw compError;

      // Get total sales and revenue
      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases")
        .select("price_paid")
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

  // Redirect to home on logout
  useEffect(() => {
    if (appUser === null) {
      // using window.location to ensure full app redirect
      window.location.href = "/";
    }
  }, [appUser]);

  const { composerCompositions, totalRevenue, totalSales, loading } = stats;

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
    });
    setIsEditOpen(true);
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
        is_published: editForm.is_published,
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
      `Delete "${composition.title}"? This will remove it from the marketplace.`,
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Composer Dashboard</h1>
          <p className="text-gray-600">
            Manage your compositions and track your sales
          </p>
        </div>
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="size-5 mr-2" />
              Upload New Composition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload New Composition</DialogTitle>
              <DialogDescription>
                Add a new choral composition to the marketplace
              </DialogDescription>
            </DialogHeader>
            <UploadComposition onClose={() => setIsUploadOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedComposition?.title || "Composition"}</DialogTitle>
            <DialogDescription>Composition details and performance.</DialogDescription>
          </DialogHeader>
          {selectedComposition && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                {selectedComposition.description || "No description provided."}
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Price</p>
                  <p className="font-medium">${Number(selectedComposition.price || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium">
                    {selectedComposition.is_published ? "Published" : "Draft"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Difficulty</p>
                  <p className="font-medium">{selectedComposition.difficulty || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Language</p>
                  <p className="font-medium">{selectedComposition.language || "-"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Views</p>
                  <p className="font-medium">
                    {selectedComposition.composition_stats?.[0]?.views || 0}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Purchases</p>
                  <p className="font-medium">
                    {selectedComposition.composition_stats?.[0]?.purchases || 0}
                  </p>
                </div>
              </div>
              {selectedComposition.pdf_url && (
                <Button
                  variant="outline"
                  onClick={() => void handleOpenPdf()}
                >
                  Open PDF Score
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Composition</DialogTitle>
            <DialogDescription>Update listing details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm mb-1">Title</p>
              <Input
                value={editForm.title}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, title: e.target.value }))
                }
                disabled={saveLoading}
              />
            </div>
            <div>
              <p className="text-sm mb-1">Description</p>
              <Textarea
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={saveLoading}
              />
            </div>
            <div>
              <p className="text-sm mb-1">Price (USD)</p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editForm.price}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, price: e.target.value }))
                }
                disabled={saveLoading}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editForm.is_published}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    is_published: e.target.checked,
                  }))
                }
                disabled={saveLoading}
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
                  <Loader className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Revenue
            </CardTitle>
            <DollarSign className="size-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">
              From {totalSales} sales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Published Works
            </CardTitle>
            <Music className="size-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {composerCompositions.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">Active compositions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Price
            </CardTitle>
            <TrendingUp className="size-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              $
              {composerCompositions.length > 0
                ? (
                    composerCompositions.reduce((sum, c) => sum + c.price, 0) /
                    composerCompositions.length
                  ).toFixed(2)
                : "0.00"}
            </div>
            <p className="text-xs text-gray-500 mt-1">Average listing price</p>
          </CardContent>
        </Card>
      </div>

      {/* Compositions Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Compositions</CardTitle>
          <CardDescription>
            Manage and track performance of your published works
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <Loader className="size-8 text-gray-400 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">Loading your compositions...</p>
            </div>
          ) : composerCompositions.length === 0 ? (
            <div className="text-center py-12">
              <Music className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">
                You haven't uploaded any compositions yet.
              </p>
              <Button onClick={() => setIsUploadOpen(true)}>
                <Plus className="size-4 mr-2" />
                Upload Your First Composition
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Purchases</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {composerCompositions.map((comp) => {
                  const compStats = comp.composition_stats?.[0] || {
                    views: 0,
                    purchases: 0,
                  };
                  return (
                    <TableRow key={comp.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{comp.title}</p>
                          <p className="text-sm text-gray-500">
                            {comp.description?.substring(0, 50)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>${comp.price.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {compStats.views}
                      </TableCell>
                      <TableCell className="text-right">
                        {compStats.purchases}
                      </TableCell>
                      <TableCell>
                        {new Date(comp.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={comp.is_published ? "default" : "secondary"}
                        >
                          {comp.is_published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
