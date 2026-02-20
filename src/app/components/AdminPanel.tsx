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
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

/* --------- CONFIG --------- */
const ADMIN_IDENTIFIERS = ["fredrickmakori102@gmail.com", "murekefumusichub"];
const normalizeEmail = (e: string) => e?.toLowerCase().trim() ?? "";
const isAdminEmail = (email?: string | null) => {
  if (!email) return false;
  const e = normalizeEmail(email);
  return ADMIN_IDENTIFIERS.some((id) => e === id || e.includes(id));
};

/* --------- TYPES --------- */
type RoleMap = Record<number, string>;
type UserRoleMap = Record<string, string>; // user_id -> primaryRoleString

export function AdminPanel() {
  const navigate = useNavigate();

  // auth user (firebase)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);

  // requests
  const [requests, setRequests] = useState<any[]>([]);

  // data
  const [users, setUsers] = useState<any[]>([]);
  const [compositions, setCompositions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
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
  const [processing, setProcessing] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState("");

  /* ---------------- auth protection ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setCurrentUserEmail(null);
        setCurrentUserUid(null);
        // if not logged in, redirect to login page
        navigate("/", { replace: true });
        return;
      }
      setCurrentUserEmail(normalizeEmail(u.email || ""));
      setCurrentUserUid(u.uid || null);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- guard admin access & initial load ---------------- */
  useEffect(() => {
    // Wait until we know currentUserEmail
    if (currentUserEmail === null) return;

    if (!isAdminEmail(currentUserEmail)) {
      // Not allowed
      toast.error("Access denied.");
      navigate("/", { replace: true });
      return;
    }

    // Make sure supabase client exists
    if (!supabase) {
      toast.error("Supabase not configured.");
      setLoading(false);
      return;
    }

    // Initial load
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserEmail]);

  /* ---------------- fetch all admin data ---------------- */
  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchRoles(),
        fetchUsers(),
        fetchCompositions(),
        fetchTransactions(),
        fetchInvites(),
        fetchRequests(),
      ]);
      await computeStats();
    } catch (err: any) {
      console.error("AdminPanel fetchAll error:", err);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("roles").select("*");
    if (error) {
      console.warn("roles fetch error:", error);
      return;
    }
    setRoles(data || []);
  };

  const fetchUsers = async () => {
    if (!supabase) return;
    // fetch users
    const { data: usersData, error } = await supabase.from("users").select("*");
    if (error) {
      console.warn("users fetch error:", error);
      console.log("Error details:", error.code, error.message, error.hint);
      return;
    }
    console.log("[AdminPanel] Fetched users:", usersData);
    setUsers(usersData || []);

    // fetch user_roles mapping as well (if your schema uses it)
    const { data: urData, error: urErr } = await supabase
      .from("user_roles")
      .select("*");
    if (!urErr) {
      console.log("[AdminPanel] Fetched user_roles:", urData);
      setUserRoles(urData || []);
    } else {
      console.warn("user_roles fetch error:", urErr);
    }
  };

  const fetchCompositions = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("compositions")
      .select(
        `
        *,
        composers (
          id,
          user_id,
          users ( display_name, email )
        )
      `,
      )
      .eq("deleted", false)
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("compositions fetch error:", error);
      return;
    }
    setCompositions(data || []);
  };

  const fetchTransactions = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("purchases")
      .select(
        `
        *,
        compositions ( title, composer_id ),
        buyers (
          id,
          user_id,
          users ( display_name, email )
        )
      `,
      )
      .order("purchased_at", { ascending: false })
      .limit(200);
    if (error) {
      console.warn("purchases fetch error:", error);
      return;
    }
    setTransactions(data || []);
  };

  const fetchInvites = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("role_requests")
      .select("*")
      .order("createdAt", { ascending: false });
    if (error) {
      // try alternate table name if different casing
      const alt = await supabase.from("role_requests").select("*");
      if (!alt.error) {
        setInvites(alt.data || []);
        return;
      }
      console.warn("role_requests fetch error:", error);
      return;
    }
    setInvites(data || []);
  };

  const fetchRequests = async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("users")
      .select("id, email, roles, composer_request, created_at")
      .eq("composer_request", true)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("composer requests fetch error:", error);
      setRequests([]);
      return;
    }
    setRequests(data || []);
  };

  /* ---------------- compute summary stats ---------------- */
  const computeStats = async () => {
    try {
      if (!supabase) return;
      // counts using head queries
      const { count: uCount } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true });
      const { count: cCount } = await supabase
        .from("compositions")
        .select("id", { count: "exact", head: true });

      // purchases details
      const { data: purchases } = await supabase
        .from("purchases")
        .select("price_paid");
      const revenue = (purchases || []).reduce(
        (s: number, p: any) => s + (p.price_paid || 0),
        0,
      );

      setTotalUsers(uCount || 0);
      setTotalCompositions(cCount || 0);
      setTotalRevenue(revenue || 0);
      setTotalTransactions((purchases || []).length || 0);
    } catch (err) {
      console.error("computeStats error:", err);
    }
  };

  /* ---------------- utility: build role maps ---------------- */
  const roleIdToName = useMemo((): RoleMap => {
    const map: RoleMap = {};
    roles.forEach((r: any) => {
      map[r.id] = r.name;
    });
    return map;
  }, [roles]);

  const userIdToRole = useMemo((): UserRoleMap => {
    const map: UserRoleMap = {};
    // prefer users.role column if present
    users.forEach((u: any) => {
      // if there's a role field on user table, use it (string)
      if (u.role) map[u.id] = u.role;
      // if roles array exists, choose priority: admin > composer > buyer
      if (Array.isArray(u.roles) && u.roles.length > 0) {
        if (u.roles.includes("admin")) map[u.id] = "admin";
        else if (u.roles.includes("composer")) map[u.id] = "composer";
        else if (u.roles.includes("buyer")) map[u.id] = "buyer";
      }
    });

    // then override / supplement with user_roles mapping (if exists)
    userRoles.forEach((ur: any) => {
      const roleName = roleIdToName[ur.role_id];
      if (roleName) {
        map[ur.user_id] = roleName;
      }
    });

    // default everyone to 'buyer' if not set
    users.forEach((u: any) => {
      if (!map[u.id]) map[u.id] = "buyer";
    });

    return map;
  }, [users, userRoles, roleIdToName]);

  // Debug: Log users whenever they change
  useEffect(() => {
    console.log("[AdminPanel] Users state updated:", users);
    console.log("[AdminPanel] Users count:", users.length);
  }, [users]);

  /* ---------------- actions ---------------- */
  async function addComposerInvite(email: string) {
    if (!supabase) {
      toast.error("Supabase not configured");
      return;
    }
    const normalized = normalizeEmail(email);
    if (!normalized) {
      toast.error("Enter a valid email");
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        email: normalized,
        invitedBy: currentUserUid,
        createdAt: new Date().toISOString(),
        used: false,
      };

      const { error } = await supabase
        .from("role_requests")
        .upsert([payload], { onConflict: "email" });
      if (error) throw error;

      toast.success("Composer invite added");
      setNewInviteEmail("");
      await fetchInvites();
    } catch (err: any) {
      console.error("addComposerInvite error:", err);
      toast.error(err.message || "Failed to add invite");
    } finally {
      setProcessing(false);
    }
  }

  async function revokeInvite(email: string) {
    if (!supabase) return;
    setProcessing(true);
    try {
      const normalized = normalizeEmail(email);
      const { error } = await supabase
        .from("role_requests")
        .delete()
        .eq("email", normalized);
      if (error) throw error;
      toast.success("Invite revoked");
      await fetchInvites();
    } catch (err: any) {
      console.error("revokeInvite error:", err);
      toast.error("Failed to revoke invite");
    } finally {
      setProcessing(false);
    }
  }

  async function promoteUserToComposer(userId: string) {
    if (!supabase) return;
    setProcessing(true);
    try {
      const hasRoleColumn =
        users.length > 0 &&
        Object.prototype.hasOwnProperty.call(users[0], "role");
      const hasRolesArray = users.length > 0 && Array.isArray(users[0].roles);

      if (hasRoleColumn) {
        const { error } = await supabase
          .from("users")
          .update({ role: "composer", composer_request: false })
          .eq("id", userId);
        if (error) throw error;
        toast.success("User promoted to composer");
      } else if (hasRolesArray) {
        // fetch current roles for user
        const u = users.find((x) => x.id === userId);
        const curRoles = Array.isArray(u?.roles) ? u.roles : ["buyer"];
        const updated = Array.from(new Set([...curRoles, "composer"]));
        const { error } = await supabase
          .from("users")
          .update({ roles: updated, composer_request: false })
          .eq("id", userId);
        if (error) throw error;
        toast.success("User promoted to composer");
      } else {
        // fallback to user_roles table approach
        const composerRole = roles.find((r: any) => r.name === "composer");
        if (!composerRole) {
          toast.error("Composer role not found in roles table");
          return;
        }
        const payload = { user_id: userId, role_id: composerRole.id };
        const { error } = await supabase
          .from("user_roles")
          .upsert([payload], { onConflict: "user_id, role_id" });
        if (error) throw error;
        // clear composer_request flag on users table if exists by id
        await supabase
          .from("users")
          .update({ composer_request: false })
          .eq("id", userId);
        toast.success("User promoted to composer (user_roles)");
      }

      // ensure composers table has a row for this user (avoid duplicates)
      const { data: existing } = await supabase
        .from("composers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) {
        const { error: compErr } = await supabase
          .from("composers")
          .insert([{ user_id: userId }]);
        if (compErr) console.warn("composer insert warning:", compErr);
      }

      await fetchUsers();
      await fetchRequests();
    } catch (err: any) {
      console.error("promoteUserToComposer error:", err);
      toast.error("Failed to promote user");
    } finally {
      setProcessing(false);
    }
  }

  async function promoteUserToAdmin(userId: string) {
    if (!supabase) return;
    setProcessing(true);
    try {
      const hasRoleColumn =
        users.length > 0 &&
        Object.prototype.hasOwnProperty.call(users[0], "role");
      const hasRolesArray = users.length > 0 && Array.isArray(users[0].roles);

      if (hasRoleColumn) {
        const { error } = await supabase
          .from("users")
          .update({ role: "admin" })
          .eq("id", userId);
        if (error) throw error;
        toast.success("User promoted to admin");
      } else if (hasRolesArray) {
        const u = users.find((x) => x.id === userId);
        const curRoles = Array.isArray(u?.roles) ? u.roles : ["buyer"];
        const updated = Array.from(new Set([...curRoles, "admin"]));
        const { error } = await supabase
          .from("users")
          .update({ roles: updated })
          .eq("id", userId);
        if (error) throw error;
        toast.success("User promoted to admin");
      } else {
        const adminRole = roles.find((r: any) => r.name === "admin");
        if (!adminRole) {
          toast.error("Admin role not found");
          return;
        }
        const payload = { user_id: userId, role_id: adminRole.id };
        const { error } = await supabase
          .from("user_roles")
          .upsert([payload], { onConflict: "user_id, role_id" });
        if (error) throw error;
        toast.success("User promoted to admin (user_roles)");
      }
      await fetchUsers();
    } catch (err: any) {
      console.error("promoteUserToAdmin error:", err);
      toast.error("Failed to promote user");
    } finally {
      setProcessing(false);
    }
  }

  async function suspendUser(userId: string) {
    if (!supabase) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ is_active: false })
        .eq("id", userId);
      if (error) throw error;
      toast.success("User suspended");
      await fetchUsers();
    } catch (err: any) {
      console.error("suspendUser error:", err);
      toast.error("Failed to suspend user");
    } finally {
      setProcessing(false);
    }
  }

  async function approveRequest(user: any) {
    if (!supabase) return;
    setProcessing(true);
    try {
      await promoteUserToComposer(user.id);
      toast.success(`Approved composer request for ${user.email}`);
      await fetchRequests();
    } catch (err: any) {
      console.error("approveRequest error:", err);
      toast.error("Failed to approve request");
    } finally {
      setProcessing(false);
    }
  }

  async function rejectRequest(userId: string) {
    if (!supabase) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ composer_request: false })
        .eq("id", userId);
      if (error) throw error;
      toast.success("Request rejected");
      await fetchRequests();
    } catch (err: any) {
      console.error("rejectRequest error:", err);
      toast.error("Failed to reject request");
    } finally {
      setProcessing(false);
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
            disabled={processing}
          />
          <Button
            onClick={() => addComposerInvite(newInviteEmail)}
            disabled={processing}
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
                        disabled={processing}
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
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.display_name || "N/A"}
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
                            >
                              Promote to Composer
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => promoteUserToAdmin(u.id)}
                            >
                              Promote to Admin
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => suspendUser(u.id)}
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
              {requests.length === 0 ? (
                <p className="text-sm text-gray-600">No pending requests.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Requested At</TableHead>
                      <TableHead>Current Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.email}</TableCell>
                        <TableCell>
                          {new Date(
                            r.created_at || r.createdAt || "",
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {Array.isArray(r.roles)
                            ? r.roles.join(", ")
                            : r.roles || "buyer"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => approveRequest(r)}
                              disabled={processing}
                            >
                              <Check className="mr-2" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectRequest(r.id)}
                              disabled={processing}
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
                            <DropdownMenuItem>
                              <Eye className="size-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
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
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">
                        {p.id}
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
                      <TableCell className="text-right font-semibold">
                        ${Number(p.price_paid || 0).toFixed(2)}
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
