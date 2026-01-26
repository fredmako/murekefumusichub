import { useState, useEffect } from 'react';
import { Plus, DollarSign, Music, TrendingUp, Eye, Edit, Trash2, Loader } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/components/ui/dialog';
import { Badge } from '@/app/components/ui/badge';
import { UploadComposition } from '@/app/components/UploadComposition';
import { User } from '@/app/App';
import { auth } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface ComposerDashboardProps {
  currentUser: User;
}

interface CompositionWithStats {
  id: string;
  title: string;
  description: string;
  price: number;
  created_at: string;
  is_published: boolean;
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
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [stats, setStats] = useState<ComposerStats>({
    composerCompositions: [],
    totalRevenue: 0,
    totalSales: 0,
    loading: true
  });

  useEffect(() => {
    const fetchComposerData = async () => {
      try {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          toast.error('Not authenticated');
          return;
        }

        // Get composer record by firebase UID
        const { data: composerData, error: composerError } = await supabase
          .from('composers')
          .select('id')
          .eq('user_id', firebaseUser.uid)
          .single();

        if (composerError || !composerData) {
          toast.error('Composer profile not found');
          setStats(prev => ({ ...prev, loading: false }));
          return;
        }

        // Get composer's compositions with stats
        const { data: compositions, error: compError } = await supabase
          .from('compositions')
          .select(`
            id,
            title,
            description,
            price,
            created_at,
            is_published,
            composition_stats(views, purchases)
          `)
          .eq('composer_id', composerData.id)
          .eq('deleted', false);

        if (compError) throw compError;

        // Get total sales and revenue
        const { data: purchases, error: purchaseError } = await supabase
          .from('purchases')
          .select('price_paid')
          .in('composition_id', compositions?.map(c => c.id) || [])
          .eq('is_active', true);

        if (purchaseError) throw purchaseError;

        const totalRevenue = purchases?.reduce((sum, p) => sum + (p.price_paid || 0), 0) || 0;
        const totalSales = purchases?.length || 0;

        setStats({
          composerCompositions: compositions || [],
          totalRevenue,
          totalSales,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching composer data:', error);
        toast.error('Failed to load dashboard');
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchComposerData();
  }, []);

  const { composerCompositions, totalRevenue, totalSales } = stats;

  // Get composition stats
  const compositionStats = composerCompositions.map(comp => {
    const sales = mockPurchases.filter(p => p.compositionId === comp.id);
    const revenue = sales.reduce((sum, sale) => sum + sale.price, 0);
    return {
      ...comp,
      salesCount: sales.length,
      revenue
    };
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Composer Dashboard</h1>
          <p className="text-gray-600">Manage your compositions and track your sales</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            <DollarSign className="size-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">From {totalSales} sales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Published Works</CardTitle>
            <Music className="size-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{composerCompositions.length}</div>
            <p className="text-xs text-gray-500 mt-1">Active compositions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Price</CardTitle>
            <TrendingUp className="size-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${composerCompositions.length > 0
                ? (composerCompositions.reduce((sum, c) => sum + c.price, 0) / composerCompositions.length).toFixed(2)
                : '0.00'
              }
            </div>
            <p className="text-xs text-gray-500 mt-1">Average listing price</p>
          </CardContent>
        </Card>
      </div>

      {/* Compositions Table */}
      <Card>
        <CardHeader>
          <CardTitle>My Compositions</CardTitle>
          <CardDescription>Manage and track performance of your published works</CardDescription>
        </CardHeader>
        <CardContent>
          {compositionStats.length === 0 ? (
            <div className="text-center py-12">
              <Music className="size-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">You haven't uploaded any compositions yet.</p>
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
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compositionStats.map(comp => (
                  <TableRow key={comp.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{comp.title}</p>
                        <p className="text-sm text-gray-500">{comp.voiceParts.join(', ')}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{comp.difficulty}</Badge>
                    </TableCell>
                    <TableCell>${comp.price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{comp.salesCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      ${comp.revenue.toFixed(2)}
                    </TableCell>
                    <TableCell>{new Date(comp.dateAdded).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
