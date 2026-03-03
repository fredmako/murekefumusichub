"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Music,
  DollarSign,
  TrendingUp,
  MoreVertical,
  Ban,
  CheckCircle,
  Eye,
  Loader,
  Plus,
  Check,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { adminService } from "@/services/adminService";
import { compositionService } from "@/services/api";

/* --------- CONFIG --------- */
const normalizeEmail = (e: string) => e?.toLowerCase().trim() ?? "";
const rolePriority: Record<string, number> = {
  buyer: 1,
  composer: 2,
  admin: 3,
};

function getInitials(displayName?: string | null, email?: string | null) {
  const source = (displayName || email || "U").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/* --------- TYPES --------- */
type UserRoleMap = Record<string, string>; // user_id -> primaryRoleString
type DataLoadLevel = "none" | "preview" | "full";

export function AdminPanel() {
  const navigate = useNavigate();

  const { appUser, isLoading: authLoading } = useAuth();

  // requests
  const [requests, setRequests] = useState<any[]>([]);

  // data
  const [users, setUsers] = useState<any[]>([]);
  const [compositions, setCompositions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);

  // stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCompositions, setTotalCompositions] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  // UI
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [compositionsLoading, setCompositionsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [compositionsLoadLevel, setCompositionsLoadLevel] =
    useState<DataLoadLevel>("none");
  const [transactionsLoadLevel, setTransactionsLoadLevel] =
    useState<DataLoadLevel>("none");
  const isProcessing = Boolean(processingAction);

  const runAction = async (key: string, fn: () => Promise<void>) => {
    if (processingAction) return;
    setProcessingAction(key);
    try {
      await fn();
    } finally {
      setProcessingAction(null);
    }
  };

  /* ---------------- guard admin access & initial load ---------------- */
  useEffect(() => {
    if (authLoading) return;

    if (!appUser) {
      navigate("/", { replace: true });
      return;
    }

    if (!appUser?.roles || !appUser.roles.includes("admin")) {
      toast.error("Access denied.");
      navigate("/", { replace: true });
      return;
    }

    // Initial load
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, appUser?.auth_uid, appUser?.roles?.join(",")]);

  /* ---------------- fetch all admin data ---------------- */
  const fetchAll = async () => {
    setLoading(true);
    try {
      const bootstrap = await adminService.fetchBootstrap();
      setInvites(bootstrap?.invites || []);
      setRequests(bootstrap?.requests || []);

      const stats = bootstrap?.stats || {};
      setTotalUsers(stats.totalUsers || 0);
      setTotalCompositions(stats.totalCompositions || 0);
      setTotalRevenue(stats.totalRevenue || 0);
      setTotalTransactions(stats.totalTransactions || 0);
    } catch (err: any) {
      console.error("AdminPanel fetchAll error:", err);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }

    // Non-blocking fetches to improve first paint
    void fetchUsers();
    void fetchOverviewData();
    void fetchExactStats();
  };

  const fetchUsers = async (force = false) => {
    if (usersLoading) return;
    if (!force && usersLoaded) return;
    setUsersLoading(true);
    try {
      const data = await adminService.fetchUsers();
      setUsers(data?.users || []);
      setUserRoles(data?.userRoles || []);
      setUsersLoaded(true);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCompositions = async (full = false, force = false) => {
    if (compositionsLoading) return;
    const targetLevel: DataLoadLevel = full ? "full" : "preview";
    if (!force) {
      if (targetLevel === "preview" && compositionsLoadLevel !== "none") return;
      if (targetLevel === "full" && compositionsLoadLevel === "full") return;
    }

    setCompositionsLoading(true);
    try {
      const data = await adminService.fetchCompositions({
        limit: full ? 1000 : 60,
      });
      setCompositions(data || []);
      setCompositionsLoadLevel(targetLevel);
    } finally {
      setCompositionsLoading(false);
    }
  };

  const fetchTransactions = async (full = false, force = false) => {
    if (transactionsLoading) return;
    const targetLevel: DataLoadLevel = full ? "full" : "preview";
    if (!force) {
      if (targetLevel === "preview" && transactionsLoadLevel !== "none") return;
      if (targetLevel === "full" && transactionsLoadLevel === "full") return;
    }

    setTransactionsLoading(true);
    try {
      const data = await adminService.fetchTransactions({
        limit: full ? 1000 : 60,
      });
      setTransactions(data || []);
      setTransactionsLoadLevel(targetLevel);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchInvites = async () => {
    const data = await adminService.fetchInvites();
    setInvites(data || []);
  };

  const fetchRequests = async () => {
    const data = await adminService.fetchRequests();
    setRequests(data || []);
  };

  /* ---------------- compute summary stats ---------------- */
  const fetchExactStats = async () => {
    try {
      const stats = await adminService.fetchStats();
      setTotalUsers(stats.totalUsers || 0);
      setTotalCompositions(stats.totalCompositions || 0);
      setTotalRevenue(stats.totalRevenue || 0);
      setTotalTransactions(stats.totalTransactions || 0);
    } catch (err) {
      console.error("fetchExactStats error:", err);
    }
  };

  const fetchOverviewData = async () => {
    if (overviewLoading) return;
    setOverviewLoading(true);
    try {
      await Promise.all([fetchCompositions(false), fetchTransactions(false)]);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (activeTab === "overview") {
      void fetchOverviewData();
    }
    if (activeTab === "users") {
      void fetchUsers();
    }
    if (activeTab === "compositions") {
      void fetchCompositions(true);
    }
    if (activeTab === "transactions") {
      void fetchTransactions(true);
    }
    if (activeTab === "requests" && requests.length === 0) {
      void fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loading]);

  /* ---------------- utility: build role maps ---------------- */
  const userIdToRole = useMemo((): UserRoleMap => {
    const map: UserRoleMap = {};
    const applyRole = (userId: string, roleName: string) => {
      if (!userId || !roleName) return;
      const current = map[userId];
      if (!current) {
        map[userId] = roleName;
        return;
      }
      const currentPriority = rolePriority[current] || 0;
      const nextPriority = rolePriority[roleName] || 0;
      if (nextPriority > currentPriority) {
        map[userId] = roleName;
      }
    };

    // prefer users.role column if present
    users.forEach((u: any) => {
      // if there's a role field on user table, use it (string)
      if (u.role) applyRole(u.id, u.role);
      // if roles array exists, choose priority: admin > composer > buyer
      if (Array.isArray(u.roles) && u.roles.length > 0) {
        if (u.roles.includes("admin")) applyRole(u.id, "admin");
        else if (u.roles.includes("composer")) applyRole(u.id, "composer");
        else if (u.roles.includes("buyer")) applyRole(u.id, "buyer");
      }
    });

    // then override / supplement with user_roles mapping (if exists)
    userRoles.forEach((ur: any) => {
      const roleName = ur?.roles?.name || ur?.role_name || null;
      if (roleName) {
        applyRole(ur.user_id, roleName);
      }
    });

    // default everyone to 'buyer' if not set
    users.forEach((u: any) => {
      if (!map[u.id]) map[u.id] = "buyer";
    });

    return map;
  }, [users, userRoles]);

  // Filter to show only pending requests in the admin panel
  const pendingRequests = useMemo(() => {
    return (requests || []).filter(
      (r: any) => r.status === "pending" || !r.status,
    );
  }, [requests]);

  /* ---------------- actions ---------------- */
  async function addComposerInvite(email: string) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      toast.error("Enter a valid email");
      return;
    }

    await runAction("invite:add", async () => {
      await adminService.addComposerInvite(normalized, appUser?.id || "");
      setNewInviteEmail("");
      await fetchInvites();
    });
  }

  async function revokeInvite(email: string) {
    const normalized = normalizeEmail(email);
    await runAction(`invite:revoke:${normalized}`, async () => {
      await adminService.revokeInvite(normalized);
      await fetchInvites();
    });
  }

  async function promoteUserToComposer(userId: string) {
    await runAction(`user:promote-composer:${userId}`, async () => {
      await adminService.promoteUserToComposer(userId);
      await Promise.all([fetchUsers(true), fetchRequests(), fetchExactStats()]);
    });
  }

  async function promoteUserToAdmin(userId: string) {
    await runAction(`user:promote-admin:${userId}`, async () => {
      await adminService.promoteUserToAdmin(userId);
      await Promise.all([fetchUsers(true), fetchRequests(), fetchExactStats()]);
    });
  }

  async function suspendUser(userId: string) {
    await runAction(`user:suspend:${userId}`, async () => {
      await adminService.suspendUser(userId);
      await fetchUsers(true);
    });
  }

  async function approveRequest(request: any) {
    const userId = request?.user_id || request?.id;
    const requestedRole =
      request?.requested_role === "admin" || request?.requestedRole === "admin"
        ? "admin"
        : "composer";

    if (!userId) {
      toast.error("Missing user id for request approval");
      return;
    }

    await runAction(`request:approve:${userId}:${requestedRole}`, async () => {
      if (requestedRole === "admin") {
        await adminService.promoteUserToAdmin(userId);
      } else {
        await adminService.promoteUserToComposer(userId);
      }
      toast.success(`Approved ${requestedRole} request for ${request?.email || "user"}`);
      await Promise.all([fetchUsers(true), fetchRequests(), fetchExactStats()]);
    });
  }

  async function rejectRequest(request: any) {
    const userId =
      typeof request === "string" ? request : request?.user_id || request?.id;
    const requestedRole =
      request?.requested_role === "admin" || request?.requestedRole === "admin"
        ? "admin"
        : "composer";

    if (!userId) {
      toast.error("Missing user id for request rejection");
      return;
    }

    await runAction(`request:reject:${userId}:${requestedRole}`, async () => {
      await adminService.rejectRoleRequest(userId, requestedRole);
      await Promise.all([fetchRequests(), fetchUsers(true)]);
    });
  }

  async function approvePaymentSubmission(submissionId: string) {
    await runAction(`payment:approve:${submissionId}`, async () => {
      await adminService.approvePaymentSubmission(submissionId);
      await Promise.all([fetchTransactions(true, true), fetchExactStats()]);
    });
  }

  async function rejectPaymentSubmission(submissionId: string) {
    await runAction(`payment:reject:${submissionId}`, async () => {
      await adminService.rejectPaymentSubmission(submissionId);
      await Promise.all([fetchTransactions(true, true), fetchExactStats()]);
    });
  }

  async function removeComposition(composition: any) {
    const compositionId = composition?.id;
    if (!compositionId) {
      toast.error("Missing composition id");
      return;
    }

    await runAction(`composition:remove:${compositionId}`, async () => {
      await adminService.removeComposition(compositionId);
      await Promise.all([fetchCompositions(true, true), fetchExactStats()]);
    });
  }

  async function viewCompositionDetails(composition: any) {
    try {
      const compositionId = composition?.id;
      if (!compositionId) {
        toast.info("No composition ID found");
        return;
      }

      const latest = (await compositionService.getById(compositionId)) as any;
      const pdfUrl =
        latest?.pdf_url || composition?.pdf_url || composition?.pdfUrl || null;

      if (pdfUrl) {
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
        return;
      }

      toast.info("No PDF URL found for this composition");
    } catch (error: any) {
      console.error("[admin-panel] open composition failed:", error);
      toast.error(error?.message || "Failed to open composition PDF");
    }
  }

  /* ---------------- composer stats derived from compositions/purchases ---------------- */
  const composerStats = useMemo(() => {
    // build map composerId -> stats
    const map = new Map<
      string,
      {
        id: string;
        display_name: string;
        compositionCount: number;
        salesCount: number;
        revenue: number;
      }
    >();

    // initialize composers from compositions list
    compositions.forEach((c: any) => {
      const compId = c.composer_id || c.composer?.id;
      const display = c.composers?.users?.display_name || "Unknown";
      if (!compId) return;
      if (!map.has(compId)) {
        map.set(compId, {
          id: compId,
          display_name: display,
          compositionCount: 0,
          salesCount: 0,
          revenue: 0,
        });
      }
      const st = map.get(compId)!;
      st.compositionCount += 1;
    });

    // aggregate purchases
    transactions.forEach((p: any) => {
      if (p.status && p.status !== "approved") return;
      const compId =
        p.composition_id || p.compositions?.id || p.compositions?.composer_id;
      const price = Number(p.price_paid || 0);
      if (!compId) return;
      if (!map.has(compId)) {
        map.set(compId, {
          id: compId,
          display_name: "Unknown",
          compositionCount: 0,
          salesCount: 0,
          revenue: 0,
        });
      }
      const st = map.get(compId)!;
      st.salesCount += 1;
      st.revenue += price;
    });

    // convert to array and sort by revenue
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [compositions, transactions]);

  /* ---------------- UI helpers ---------------- */
  const composerCount = useMemo(() => {
    const vals = Object.values(userIdToRole);
    return vals.filter((r) => r === "composer").length;
  }, [userIdToRole]);

  const buyerCount = useMemo(() => {
    const vals = Object.values(userIdToRole);
    return vals.filter((r) => r === "buyer").length;
  }, [userIdToRole]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3">
          <Loader className="animate-spin" />
          <span>Loading admin panel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-gray-600">
          Manage platform operations and monitor activity
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-600">Total Users</CardTitle>
            <Users className="size-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
            <p className="text-xs text-gray-500 mt-1">
              {composerCount} composers, {buyerCount} buyers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-600">
              Total Compositions
            </CardTitle>
            <Music className="size-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCompositions}</div>
            <p className="text-xs text-gray-500 mt-1">Published works</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-600">
              Total Revenue
            </CardTitle>
            <DollarSign className="size-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              ${Number(totalRevenue || 0).toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Platform earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-sm text-gray-600">
              Transactions
            </CardTitle>
            <TrendingUp className="size-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-gray-500 mt-1">Total sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Invite composer */}
      <Card>
        <CardHeader>
          <CardTitle>Add Composer Invite</CardTitle>
          <CardDescription>
            Enter an email to allow that user to register as composer
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2 items-center">
          <input
            className="flex-1 px-3 py-2 border rounded"
            placeholder="composer@example.com"
            value={newInviteEmail}
            onChange={(e) => setNewInviteEmail(e.target.value)}
            disabled={isProcessing}
          />
          <Button
            onClick={() => addComposerInvite(newInviteEmail)}
            disabled={isProcessing}
          >
            <Plus className="mr-2" /> Add Invite
          </Button>
        </CardContent>
        {invites.length > 0 && (
          <CardContent>
            <div className="text-sm text-gray-600 mb-2">Recent invites</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv: any) => (
                  <TableRow key={inv.email || inv.id}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{inv.invitedBy || "admin"}</TableCell>
                    <TableCell>
                      {new Date(
                        inv.createdAt || inv.created_at || "",
                      ).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeInvite(inv.email || inv.id)}
                        disabled={isProcessing}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>

      {/* TABS */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
        <TabsList className="grid grid-cols-5 gap-2">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="compositions">Compositions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Composers</CardTitle>
              <CardDescription>Highest earning composers</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Composer</TableHead>
                    <TableHead className="text-right">Compositions</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overviewLoading && composerStats.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500">
                        Loading composer analytics...
                      </TableCell>
                    </TableRow>
                  )}
                  {composerStats.slice(0, 10).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.display_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.compositionCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.salesCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${Number(c.revenue || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Latest purchases on the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Composition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsLoading && transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        Loading recent transactions...
                      </TableCell>
                    </TableRow>
                  )}
                  {transactions.slice(0, 10).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        {new Date(
                          t.purchased_at || t.purchasedAt || "",
                        ).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {t.buyers?.users?.display_name ||
                          t.buyers?.users?.email ||
                          "Unknown"}
                      </TableCell>
                      <TableCell>
                        {t.compositions?.title || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            t.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : t.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                          }
                        >
                          {(t.status || "approved").toString().toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${Number(t.price_paid || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Manage platform users and roles</CardDescription>
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
                  {usersLoading && users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        Loading users...
                      </TableCell>
                    </TableRow>
                  )}
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={`${u.display_name || u.email || "User"} avatar`}
                              className="size-9 rounded-full object-cover border border-border/70 bg-muted"
                              loading="lazy"
                            />
                          ) : (
                            <div className="size-9 rounded-full border border-border/70 bg-secondary/60 text-secondary-foreground grid place-items-center text-xs font-semibold">
                              {getInitials(u.display_name, u.email)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {u.display_name || "N/A"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {userIdToRole[u.id] || "buyer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active !== false ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="size-3 mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            Suspended
                          </Badge>
                        )}
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

                            <DropdownMenuItem
                              onClick={() => promoteUserToComposer(u.id)}
                              disabled={isProcessing}
                            >
                              Promote to Composer
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => promoteUserToAdmin(u.id)}
                              disabled={isProcessing}
                            >
                              Promote to Admin
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => suspendUser(u.id)}
                              disabled={isProcessing}
                            >
                              <Ban className="size-4 mr-2" /> Suspend User
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

        {/* Requests */}
        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Composer Requests</CardTitle>
              <CardDescription>
                Pending composer access requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-gray-600">No pending requests.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Requested At</TableHead>
                      <TableHead>Requested Role</TableHead>
                      <TableHead>Current Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((r) => (
                      <TableRow
                        key={`${r.request_id || r.id || r.user_id}:${r.requested_role || r.requestedRole || "composer"}`}
                      >
                        <TableCell>{r.email}</TableCell>
                        <TableCell>
                          {new Date(
                            r.created_at || r.createdAt || "",
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {(r.requested_role || r.requestedRole || "composer")
                            .toString()
                            .charAt(0)
                            .toUpperCase() +
                            (r.requested_role || r.requestedRole || "composer")
                              .toString()
                              .slice(1)}
                        </TableCell>
                        <TableCell>
                          {Array.isArray(r.roles)
                            ? r.roles.join(", ")
                            : r.roles || userIdToRole[r.user_id || r.id] || "buyer"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveRequest(r)}
                              disabled={isProcessing}
                            >
                              <Check className="mr-2" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectRequest(r)}
                              disabled={isProcessing}
                            >
                              <X className="mr-2" /> Reject
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
        </TabsContent>

        {/* Compositions */}
        <TabsContent value="compositions" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Compositions</CardTitle>
              <CardDescription>
                Manage and moderate published compositions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Composer</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compositionsLoading && compositions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
                        Loading compositions...
                      </TableCell>
                    </TableRow>
                  )}
                  {compositions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.title}</p>
                          <p className="text-sm text-gray-500">
                            {c.description || ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.composers?.users?.display_name || "Unknown"}
                      </TableCell>
                      <TableCell>${Number(c.price || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {new Date(
                          c.created_at || c.createdAt || "",
                        ).toLocaleDateString()}
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
                            <DropdownMenuItem
                              onClick={() => viewCompositionDetails(c)}
                            >
                              <Eye className="size-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => removeComposition(c)}
                              disabled={isProcessing}
                            >
                              <Ban className="size-4 mr-2" /> Remove Listing
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

        {/* Transactions */}
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
                    <TableHead>Payment Ref</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactionsLoading && transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500">
                        Loading transactions...
                      </TableCell>
                    </TableRow>
                  )}
                  {transactions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">
                        {p.transaction_id || p.id}
                      </TableCell>
                      <TableCell>
                        {new Date(
                          p.purchased_at || p.purchasedAt || "",
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {p.buyers?.users?.display_name ||
                          p.buyers?.users?.email ||
                          "Unknown"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.compositions?.title || "Unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.payment_ref || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            p.status === "pending"
                              ? "bg-amber-100 text-amber-800"
                              : p.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-green-100 text-green-800"
                          }
                        >
                          {(p.status || "approved").toString().toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${Number(p.price_paid || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.source === "payment_submission" &&
                        p.status === "pending" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                approvePaymentSubmission(
                                  p.payment_submission_id || p.transaction_id,
                                )
                              }
                              disabled={isProcessing}
                            >
                              <Check className="mr-2" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                rejectPaymentSubmission(
                                  p.payment_submission_id || p.transaction_id,
                                )
                              }
                              disabled={isProcessing}
                            >
                              <X className="mr-2" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
