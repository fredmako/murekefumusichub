import { useState } from 'react';
import { Users, Music, DollarSign, TrendingUp, MoreVertical, Ban, CheckCircle, Eye } from 'lucide-react';
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
import { mockCompositions, mockPurchases, mockUsers } from '@/app/data/mockData';

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');

  // Calculate stats
  const totalUsers = mockUsers.length;
  const totalCompositions = mockCompositions.length;
  const totalRevenue = mockPurchases.reduce((sum, p) => sum + p.price, 0);
  const totalTransactions = mockPurchases.length;

  // Calculate composer stats
  const composerStats = mockUsers
    .filter(u => u.role === 'composer')
    .map(composer => {
      const compositions = mockCompositions.filter(c => c.composerId === composer.id);
      const sales = mockPurchases.filter(p =>
        compositions.some(c => c.id === p.compositionId)
      );
      const revenue = sales.reduce((sum, s) => sum + s.price, 0);
      return {
        ...composer,
        compositionCount: compositions.length,
        salesCount: sales.length,
        revenue
      };
    });

  // Recent transactions
  const recentTransactions = mockPurchases
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())
    .slice(0, 10)
    .map(purchase => {
      const composition = mockCompositions.find(c => c.id === purchase.compositionId);
      const buyer = mockUsers.find(u => u.id === purchase.buyerId);
      return {
        ...purchase,
        composition,
        buyer
      };
    });

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
