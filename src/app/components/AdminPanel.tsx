import { useEffect, useState } from 'react';
import { Users, Music, DollarSign, TrendingUp, MoreVertical, Ban, CheckCircle, Eye, Loader } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCompositions, setTotalCompositions] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);

        const { count: usersCount, error: uErr } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true });
        if (uErr) throw uErr;
        setTotalUsers(usersCount || 0);

        const { count: compCount, error: cErr } = await supabase
          .from('compositions')
          .select('id', { count: 'exact', head: true });
        if (cErr) throw cErr;
        setTotalCompositions(compCount || 0);

        // Sum revenue and transactions
        const { data: revenueData, error: rErr } = await supabase
          .from('purchases')
          .select('price_paid', { count: 'exact' });
        if (rErr) throw rErr;
        const revenue = (revenueData || []).reduce((s: number, p: any) => s + (p.price_paid || 0), 0);
        setTotalRevenue(revenue);
        setTotalTransactions((revenueData || []).length);
      } catch (err) {
        console.error('Failed to load admin stats:', err);
        toast.error('Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const [composerStats, setComposerStats] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchMore = async () => {
      try {
        // Composer stats: join composers -> users and count compositions and purchases
        const { data: composers, error: compErr } = await supabase
          .from('composers')
          .select(`id, user_id, users(display_name, email)`);
        if (compErr) throw compErr;

        const stats = [] as any[];
        for (const comp of composers || []) {
          const { data: compositions } = await supabase
            .from('compositions')
            .select('id')
            .eq('composer_id', comp.id)
            .eq('deleted', false);

          const compIds = (compositions || []).map((c: any) => c.id);
          const { data: sales } = await supabase
            .from('purchases')
            .select('price_paid')
            .in('composition_id', compIds || [])
            .eq('is_active', true);

          const revenue = (sales || []).reduce((s: number, p: any) => s + (p.price_paid || 0), 0);
          stats.push({
            id: comp.id,
            display_name: comp.users?.display_name || comp.users?.email || 'Unknown',
            compositionCount: (compositions || []).length,
            salesCount: (sales || []).length,
            revenue,
          });
        }

        setComposerStats(stats);

        // Recent transactions
        const { data: recent, error: recentErr } = await supabase
          .from('purchases')
          .select('*, compositions(*), buyers(*)')
          .order('purchased_at', { ascending: false })
          .limit(10);
        if (recentErr) throw recentErr;
        setRecentTransactions(recent || []);
      } catch (err) {
        console.error('Failed to load composer stats or transactions:', err);
      }
    };

    fetchMore();
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
        <p className="text-gray-600">Manage platform operations and monitor activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Users</CardTitle>
            <Users className="size-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
            <p className="text-xs text-gray-500 mt-1">
              {mockUsers.filter(u => u.role === 'composer').length} composers,{' '}
              {mockUsers.filter(u => u.role === 'buyer').length} buyers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Compositions</CardTitle>
            <Music className="size-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCompositions}</div>
            <p className="text-xs text-gray-500 mt-1">Published works</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            <DollarSign className="size-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-gray-500 mt-1">Platform earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Transactions</CardTitle>
            <TrendingUp className="size-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-gray-500 mt-1">Total sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="compositions">Compositions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Top Composers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Composers</CardTitle>
              <CardDescription>Highest earning composers on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Composer</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Compositions</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {composerStats
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5)
                    .map(composer => (
                      <TableRow key={composer.id}>
                        <TableCell className="font-medium">{composer.name}</TableCell>
                        <TableCell className="text-gray-600">{composer.email}</TableCell>
                        <TableCell className="text-right">{composer.compositionCount}</TableCell>
                        <TableCell className="text-right">{composer.salesCount}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${composer.revenue.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest purchases on the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Composition</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTransactions.map(transaction => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.purchaseDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{transaction.buyer?.name}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{transaction.composition?.title}</p>
                          <p className="text-sm text-gray-500">
                            by {transaction.composition?.composerName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${transaction.price.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage platform users and their roles</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="size-3 mr-1" />
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="size-4 mr-2" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Ban className="size-4 mr-2" />
                              Suspend User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compositions Tab */}
        <TabsContent value="compositions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Compositions</CardTitle>
              <CardDescription>Manage and moderate published compositions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Composer</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCompositions.map(composition => (
                    <TableRow key={composition.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{composition.title}</p>
                          <p className="text-sm text-gray-500">
                            {composition.voiceParts.join(', ')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{composition.composerName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{composition.difficulty}</Badge>
                      </TableCell>
                      <TableCell>${composition.price.toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(composition.dateAdded).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="size-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Ban className="size-4 mr-2" />
                              Remove Listing
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>Complete transaction history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Composition</TableHead>
                    <TableHead>Composer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockPurchases
                    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
                    .map(purchase => {
                      const composition = mockCompositions.find(c => c.id === purchase.compositionId);
                      const buyer = mockUsers.find(u => u.id === purchase.buyerId);
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-mono text-sm">{purchase.id}</TableCell>
                          <TableCell>
                            {new Date(purchase.purchaseDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{buyer?.name}</TableCell>
                          <TableCell className="font-medium">{composition?.title}</TableCell>
                          <TableCell>{composition?.composerName}</TableCell>
                          <TableCell className="text-right font-semibold">
                            ${purchase.price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
