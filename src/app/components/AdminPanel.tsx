"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  MessageSquare,
  Send,
  Trash2,
  GraduationCap,
  Bell,
  ChevronDown,
  ChevronRight,
  MessageCircleMore,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Search,
  FileDown,
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
import { Input } from "@/app/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { Textarea } from "@/app/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { adminService } from "@/services/adminService";
import { compositionService } from "@/services/api";
import { SupportIssueButton } from "@/app/components/SupportIssueButton";
import { PdfFieldExportMenu } from "@/app/components/PdfFieldExportMenu";
import { supportService, type AdminThreadType } from "@/services/supportService";
import { getOptimizedProfileImageUrl } from "@/services/profileImageService";
import { supabase } from "@/lib/supabase";
import { ensureArray } from "@/lib/ensureArray";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { formatKesAmount } from "@/lib/currency";
import { exportTableReportToPdf } from "@/lib/pdfReports";
import loadingStringsDark from "./images/bg_9.jpg";
import loadingStringsLight from "./images/bg_11.jpg";

/* --------- CONFIG --------- */
const normalizeEmail = (e: string) => e?.toLowerCase().trim() ?? "";
const rolePriority: Record<string, number> = {
  buyer: 1,
  composer: 2,
  admin: 3,
};
const ADMIN_TRANSACTIONS_READ_CUTOFF_KEY = "admin.transactionsReadCutoffMs";
const ADMIN_TRANSACTIONS_RESET_BASELINE_KEY = "admin.transactionsResetBaseline";
const ADMIN_REVENUE_RESET_BASELINE_KEY = "admin.revenueResetBaseline";

const USERS_REPORT_FIELDS = [
  { key: "photo", label: "Profile Photo" },
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "roles", label: "Roles" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
];
const COMPOSITIONS_REPORT_FIELDS = [
  { key: "title", label: "Title" },
  { key: "composer", label: "Composer" },
  { key: "price", label: "Price (KES)" },
  { key: "verified", label: "Verified" },
  { key: "created", label: "Created" },
];
const TRANSACTIONS_REPORT_FIELDS = [
  { key: "transactionId", label: "Transaction ID" },
  { key: "date", label: "Date" },
  { key: "buyer", label: "Buyer" },
  { key: "composition", label: "Composition" },
  { key: "paymentRef", label: "Payment Ref" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount (KES)" },
  { key: "source", label: "Source" },
];
const REQUESTS_REPORT_FIELDS = [
  { key: "email", label: "Email" },
  { key: "requestedAt", label: "Requested At" },
  { key: "requestedRole", label: "Requested Role" },
  { key: "currentRoles", label: "Current Roles" },
];
const ENROLLMENTS_REPORT_FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "class", label: "Class" },
  { key: "level", label: "Level" },
  { key: "notes", label: "Notes" },
  { key: "submitted", label: "Submitted" },
  { key: "status", label: "Status" },
  { key: "admitted", label: "Admitted" },
];

function getInitials(displayName?: string | null, email?: string | null) {
  const source = (displayName || email || "U").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}
function getTransactionTimestampMs(transaction: any): number {
  const value =
    transaction?.purchased_at ||
    transaction?.purchasedAt ||
    transaction?.submitted_at ||
    transaction?.submittedAt ||
    transaction?.created_at ||
    transaction?.createdAt ||
    null;
  const ms = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function getLatestTransactionTimestampMs(transactions: any[]): number {
  return (transactions || []).reduce((max: number, row: any) => {
    const ms = getTransactionTimestampMs(row);
    return ms > max ? ms : max;
  }, 0);
}

function LoadingTableRow({
  colSpan,
  label,
}: {
  colSpan: number;
  label: string;
}) {
  return (
                    <TableRow>
      <TableCell colSpan={colSpan} className="py-8">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader className="size-4 animate-spin" />
          <span>{label}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* --------- TYPES --------- */
type UserRoleMap = Record<string, string>; // user_id -> primaryRoleString
type DataLoadLevel = "none" | "preview" | "full";
type AdminTab =
  | "overview"
  | "users"
  | "requests"
  | "enrollments"
  | "compositions"
  | "transactions"
  | "support"
  | "announcements"
  | "invites";
type ServiceMenuGroup = "customer" | "operations" | "commerce";

const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  overview: "Overview",
  users: "User Management",
  requests: "Role Requests",
  enrollments: "Enrollments",
  compositions: "Compositions",
  transactions: "Transactions",
  support: "Support",
  announcements: "Announcements",
  invites: "Composer Invites",
};

const BOOTSTRAP_FALLBACK = {
  roles: [],
  invites: [],
  requests: [],
  stats: {
    totalUsers: 0,
    totalCompositions: 0,
    totalRevenue: 0,
    totalTransactions: 0,
  },
};

const ADMIN_CHAT_TYPE_LABELS: Record<AdminThreadType, string> = {
  notification: "Notification",
  ticket: "Ticket Chat",
  direct: "Direct Chat",
};
const ANNOUNCEMENT_ROLE_OPTIONS = [
  { value: "student", label: "Students" },
  { value: "buyer", label: "Buyers" },
  { value: "composer", label: "Composers" },
  { value: "admin", label: "Admins" },
] as const;

export function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();

  const { appUser, isLoading: authLoading } = useAuth();
  const { mode } = useTheme();
  const isDarkMode = mode === "dark";
  const adminLoadingBackdropImage = isDarkMode
    ? loadingStringsDark
    : loadingStringsLight;
  const adminLoadingOverlay = isDarkMode
    ? "linear-gradient(145deg, rgba(6,12,28,0.9), rgba(26,14,46,0.78), rgba(9,35,66,0.8))"
    : "linear-gradient(145deg, rgba(245,251,252,0.9), rgba(236,246,240,0.84), rgba(244,238,252,0.82))";

  // requests
  const [requests, setRequests] = useState<any[]>([]);

  // data
  const [users, setUsers] = useState<any[]>([]);
  const [compositions, setCompositions] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);

  // stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalCompositions, setTotalCompositions] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);

  // UI
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [compositionsLoading, setCompositionsLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [supportTicketsLoading, setSupportTicketsLoading] = useState(false);
  const [supportThreadsLoading, setSupportThreadsLoading] = useState(false);
  const [supportMessagesLoading, setSupportMessagesLoading] = useState(false);
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [isServiceMenuCollapsed, setIsServiceMenuCollapsed] = useState(false);
  const [isMobileServiceMenuOpen, setIsMobileServiceMenuOpen] = useState(false);
  const [overviewMoreOpen, setOverviewMoreOpen] = useState(false);
  const [overviewActivityOpen, setOverviewActivityOpen] = useState(false);
  const [overviewLeaderboardOpen, setOverviewLeaderboardOpen] = useState(false);
  const [expandedServiceMenuGroups, setExpandedServiceMenuGroups] = useState<
    Record<ServiceMenuGroup, boolean>
  >({
    customer: true,
    operations: true,
    commerce: true,
  });
  const [supportStateFilter, setSupportStateFilter] = useState<
    "all" | "unread" | "read"
  >("unread");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<
    "pending" | "admitted" | "rejected" | "all"
  >("pending");
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportThreads, setSupportThreads] = useState<any[]>([]);
  const [selectedSupportThreadId, setSelectedSupportThreadId] = useState<
    string | null
  >(null);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [supportReply, setSupportReply] = useState("");
  const [adminChatType, setAdminChatType] = useState<AdminThreadType>("direct");
  const [adminChatTargetUserId, setAdminChatTargetUserId] = useState("");
  const [adminChatSubject, setAdminChatSubject] = useState("");
  const [adminChatMessage, setAdminChatMessage] = useState("");
  const [announcementRoles, setAnnouncementRoles] = useState<string[]>([
    "student",
    "buyer",
  ]);
  const [announcementSubject, setAnnouncementSubject] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<
    "all" | "buyer" | "composer" | "admin"
  >("all");
  const [userStatusFilter, setUserStatusFilter] = useState<
    "all" | "active" | "suspended"
  >("all");
  const [compositionSearchQuery, setCompositionSearchQuery] = useState("");
  const [compositionVerificationFilter, setCompositionVerificationFilter] =
    useState<"all" | "verified" | "unverified">("all");
  const [transactionSearchQuery, setTransactionSearchQuery] = useState("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<
    "all" | "approved" | "pending" | "rejected"
  >("all");
  const [transactionSourceFilter, setTransactionSourceFilter] = useState<
    "all" | "purchase" | "payment_submission"
  >("all");
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [requestRoleFilter, setRequestRoleFilter] = useState<
    "all" | "composer" | "admin"
  >("all");
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState("");
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [compositionsLoadLevel, setCompositionsLoadLevel] =
    useState<DataLoadLevel>("none");
  const [transactionsLoadLevel, setTransactionsLoadLevel] =
    useState<DataLoadLevel>("none");
  const [transactionsReadCutoffMs, setTransactionsReadCutoffMs] =
    useState<number>(() => {
      try {
        const stored = localStorage.getItem(ADMIN_TRANSACTIONS_READ_CUTOFF_KEY);
        const parsed = Number(stored);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch {
        return 0;
      }
    });
  const [transactionsResetBaseline, setTransactionsResetBaseline] =
    useState<number>(() => {
      try {
        const stored = localStorage.getItem(
          ADMIN_TRANSACTIONS_RESET_BASELINE_KEY,
        );
        const parsed = Number(stored);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      } catch {
        return 0;
      }
    });
  const [revenueResetBaseline, setRevenueResetBaseline] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_REVENUE_RESET_BASELINE_KEY);
      const parsed = Number(stored);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const [selectedUserProfile, setSelectedUserProfile] = useState<any | null>(
    null,
  );
  const [isUserProfileSheetOpen, setIsUserProfileSheetOpen] = useState(false);
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

  useEffect(() => {
    try {
      localStorage.setItem(
        ADMIN_TRANSACTIONS_READ_CUTOFF_KEY,
        String(transactionsReadCutoffMs || 0),
      );
    } catch {
      // ignore storage failures
    }
  }, [transactionsReadCutoffMs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        ADMIN_TRANSACTIONS_RESET_BASELINE_KEY,
        String(transactionsResetBaseline || 0),
      );
    } catch {
      // ignore storage failures
    }
  }, [transactionsResetBaseline]);

  useEffect(() => {
    try {
      localStorage.setItem(
        ADMIN_REVENUE_RESET_BASELINE_KEY,
        String(revenueResetBaseline || 0),
      );
    } catch {
      // ignore storage failures
    }
  }, [revenueResetBaseline]);

  /* ---------------- guard admin access & initial load ---------------- */
  useEffect(() => {
    if (authLoading) return;

    if (!appUser) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
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
  }, [appUser, authLoading, location.hash, location.pathname, location.search, navigate]);

  /* ---------------- fetch all admin data ---------------- */
  const fetchAll = async () => {
    setLoading(true);
    try {
      let didTimeout = false;
      const bootstrap = await Promise.race([
        adminService.fetchBootstrap(),
        new Promise<typeof BOOTSTRAP_FALLBACK>((resolve) =>
          setTimeout(() => {
            didTimeout = true;
            resolve(BOOTSTRAP_FALLBACK);
          }, 12000),
        ),
      ]);
      setInvites(ensureArray<any>(bootstrap?.invites, ["invites"]));
      setRequests(ensureArray<any>(bootstrap?.requests, ["requests"]));

      const stats = bootstrap?.stats || {};
      setTotalUsers(stats.totalUsers || 0);
      setTotalCompositions(stats.totalCompositions || 0);
      setTotalRevenue(stats.totalRevenue || 0);
      setTotalTransactions(stats.totalTransactions || 0);

      if (didTimeout) {
        toast.error(
          "Admin bootstrap timed out. Showing a limited view; retrying in background.",
        );
      }
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
      setUsers(ensureArray<any>(data?.users, ["users"]));
      setUserRoles(ensureArray<any>(data?.userRoles, ["userRoles"]));
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
      setCompositions(ensureArray<any>(data, ["compositions"]));
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
      setTransactions(ensureArray<any>(data, ["transactions"]));
      setTransactionsLoadLevel(targetLevel);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const fetchEnrollments = async (
    statusOverride: "pending" | "admitted" | "rejected" | "all" = enrollmentStatusFilter,
    force = false,
  ) => {
    if (enrollmentsLoading && !force) return;
    setEnrollmentsLoading(true);
    try {
      const data = await adminService.fetchEnrollments({
        limit: 1000,
        status: statusOverride,
      });
      setEnrollments(ensureArray<any>(data, ["enrollments"]));
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  const fetchInvites = async () => {
    const data = await adminService.fetchInvites();
    setInvites(ensureArray<any>(data, ["invites"]));
  };

  const fetchRequests = async () => {
    const data = await adminService.fetchRequests();
    setRequests(ensureArray<any>(data, ["requests"]));
  };

  const fetchSupportTickets = async () => {
    if (supportTicketsLoading) return;
    setSupportTicketsLoading(true);
    try {
      const tickets = await supportService.getAdminTicketQueue();
      setSupportTickets(ensureArray<any>(tickets, ["tickets", "threads"]));
    } catch (error: any) {
      console.error("[admin-support] fetch tickets failed:", error);
      toast.error(error?.message || "Failed to load support tickets");
    } finally {
      setSupportTicketsLoading(false);
    }
  };

  const fetchSupportThreads = async (
    stateOverride: "all" | "unread" | "read" = supportStateFilter,
  ) => {
    if (supportThreadsLoading) return;
    setSupportThreadsLoading(true);
    try {
      const threads = await supportService.getAdminThreads(stateOverride);
      const nextThreads = ensureArray<any>(threads, ["threads", "tickets"]);
      setSupportThreads(nextThreads);
      setSelectedSupportThreadId((currentSelected) => {
        if (!currentSelected) return nextThreads[0]?.id || null;
        const stillExists = nextThreads.some(
          (thread) => thread.id === currentSelected,
        );
        return stillExists ? currentSelected : nextThreads[0]?.id || null;
      });
    } catch (error: any) {
      console.error("[admin-support] fetch threads failed:", error);
      toast.error(error?.message || "Failed to load support chats");
    } finally {
      setSupportThreadsLoading(false);
    }
  };

  const fetchSupportMessages = async (threadId: string, markRead = true) => {
    if (!threadId) return;
    setSupportMessagesLoading(true);
    try {
      const response = await supportService.getThreadMessages(threadId);
      setSupportMessages(ensureArray<any>(response?.messages, ["messages"]));

      if (markRead && response?.thread?.is_admin_unread) {
        await supportService.markThreadRead(threadId).catch(() => null);
        await fetchSupportThreads();
      }
    } catch (error: any) {
      console.error("[admin-support] fetch messages failed:", error);
      toast.error(error?.message || "Failed to load support messages");
    } finally {
      setSupportMessagesLoading(false);
    }
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
      await Promise.all([
        fetchUsers(),
        fetchCompositions(false),
        fetchTransactions(false),
        fetchEnrollments("all"),
        fetchSupportTickets(),
        fetchSupportThreads("all"),
      ]);
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
    if (activeTab === "enrollments") {
      void fetchEnrollments();
    }
    if (activeTab === "support") {
      void fetchSupportTickets();
      void fetchSupportThreads();
      void fetchUsers();
    }
    if (activeTab === "announcements") {
      void fetchSupportThreads("all");
      void fetchSupportTickets();
    }
    if (activeTab === "invites") {
      void fetchInvites();
    }
    if (activeTab === "requests" && requests.length === 0) {
      void fetchRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loading]);

  useEffect(() => {
    if (loading) return;
    if (activeTab !== "support") return;
    void fetchSupportThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supportStateFilter]);

  useEffect(() => {
    if (loading) return;
    if (activeTab !== "enrollments") return;
    void fetchEnrollments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollmentStatusFilter]);

  useEffect(() => {
    if (activeTab !== "support") {
      setSupportMessages([]);
      return;
    }
    if (!selectedSupportThreadId) {
      setSupportMessages([]);
      return;
    }
    void fetchSupportMessages(selectedSupportThreadId, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedSupportThreadId]);

  useEffect(() => {
    if (activeTab !== "support") return;

    const threadChannel = supabase
      .channel("admin-support-threads")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_chat_threads",
        },
        () => {
          void fetchSupportTickets();
          void fetchSupportThreads();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(threadChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, supportStateFilter]);

  useEffect(() => {
    if (activeTab !== "support" || !selectedSupportThreadId) return;

    const messageChannel = supabase
      .channel(`admin-support-messages-${selectedSupportThreadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_chat_messages",
          filter: `thread_id=eq.${selectedSupportThreadId}`,
        },
        () => {
          void fetchSupportMessages(selectedSupportThreadId, true);
          void fetchSupportThreads();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messageChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedSupportThreadId]);

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

  const filteredRequests = useMemo(() => {
    const query = requestSearchQuery.trim().toLowerCase();
    return (pendingRequests || []).filter((request: any) => {
      const requestedRole = String(
        request?.requested_role || request?.requestedRole || "composer",
      )
        .trim()
        .toLowerCase();
      if (requestRoleFilter !== "all" && requestedRole !== requestRoleFilter) {
        return false;
      }

      if (!query) return true;
      const haystack = [
        request?.email,
        request?.user_id,
        request?.id,
        requestedRole,
        Array.isArray(request?.roles) ? request.roles.join(" ") : request?.roles,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [pendingRequests, requestSearchQuery, requestRoleFilter]);

  const filteredEnrollments = useMemo(() => {
    const query = enrollmentSearchQuery.trim().toLowerCase();
    if (!query) return enrollments || [];

    return (enrollments || []).filter((enrollment: any) => {
      const haystack = [
        enrollment?.full_name,
        enrollment?.requester?.display_name,
        enrollment?.email,
        enrollment?.requester?.email,
        enrollment?.music_class,
        enrollment?.skill_level,
        enrollment?.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [enrollments, enrollmentSearchQuery]);

  const selectedSupportThread = useMemo(
    () =>
      supportThreads.find((thread: any) => thread.id === selectedSupportThreadId) ||
      null,
    [supportThreads, selectedSupportThreadId],
  );

  const supportUnreadCount = useMemo(
    () =>
      (supportThreads || []).filter((thread: any) => thread.is_admin_unread)
        .length + (supportTickets || []).length,
    [supportThreads, supportTickets],
  );

  const pendingPaymentReviewCount = useMemo(
    () =>
      (transactions || []).filter(
        (transaction: any) =>
          transaction.source === "payment_submission" &&
          transaction.status === "pending",
      ).length,
    [transactions],
  );

  const unreadRecentTransactions = useMemo(() => {
    return (transactions || [])
      .filter(
        (transaction: any) =>
          getTransactionTimestampMs(transaction) > transactionsReadCutoffMs,
      )
      .sort(
        (a: any, b: any) =>
          getTransactionTimestampMs(b) - getTransactionTimestampMs(a),
      );
  }, [transactions, transactionsReadCutoffMs]);

  const transactionsSinceReset = useMemo(
    () => Math.max(0, totalTransactions - transactionsResetBaseline),
    [totalTransactions, transactionsResetBaseline],
  );

  const revenueSinceReset = useMemo(
    () => Math.max(0, totalRevenue - revenueResetBaseline),
    [totalRevenue, revenueResetBaseline],
  );

  const pendingEnrollmentCount = useMemo(
    () =>
      (enrollments || []).filter(
        (enrollment: any) => String(enrollment?.status || "pending") === "pending",
      ).length,
    [enrollments],
  );

  const admittedEnrollmentCount = useMemo(
    () =>
      (enrollments || []).filter(
        (enrollment: any) => String(enrollment?.status || "") === "admitted",
      ).length,
    [enrollments],
  );

  const unverifiedCompositionsCount = useMemo(
    () =>
      (compositions || []).filter(
        (composition: any) => !Boolean(composition?.is_verified),
      ).length,
    [compositions],
  );

  const activeUsersCount = useMemo(
    () => (users || []).filter((user: any) => user?.is_active !== false).length,
    [users],
  );

  const pendingInviteCount = useMemo(
    () => (invites || []).filter((invite: any) => !invite?.used).length,
    [invites],
  );

  const selectedAdminChatTarget = useMemo(
    () =>
      users.find((user: any) => user.id === adminChatTargetUserId) || null,
    [users, adminChatTargetUserId],
  );

  const toggleServiceMenuGroup = (group: ServiceMenuGroup) => {
    setExpandedServiceMenuGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  const toggleAnnouncementRole = (role: string) => {
    setAnnouncementRoles((current) => {
      if (current.includes(role)) {
        return current.filter((entry) => entry !== role);
      }
      return [...current, role];
    });
  };

  const markAllTransactionsRead = () => {
    const latestMs = getLatestTransactionTimestampMs(transactions);
    if (!latestMs) return;
    setTransactionsReadCutoffMs(latestMs);
    toast.success("Transactions marked as read");
  };

  const resetTransactionsToZero = () => {
    setTransactionsResetBaseline(totalTransactions);
    setRevenueResetBaseline(totalRevenue);
    const latestMs = getLatestTransactionTimestampMs(transactions);
    if (latestMs) setTransactionsReadCutoffMs(latestMs);
    toast.success("Revenue and transactions reset to zero");
  };

  const formatUserDisplay = (user: any) =>
    user?.display_name || user?.email || "Unknown user";

  const resolveUserRoles = (user: any): string[] => {
    const roleSet = new Set<string>();
    if (Array.isArray(user?.roles)) {
      user.roles
        .map((role: any) => String(role || "").trim().toLowerCase())
        .filter(Boolean)
        .forEach((role: string) => roleSet.add(role));
    }
    const primaryRole = userIdToRole[user?.id];
    if (primaryRole) roleSet.add(primaryRole);
    (userRoles || []).forEach((ur: any) => {
      if (ur?.user_id !== user?.id) return;
      const roleName = String(ur?.roles?.name || ur?.role_name || "")
        .trim()
        .toLowerCase();
      if (roleName) roleSet.add(roleName);
    });
    if (roleSet.size === 0) roleSet.add("buyer");
    return [...roleSet].sort(
      (a, b) => (rolePriority[b] || 0) - (rolePriority[a] || 0),
    );
  };

  const filteredUsers = useMemo(() => {
    const query = userSearchQuery.trim().toLowerCase();
    return (users || []).filter((user: any) => {
      if (userStatusFilter === "active" && user?.is_active === false) return false;
      if (userStatusFilter === "suspended" && user?.is_active !== false) {
        return false;
      }

      const roles = resolveUserRoles(user);
      if (userRoleFilter !== "all" && !roles.includes(userRoleFilter)) {
        return false;
      }

      if (!query) return true;
      const haystack = [
        user?.display_name,
        user?.email,
        user?.phone,
        user?.id,
        user?.auth_uid,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [
    users,
    userSearchQuery,
    userRoleFilter,
    userStatusFilter,
    userRoles,
    userIdToRole,
  ]);

  const filteredCompositions = useMemo(() => {
    const query = compositionSearchQuery.trim().toLowerCase();
    return (compositions || []).filter((composition: any) => {
      const isVerified = Boolean(composition?.is_verified);
      if (compositionVerificationFilter === "verified" && !isVerified) return false;
      if (compositionVerificationFilter === "unverified" && isVerified) return false;

      if (!query) return true;
      const composerDisplay =
        composition?.composers?.users?.display_name ||
        composition?.composers?.users?.email ||
        "";
      const haystack = `${composition?.title || ""} ${composition?.description || ""} ${composerDisplay}`
        .toLowerCase()
        .trim();
      return haystack.includes(query);
    });
  }, [compositions, compositionSearchQuery, compositionVerificationFilter]);

  const filteredTransactions = useMemo(() => {
    const query = transactionSearchQuery.trim().toLowerCase();
    return (transactions || []).filter((transaction: any) => {
      const status = String(transaction?.status || "approved").toLowerCase();
      const source = String(transaction?.source || "purchase").toLowerCase();
      if (transactionStatusFilter !== "all" && status !== transactionStatusFilter) {
        return false;
      }
      if (transactionSourceFilter !== "all" && source !== transactionSourceFilter) {
        return false;
      }

      if (!query) return true;
      const buyerDisplay =
        transaction?.buyers?.users?.display_name ||
        transaction?.buyers?.users?.email ||
        "";
      const compositionTitle = transaction?.compositions?.title || "";
      const haystack = [
        transaction?.transaction_id,
        transaction?.id,
        transaction?.payment_ref,
        status,
        source,
        buyerDisplay,
        compositionTitle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [
    transactions,
    transactionSearchQuery,
    transactionStatusFilter,
    transactionSourceFilter,
  ]);

  const exportUsersPdf = async (selectedKeys: string[]) => {
    const selectedFields = USERS_REPORT_FIELDS.filter((f) =>
      selectedKeys.includes(f.key),
    );
    if (selectedFields.length === 0) return;

    const initials = filteredUsers.map((user: any) =>
      getInitials(user?.display_name, user?.email),
    );

    const photoColIndex = selectedFields.findIndex((f) => f.key === "photo");
    const avatarUrls =
      photoColIndex >= 0
        ? filteredUsers.map((user: any) => {
            const optimized =
              getOptimizedProfileImageUrl(user?.avatar_url, {
                width: 128,
                height: 128,
                quality: 62,
                resize: "cover",
              }) || user?.avatar_url;
            return optimized || null;
          })
        : [];

    try {
      await exportTableReportToPdf({
        title: "Users Report",
        subtitle: `${filteredUsers.length} users (role: ${userRoleFilter}, status: ${userStatusFilter})`,
        columns: selectedFields.map((f) => f.label),
        rows: filteredUsers.map((user: any, index: number) =>
          selectedFields.map((f) => {
            if (f.key === "photo") return initials[index] || "";
            if (f.key === "name") return user?.display_name || "N/A";
            if (f.key === "email") return user?.email || "N/A";
            if (f.key === "phone") return user?.phone || "-";
            if (f.key === "roles") return resolveUserRoles(user).join(", ");
            if (f.key === "status")
              return user?.is_active === false ? "Suspended" : "Active";
            if (f.key === "created")
              return formatDateTime(user?.created_at || null) || "-";
            return "";
          }),
        ),
        imageColumns:
          photoColIndex >= 0
            ? [
                {
                  columnIndex: photoColIndex,
                  imageUrls: avatarUrls,
                  sizeMm: 10,
                  fallbackText: initials,
                },
              ]
            : undefined,
        orientation: selectedFields.length > 6 ? "landscape" : "portrait",
        generatedBy: appUser?.email || undefined,
      });
    } catch (error: any) {
      console.error("[admin] export users pdf failed:", error);
      toast.error(error?.message || "Failed to export users PDF");
    }
  };

  const exportCompositionsPdf = async (selectedKeys: string[]) => {
    const selectedFields = COMPOSITIONS_REPORT_FIELDS.filter((f) =>
      selectedKeys.includes(f.key),
    );
    if (selectedFields.length === 0) return;

    try {
      await exportTableReportToPdf({
        title: "Compositions Report",
        subtitle: `${filteredCompositions.length} compositions (verification: ${compositionVerificationFilter})`,
        columns: selectedFields.map((f) => f.label),
        rows: filteredCompositions.map((composition: any) =>
          selectedFields.map((f) => {
            if (f.key === "title") return composition?.title || "N/A";
            if (f.key === "composer")
              return (
                composition?.composers?.users?.display_name ||
                composition?.composers?.users?.email ||
                "Unknown"
              );
            if (f.key === "price") return Number(composition?.price || 0);
            if (f.key === "verified")
              return composition?.is_verified ? "Yes" : "No";
            if (f.key === "created")
              return formatDateTime(composition?.created_at || null) || "-";
            return "";
          }),
        ),
        generatedBy: appUser?.email || undefined,
      });
    } catch (error: any) {
      console.error("[admin] export compositions pdf failed:", error);
      toast.error(error?.message || "Failed to export compositions PDF");
    }
  };

  const exportTransactionsPdf = async (selectedKeys: string[]) => {
    const selectedFields = TRANSACTIONS_REPORT_FIELDS.filter((f) =>
      selectedKeys.includes(f.key),
    );
    if (selectedFields.length === 0) return;

    try {
      await exportTableReportToPdf({
        title: "Transactions Report",
        subtitle: `${filteredTransactions.length} transactions (status: ${transactionStatusFilter}, source: ${transactionSourceFilter})`,
        columns: selectedFields.map((f) => f.label),
        rows: filteredTransactions.map((t: any) =>
          selectedFields.map((f) => {
            if (f.key === "transactionId")
              return t?.transaction_id || t?.id || "-";
            if (f.key === "date")
              return (
                formatDateTime(
                  t?.purchased_at ||
                    t?.purchasedAt ||
                    t?.submitted_at ||
                    t?.submittedAt ||
                    null,
                ) || "-"
              );
            if (f.key === "buyer")
              return (
                t?.buyers?.users?.display_name ||
                t?.buyers?.users?.email ||
                "Unknown"
              );
            if (f.key === "composition") return t?.compositions?.title || "Unknown";
            if (f.key === "paymentRef") return t?.payment_ref || "-";
            if (f.key === "status")
              return String(t?.status || "approved").toUpperCase();
            if (f.key === "amount") return Number(t?.price_paid || 0);
            if (f.key === "source") return t?.source || "purchase";
            return "";
          }),
        ),
        generatedBy: appUser?.email || undefined,
      });
    } catch (error: any) {
      console.error("[admin] export transactions pdf failed:", error);
      toast.error(error?.message || "Failed to export transactions PDF");
    }
  };

  const exportRequestsPdf = async (selectedKeys: string[]) => {
    const selectedFields = REQUESTS_REPORT_FIELDS.filter((f) =>
      selectedKeys.includes(f.key),
    );
    if (selectedFields.length === 0) return;

    try {
      await exportTableReportToPdf({
        title: "Role Requests Report",
        subtitle: `${filteredRequests.length} pending requests (role filter: ${requestRoleFilter})`,
        columns: selectedFields.map((f) => f.label),
        rows: filteredRequests.map((request: any) =>
          selectedFields.map((f) => {
            if (f.key === "email") return request?.email || "N/A";
            if (f.key === "requestedAt")
              return (
                formatDateTime(request?.created_at || request?.createdAt || null) ||
                "-"
              );
            if (f.key === "requestedRole")
              return String(
                request?.requested_role || request?.requestedRole || "composer",
              )
                .toString()
                .toLowerCase();
            if (f.key === "currentRoles")
              return Array.isArray(request?.roles)
                ? request.roles.join(", ")
                : request?.roles ||
                    userIdToRole[request?.user_id || request?.id] ||
                    "buyer";
            return "";
          }),
        ),
        generatedBy: appUser?.email || undefined,
      });
    } catch (error: any) {
      console.error("[admin] export requests pdf failed:", error);
      toast.error(error?.message || "Failed to export role requests PDF");
    }
  };

  const exportEnrollmentsPdf = async (selectedKeys: string[]) => {
    const selectedFields = ENROLLMENTS_REPORT_FIELDS.filter((f) =>
      selectedKeys.includes(f.key),
    );
    if (selectedFields.length === 0) return;

    try {
      await exportTableReportToPdf({
        title: "Enrollments Report",
        subtitle: `${filteredEnrollments.length} enrollments (status: ${enrollmentStatusFilter})`,
        columns: selectedFields.map((f) => f.label),
        rows: filteredEnrollments.map((enrollment: any) =>
          selectedFields.map((f) => {
            if (f.key === "name")
              return (
                enrollment?.full_name ||
                enrollment?.requester?.display_name ||
                "N/A"
              );
            if (f.key === "email")
              return enrollment?.email || enrollment?.requester?.email || "N/A";
            if (f.key === "class") return enrollment?.music_class || "N/A";
            if (f.key === "level")
              return String(enrollment?.skill_level || "N/A");
            if (f.key === "notes") return enrollment?.notes || "-";
            if (f.key === "submitted")
              return formatDateTime(enrollment?.created_at || null) || "-";
            if (f.key === "status")
              return String(enrollment?.status || "pending").toUpperCase();
            if (f.key === "admitted")
              return enrollment?.admitted_at
                ? `${enrollment?.admitted_admin?.display_name || enrollment?.admitted_admin?.email || "Admin"} - ${formatDateTime(enrollment?.admitted_at) || "-"}`
                : "-";
            return "";
          }),
        ),
        generatedBy: appUser?.email || undefined,
      });
    } catch (error: any) {
      console.error("[admin] export enrollments pdf failed:", error);
      toast.error(error?.message || "Failed to export enrollments PDF");
    }
  };

  const selectedUserProfileRoles = useMemo(() => {
    if (!selectedUserProfile) return [] as string[];
    return resolveUserRoles(selectedUserProfile);
  }, [selectedUserProfile, userRoles, userIdToRole]);

  const defaultAdminChatSubject = (
    type: AdminThreadType,
    user: any | null = null,
  ) => {
    const displayName = formatUserDisplay(user);
    if (type === "notification") {
      return `Notification for ${displayName}`;
    }
    if (type === "ticket") {
      return `Support follow-up for ${displayName}`;
    }
    return `Direct chat with ${displayName}`;
  };

  const resolveThreadContextLabel = (context?: string | null) => {
    const normalized = String(context || "").toLowerCase();
    if (normalized.includes("announcement")) {
      return {
        label: "Announcement",
        className: "bg-violet-100 text-violet-800",
      };
    }
    if (normalized.includes("notification")) {
      return {
        label: "Notification",
        className: "bg-indigo-100 text-indigo-800",
      };
    }
    if (normalized.includes("ticket")) {
      return {
        label: "Ticket",
        className: "bg-amber-100 text-amber-800",
      };
    }
    if (normalized.includes("direct")) {
      return {
        label: "Direct",
        className: "bg-emerald-100 text-emerald-800",
      };
    }
    return {
      label: "Support",
      className: "bg-sky-100 text-sky-800",
    };
  };

  const resolveRequestedRole = (
    request: any,
  ): "composer" | "admin" =>
    request?.requested_role === "admin" || request?.requestedRole === "admin"
      ? "admin"
      : "composer";

  const resolveRequestUserId = (request: any): string | null =>
    typeof request === "string"
      ? request
      : request?.user_id || request?.id || null;

  const refreshAfterRoleChange = async () =>
    Promise.all([fetchUsers(true), fetchRequests(), fetchExactStats()]);

  const refreshAfterPaymentReview = async () =>
    Promise.all([fetchTransactions(true, true), fetchExactStats()]);

  const refreshAfterCompositionRemoval = async () =>
    Promise.all([fetchCompositions(true, true), fetchExactStats()]);

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
      await refreshAfterRoleChange();
    });
  }

  async function promoteUserToAdmin(userId: string) {
    await runAction(`user:promote-admin:${userId}`, async () => {
      await adminService.promoteUserToAdmin(userId);
      await refreshAfterRoleChange();
    });
  }
  async function demoteUserFromComposer(userId: string) {
    await runAction(`user:demote-composer:${userId}`, async () => {
      await adminService.demoteUserFromComposer(userId);
      await refreshAfterRoleChange();
    });
  }

  async function demoteUserFromAdmin(userId: string) {
    await runAction(`user:demote-admin:${userId}`, async () => {
      await adminService.demoteUserFromAdmin(userId);
      await refreshAfterRoleChange();
    });
  }

  async function suspendUser(userId: string) {
    await runAction(`user:suspend:${userId}`, async () => {
      await adminService.suspendUser(userId);
      await fetchUsers(true);
    });
  }
  async function unsuspendUser(userId: string) {
    await runAction(`user:unsuspend:${userId}`, async () => {
      await adminService.unsuspendUser(userId);
      await fetchUsers(true);
    });
  }

  async function deleteUser(user: any) {
    const userId = user?.id;
    if (!userId) {
      toast.error("User id missing");
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete ${formatUserDisplay(user)}? This cannot be undone.`,
    );
    if (!confirmed) return;
    await runAction(`user:delete:${userId}`, async () => {
      await adminService.deleteUser(userId);
      await Promise.all([fetchUsers(true), fetchExactStats()]);
    });
  }

  function openAdminChatComposer(user: any, type: AdminThreadType) {
    const subject = defaultAdminChatSubject(type, user);
    setAdminChatTargetUserId(user?.id || "");
    setAdminChatType(type);
    setAdminChatSubject(subject);
    setAdminChatMessage("");
    setActiveTab("support");
    setSupportStateFilter("all");
    setSelectedSupportThreadId(null);
    void fetchSupportThreads("all");
    void fetchSupportTickets();
    toast.info(
      `${ADMIN_CHAT_TYPE_LABELS[type]} ready for ${formatUserDisplay(user)} in Support.`,
    );
  }

  function openUserProfileSheet(user: any) {
    setSelectedUserProfile(user || null);
    setIsUserProfileSheetOpen(Boolean(user));
  }

  async function createAdminThread() {
    const targetUserId = adminChatTargetUserId.trim();
    const message = adminChatMessage.trim();
    const subject = adminChatSubject.trim();

    if (!targetUserId) {
      toast.error("Select a user to message");
      return;
    }

    if (!message) {
      toast.error("Type a message before starting the chat");
      return;
    }

    await runAction(`support:create:${targetUserId}:${adminChatType}`, async () => {
      const response = await supportService.createAdminThread({
        targetUserId,
        threadType: adminChatType,
        subject: subject || undefined,
        message,
        context: `admin-${adminChatType}`,
      });

      const createdThreadId = response?.thread?.id || null;
      setActiveTab("support");
      setSupportStateFilter("all");
      setAdminChatMessage("");
      await Promise.all([fetchSupportTickets(), fetchSupportThreads("all")]);

      if (createdThreadId) {
        setSelectedSupportThreadId(createdThreadId);
        await fetchSupportMessages(createdThreadId, false);
      }

      toast.success(`${ADMIN_CHAT_TYPE_LABELS[adminChatType]} started`);
    });
  }

  async function improveAdminChatDraft() {
    const message = adminChatMessage.trim();
    if (!message) {
      toast.error("Type a message first, then use AI polish.");
      return;
    }

    await runAction(`support:ai:admin-chat:${adminChatType}`, async () => {
      const result = await supportService.draftMessageWithAi({
        useCase: "message",
        subject: adminChatSubject.trim() || undefined,
        message,
        context: `admin-${adminChatType}`,
      });

      setAdminChatMessage(result?.draft?.message || message);
      if (!adminChatSubject.trim() && result?.draft?.subject) {
        setAdminChatSubject(result.draft.subject);
      }
      toast.success("Message polished with AI");
    });
  }

  async function improveSupportReplyDraft() {
    const message = supportReply.trim();
    if (!message) {
      toast.error("Type a reply first, then use AI polish.");
      return;
    }

    await runAction("support:ai:reply", async () => {
      const result = await supportService.draftMessageWithAi({
        useCase: "support",
        message,
        context: selectedSupportThread?.context || "admin-support-reply",
      });
      setSupportReply(result?.draft?.message || message);
      toast.success("Reply polished with AI");
    });
  }

  async function improveAnnouncementDraft() {
    const message = announcementMessage.trim();
    if (!message) {
      toast.error("Write your announcement first, then use AI compose.");
      return;
    }
    if (announcementRoles.length === 0) {
      toast.error("Select at least one target role.");
      return;
    }

    await runAction("support:ai:announcement", async () => {
      const result = await supportService.draftMessageWithAi({
        useCase: "announcement",
        message,
        subject: announcementSubject.trim() || undefined,
        audienceRoles: announcementRoles,
        context: "admin-announcement",
      });
      setAnnouncementMessage(result?.draft?.message || message);
      if (!announcementSubject.trim() && result?.draft?.subject) {
        setAnnouncementSubject(result.draft.subject);
      }
      toast.success("Announcement draft generated");
    });
  }

  async function sendRoleAnnouncement() {
    const message = announcementMessage.trim();
    const subject = announcementSubject.trim();
    if (announcementRoles.length === 0) {
      toast.error("Select at least one target role.");
      return;
    }
    if (!message) {
      toast.error("Type an announcement message before sending.");
      return;
    }

    const actionKey = `support:announcement:${announcementRoles
      .slice()
      .sort()
      .join(",")}`;
    await runAction(actionKey, async () => {
      const response = await supportService.createRoleAnnouncement({
        roles: announcementRoles,
        subject: subject || undefined,
        message,
        context: "admin-announcement",
      });

      setSupportStateFilter("all");
      setAnnouncementMessage("");
      await Promise.all([fetchSupportThreads("all"), fetchSupportTickets()]);

      const createdThreadId = response?.createdThreadIds?.[0] || null;
      if (createdThreadId) {
        setSelectedSupportThreadId(createdThreadId);
        await fetchSupportMessages(createdThreadId, false);
      }

      toast.success(
        `Announcement sent to ${Number(response?.recipientCount || 0)} user(s).`,
      );
    });
  }

  async function approveRequest(request: any) {
    const userId = resolveRequestUserId(request);
    const requestedRole = resolveRequestedRole(request);

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
      await refreshAfterRoleChange();
    });
  }

  async function rejectRequest(request: any) {
    const userId = resolveRequestUserId(request);
    const requestedRole = resolveRequestedRole(request);

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
      await refreshAfterPaymentReview();
    });
  }

  async function rejectPaymentSubmission(submissionId: string) {
    await runAction(`payment:reject:${submissionId}`, async () => {
      await adminService.rejectPaymentSubmission(submissionId);
      await refreshAfterPaymentReview();
    });
  }

  async function admitEnrollment(enrollment: any) {
    const enrollmentId = enrollment?.id;
    if (!enrollmentId) {
      toast.error("Missing enrollment id");
      return;
    }

    await runAction(`enrollment:admit:${enrollmentId}`, async () => {
      await adminService.admitEnrollment(enrollmentId);
      await fetchEnrollments(enrollmentStatusFilter, true);
    });
  }

  async function removeComposition(composition: any) {
    const compositionId = composition?.id;
    if (!compositionId) {
      toast.error("Missing composition id");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${composition?.title || "this composition"}"? This will remove it from the marketplace and revoke access for every buyer who owns it.`,
    );
    if (!confirmed) return;

    await runAction(`composition:remove:${compositionId}`, async () => {
      await adminService.removeComposition(compositionId);
      await refreshAfterCompositionRemoval();
    });
  }

  async function verifyComposition(composition: any) {
    const compositionId = composition?.id;
    if (!compositionId) {
      toast.error("Missing composition id");
      return;
    }

    await runAction(`composition:verify:${compositionId}`, async () => {
      await adminService.verifyComposition(compositionId);
      await refreshAfterCompositionRemoval();
    });
  }

  async function unverifyComposition(composition: any) {
    const compositionId = composition?.id;
    if (!compositionId) {
      toast.error("Missing composition id");
      return;
    }

    await runAction(`composition:unverify:${compositionId}`, async () => {
      await adminService.unverifyComposition(compositionId);
      await refreshAfterCompositionRemoval();
    });
  }

  async function viewCompositionDetails(composition: any): Promise<boolean> {
    try {
      const compositionId = composition?.id;
      if (!compositionId) {
        toast.info("No composition ID found");
        return false;
      }

      const latest = (await compositionService.getById(compositionId)) as any;
      const pdfUrl =
        latest?.pdf_url || composition?.pdf_url || composition?.pdfUrl || null;

      if (pdfUrl) {
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
        return true;
      }

      toast.info("No PDF URL found for this composition");
      return false;
    } catch (error: any) {
      console.error("[admin-panel] open composition failed:", error);
      toast.error(error?.message || "Failed to open composition PDF");
      return false;
    }
  }

  async function reviewAndVerifyComposition(composition: any) {
    const openedPdf = await viewCompositionDetails(composition);
    if (!openedPdf) return;

    const confirmVerify = window.confirm(
      "After reviewing the PDF, click OK to mark this composition as VERIFIED.",
    );
    if (!confirmVerify) return;

    await verifyComposition(composition);
  }

  async function pickSupportTicket(threadId: string) {
    await runAction(`support:pick:${threadId}`, async () => {
      const response = await supportService.pickAdminTicket(threadId);
      const pickedId = response?.thread?.id || threadId;
      setSelectedSupportThreadId(pickedId);
      setSupportReply("");
      await Promise.all([fetchSupportTickets(), fetchSupportThreads()]);
      await fetchSupportMessages(pickedId, false);
      toast.success("Ticket assigned to your support chats");
    });
  }

  async function rejectSupportTicket(threadId: string) {
    await runAction(`support:reject:${threadId}`, async () => {
      const response = await supportService.rejectAdminTicket(threadId);
      await fetchSupportTickets();
      if (response?.rejectedByAllAdmins) {
        toast.info("Ticket rejected by all admins. Requester has been notified.");
      }
    });
  }

  async function sendSupportReply() {
    if (!selectedSupportThreadId) {
      toast.error("Select a support thread first");
      return;
    }
    const message = supportReply.trim();
    if (!message) {
      toast.error("Type a reply before sending");
      return;
    }

    await runAction(`support:reply:${selectedSupportThreadId}`, async () => {
      await supportService.sendMessage(selectedSupportThreadId, message);
      setSupportReply("");
      await fetchSupportMessages(selectedSupportThreadId, false);
      await fetchSupportThreads();
    });
  }

  async function markSupportThreadRead(threadId: string) {
    await runAction(`support:read:${threadId}`, async () => {
      await supportService.markThreadRead(threadId);
      await fetchSupportThreads();
      if (threadId === selectedSupportThreadId) {
        await fetchSupportMessages(threadId, false);
      }
    });
  }

  async function deleteSupportThread(threadId: string) {
    const confirmed = window.confirm(
      "Delete this assigned support chat?",
    );
    if (!confirmed) return;

    await runAction(`support:delete:${threadId}`, async () => {
      await supportService.deleteAdminThread(threadId);
      if (selectedSupportThreadId === threadId) {
        setSelectedSupportThreadId(null);
        setSupportMessages([]);
      }
      await fetchSupportThreads();
    });
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

  const activeTabLabel = ADMIN_TAB_LABELS[activeTab];

  const sideMenuButtonClass = (active: boolean) =>
    `w-full rounded-xl border py-2 text-left text-sm font-medium transition ${
      isServiceMenuCollapsed ? "justify-center px-2" : "justify-start px-3"
    } ${
      active
        ? "border-primary bg-primary/10 text-primary"
        : "border-border/70 bg-card/70 text-foreground hover:bg-muted/40"
    }`;

  const goToOpenTickets = () => {
    setActiveTab("support");
    setSupportStateFilter("unread");
    setSelectedSupportThreadId(null);
    void fetchSupportTickets();
    void fetchSupportThreads("unread");
  };

  const goToAssignedChats = () => {
    setActiveTab("support");
    setSupportStateFilter("all");
    void fetchSupportThreads("all");
  };

  const goToTabFromMobileMenu = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileServiceMenuOpen(false);
  };

  const goToOpenTicketsFromMobileMenu = () => {
    goToOpenTickets();
    setIsMobileServiceMenuOpen(false);
  };

  const goToAssignedChatsFromMobileMenu = () => {
    goToAssignedChats();
    setIsMobileServiceMenuOpen(false);
  };

  if (loading) {
    return (
      <main className="texture-linen relative min-h-screen overflow-hidden py-12">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center"
          style={{
            backgroundImage: `${adminLoadingOverlay}, url(${adminLoadingBackdropImage})`,
          }}
          aria-hidden="true"
        />
        <section className="section-shell">
          <div className="mx-auto max-w-4xl">
            <Card className="route-backdrop-panel route-backdrop-panel-strong texture-speckle motion-reveal overflow-hidden rounded-3xl border border-white/15 bg-card/20 shadow-[0_24px_44px_-30px_rgba(15,23,42,0.85)] dark:border-white/10 dark:bg-card/25">
              <CardContent className="px-6 py-16 text-center sm:px-8">
                <span className="soft-kicker">Admin Workspace</span>
                <h2 className="mt-5 text-3xl font-semibold text-foreground sm:text-4xl">
                  Preparing Admin Panel
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                  Loading users, transactions, enrollments, and support threads.
                </p>
                <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/85 px-4 py-2">
                  <Loader className="size-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    Loading admin panel...
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="space-y-4 overflow-x-hidden p-3 sm:space-y-6 sm:p-4 lg:p-6 xl:flex xl:h-screen xl:flex-col xl:overflow-hidden">
      <div className="route-backdrop-panel texture-speckle motion-reveal overflow-hidden rounded-3xl border border-white/15 bg-card/20 p-4 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.82)] dark:border-white/10 dark:bg-card/25 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Admin Panel</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Manage platform operations and monitor activity
            </p>
          </div>
          <SupportIssueButton context="admin-dashboard" triggerLabel="Talk to Us" />
        </div>
      </div>
      <Card className="route-backdrop-panel border-white/15 bg-card/25 xl:hidden dark:border-white/10 dark:bg-card/25">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Active Section
              </p>
              <p className="text-sm font-semibold text-foreground">
                {activeTabLabel}
              </p>
            </div>
            <Sheet
              open={isMobileServiceMenuOpen}
              onOpenChange={setIsMobileServiceMenuOpen}
            >
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <PanelLeftOpen className="size-4" />
                  Service Menu
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[88vw] sm:w-[390px]">
                <SheetHeader>
                  <SheetTitle>Admin Navigation</SheetTitle>
                  <SheetDescription>
                    Open a section quickly and continue operations.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Customer Service
                    </p>
                    <Button
                      className="w-full justify-between"
                      variant={
                        activeTab === "support" && supportStateFilter === "unread"
                          ? "default"
                          : "outline"
                      }
                      onClick={goToOpenTicketsFromMobileMenu}
                    >
                      Open Tickets
                      <Badge className="bg-amber-100 text-amber-800">
                        {supportTickets.length}
                      </Badge>
                    </Button>
                    <Button
                      className="w-full justify-between"
                      variant={
                        activeTab === "support" && supportStateFilter !== "unread"
                          ? "default"
                          : "outline"
                      }
                      onClick={goToAssignedChatsFromMobileMenu}
                    >
                      Assigned Chats
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {supportThreads.length}
                      </Badge>
                    </Button>
                    <Button
                      className="w-full justify-start"
                      variant={activeTab === "announcements" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("announcements")}
                    >
                      Announcements
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Operations
                    </p>
                    <Button
                      className="w-full justify-start"
                      variant={activeTab === "users" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("users")}
                    >
                      User Management
                    </Button>
                    <Button
                      className="w-full justify-between"
                      variant={activeTab === "requests" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("requests")}
                    >
                      Role Requests
                      <Badge className="bg-sky-100 text-sky-800">
                        {pendingRequests.length}
                      </Badge>
                    </Button>
                    <Button
                      className="w-full justify-start"
                      variant={activeTab === "invites" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("invites")}
                    >
                      Composer Invites
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Content and Commerce
                    </p>
                    <Button
                      className="w-full justify-start"
                      variant={activeTab === "overview" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("overview")}
                    >
                      Overview
                    </Button>
                    <Button
                      className="w-full justify-start"
                      variant={activeTab === "compositions" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("compositions")}
                    >
                      Compositions
                    </Button>
                    <Button
                      className="w-full justify-between"
                      variant={activeTab === "transactions" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("transactions")}
                    >
                      Transactions
                      <Badge className="bg-amber-100 text-amber-800">
                        {pendingPaymentReviewCount}
                      </Badge>
                    </Button>
                    <Button
                      className="w-full justify-start"
                      variant={activeTab === "enrollments" ? "default" : "outline"}
                      onClick={() => goToTabFromMobileMenu("enrollments")}
                    >
                      Enrollments
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Open Tickets</p>
              <p className="text-base font-semibold">{supportTickets.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Requests</p>
              <p className="text-base font-semibold">{pendingRequests.length}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/40 p-2">
              <p className="text-[11px] text-muted-foreground">Payments</p>
              <p className="text-base font-semibold">
                {pendingPaymentReviewCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Sheet
        open={isUserProfileSheetOpen}
        onOpenChange={(open) => {
          setIsUserProfileSheetOpen(open);
          if (!open) setSelectedUserProfile(null);
        }}
      >
        <SheetContent side="right" className="w-[94vw] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>User Profile</SheetTitle>
            <SheetDescription>
              Full profile details and quick contact actions.
            </SheetDescription>
          </SheetHeader>
          {selectedUserProfile ? (
            <div className="mt-5 space-y-5">
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                {selectedUserProfile.avatar_url ? (
                  <img
                    src={
                      getOptimizedProfileImageUrl(selectedUserProfile.avatar_url, {
                        width: 160,
                        height: 160,
                        quality: 72,
                        resize: "cover",
                      }) || selectedUserProfile.avatar_url
                    }
                    alt={`${formatUserDisplay(selectedUserProfile)} avatar`}
                    className="size-14 rounded-full border border-border/70 object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="size-14 rounded-full border border-border/70 bg-secondary/60 text-secondary-foreground grid place-items-center text-sm font-semibold">
                    {getInitials(
                      selectedUserProfile.display_name,
                      selectedUserProfile.email,
                    )}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {selectedUserProfile.display_name || "N/A"}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {selectedUserProfile.email || "No email"}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Phone
                  </p>
                  <p className="mt-1 font-medium">
                    {selectedUserProfile.phone || "Not set"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Roles
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedUserProfileRoles.map((role) => (
                      <Badge key={role} variant="outline" className="capitalize">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Account Status
                  </p>
                  <p className="mt-1 font-medium">
                    {selectedUserProfile.is_active === false
                      ? "Suspended"
                      : "Active"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    User ID
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">
                    {selectedUserProfile.id}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Joined
                  </p>
                  <p className="mt-1 font-medium">
                    {formatDateTime(selectedUserProfile.created_at) || "N/A"}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 bg-card/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Last Updated
                  </p>
                  <p className="mt-1 font-medium">
                    {formatDateTime(selectedUserProfile.updated_at) || "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Button
                  onClick={() => {
                    openAdminChatComposer(selectedUserProfile, "direct");
                    setIsUserProfileSheetOpen(false);
                  }}
                  disabled={isProcessing || selectedUserProfile.is_active === false}
                >
                  <MessageCircleMore className="mr-2 size-4" />
                  Start Direct Chat
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsUserProfileSheetOpen(false);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
      <Tabs
        className="min-w-0 xl:flex-1 xl:min-h-0 xl:overflow-hidden"
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as AdminTab)}
      >
        <div
          className={`grid gap-6 ${
            isServiceMenuCollapsed
              ? "xl:grid-cols-[88px_minmax(0,1fr)]"
              : "xl:grid-cols-[280px_minmax(0,1fr)]"
          } min-w-0 xl:flex-1 xl:min-h-0 xl:items-stretch xl:overflow-hidden`}
        >
          <aside className="hidden xl:block xl:min-h-0 xl:overflow-hidden">
            <Card className="texture-speckle border-border/70 bg-card/95 h-full flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className={isServiceMenuCollapsed ? "hidden" : "block"}>
                    <CardTitle className="text-base">Service Menu</CardTitle>
                    <CardDescription>
                      Expand each heading to open its submenus.
                    </CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      setIsServiceMenuCollapsed((collapsed) => !collapsed)
                    }
                    aria-label={
                      isServiceMenuCollapsed
                        ? "Expand service menu"
                        : "Collapse service menu"
                    }
                  >
                    {isServiceMenuCollapsed ? (
                      <PanelLeftOpen className="size-4" />
                    ) : (
                      <PanelLeftClose className="size-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 min-h-0 overflow-y-auto">
                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    onClick={() => toggleServiceMenuGroup("customer")}
                  >
                    <span className={isServiceMenuCollapsed ? "hidden" : "block"}>
                      Customer Service
                    </span>
                    {expandedServiceMenuGroups.customer ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  {expandedServiceMenuGroups.customer && (
                    <div className="mt-2 space-y-2">
                      <Button
                        type="button"
                        className={sideMenuButtonClass(
                          activeTab === "support" && supportStateFilter === "unread",
                        )}
                        onClick={goToOpenTickets}
                      >
                        <MessageSquare
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && (
                          <>
                            Open Tickets
                            <Badge className="ml-auto bg-amber-100 text-amber-800">
                              {supportTickets.length}
                            </Badge>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(
                          activeTab === "support" && supportStateFilter !== "unread",
                        )}
                        onClick={goToAssignedChats}
                      >
                        <Send
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && (
                          <>
                            Assigned Chats
                            <Badge className="ml-auto bg-emerald-100 text-emerald-800">
                              {supportThreads.length}
                            </Badge>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "announcements")}
                        onClick={() => setActiveTab("announcements")}
                      >
                        <Bell
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "Announcements"}
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    onClick={() => toggleServiceMenuGroup("operations")}
                  >
                    <span className={isServiceMenuCollapsed ? "hidden" : "block"}>
                      User Operations
                    </span>
                    {expandedServiceMenuGroups.operations ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  {expandedServiceMenuGroups.operations && (
                    <div className="mt-2 space-y-2">
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "users")}
                        onClick={() => setActiveTab("users")}
                      >
                        <Users
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "User Management"}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "requests")}
                        onClick={() => setActiveTab("requests")}
                      >
                        <Check
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && (
                          <>
                            Role Requests
                            <Badge className="ml-auto bg-sky-100 text-sky-800">
                              {pendingRequests.length}
                            </Badge>
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "invites")}
                        onClick={() => setActiveTab("invites")}
                      >
                        <Plus
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "Composer Invites"}
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                    onClick={() => toggleServiceMenuGroup("commerce")}
                  >
                    <span className={isServiceMenuCollapsed ? "hidden" : "block"}>
                      Content and Commerce
                    </span>
                    {expandedServiceMenuGroups.commerce ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                  {expandedServiceMenuGroups.commerce && (
                    <div className="mt-2 space-y-2">
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "overview")}
                        onClick={() => setActiveTab("overview")}
                      >
                        <TrendingUp
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "Overview"}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "compositions")}
                        onClick={() => setActiveTab("compositions")}
                      >
                        <Music
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "Compositions"}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "transactions")}
                        onClick={() => setActiveTab("transactions")}
                      >
                        <DollarSign
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "Transactions"}
                      </Button>
                      <Button
                        type="button"
                        className={sideMenuButtonClass(activeTab === "enrollments")}
                        onClick={() => setActiveTab("enrollments")}
                      >
                        <GraduationCap
                          className={isServiceMenuCollapsed ? "size-4" : "mr-2 size-4"}
                        />
                        {!isServiceMenuCollapsed && "Enrollments"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="min-w-0 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden">
            <div className="w-full overflow-x-auto xl:hidden">
              <TabsList className="h-auto min-w-max gap-2 rounded-xl border border-border/70 bg-card/90 p-1">
                <TabsTrigger value="users" className="flex-none px-3">
                  Users
                </TabsTrigger>
                <TabsTrigger value="support" className="flex-none gap-2 px-3">
                  Support
                  {supportUnreadCount > 0 && (
                    <Badge className="bg-amber-100 text-amber-800">
                      {supportUnreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex-none px-3">
                  Requests
                </TabsTrigger>
                <TabsTrigger value="invites" className="flex-none px-3">
                  Invites
                </TabsTrigger>
                <TabsTrigger value="announcements" className="flex-none px-3">
                  Announcements
                </TabsTrigger>
                <TabsTrigger value="overview" className="flex-none px-3">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="enrollments" className="flex-none px-3">
                  Enrollments
                </TabsTrigger>
                <TabsTrigger value="compositions" className="flex-none px-3">
                  Compositions
                </TabsTrigger>
                <TabsTrigger value="transactions" className="flex-none px-3">
                  Transactions
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="xl:flex-1 xl:min-h-0 xl:overflow-y-auto xl:pr-1">
              {/* Overview */}
              <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <Card role="button" tabIndex={0} onClick={() => setActiveTab("users")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveTab("users"); } }} className="transition hover:cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
                    <Users className="size-5 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{totalUsers}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activeUsersCount} active, {composerCount} composers, {buyerCount} buyers
                    </p>
                  </CardContent>
                </Card>

                <Card role="button" tabIndex={0} onClick={() => setActiveTab("compositions")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveTab("compositions"); } }} className="transition hover:cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">
                      Total Compositions
                    </CardTitle>
                    <Music className="size-5 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{totalCompositions}</div>
                    <p className="mt-1 text-xs text-muted-foreground">Published works</p>
                  </CardContent>
                </Card>

                <Card role="button" tabIndex={0} onClick={() => setActiveTab("transactions")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveTab("transactions"); } }} className="transition hover:cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">
                      New Revenue
                    </CardTitle>
                    <DollarSign className="size-5 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {formatKesAmount(Number(revenueSinceReset || 0))}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Since last reset
                    </p>
                  </CardContent>
                </Card>

                <Card role="button" tabIndex={0} onClick={() => setActiveTab("transactions")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActiveTab("transactions"); } }} className="transition hover:cursor-pointer hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
                  <CardHeader className="flex items-center justify-between">
                    <CardTitle className="text-sm text-muted-foreground">
                      New Transactions
                    </CardTitle>
                    <TrendingUp className="size-5 text-orange-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{transactionsSinceReset}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Since last reset
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card className="bg-card/95">
                  <CardHeader className="pb-3">
                    <CardTitle>Action Queue</CardTitle>
                    <CardDescription>
                      Quick jumps to the work that needs attention.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("enrollments")}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:cursor-pointer hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <p className="text-xs text-muted-foreground">
                          Pending enrollments
                        </p>
                        <p className="text-2xl font-semibold">
                          {pendingEnrollmentCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {admittedEnrollmentCount} admitted
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("transactions")}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:cursor-pointer hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <p className="text-xs text-muted-foreground">
                          Payment reviews
                        </p>
                        <p className="text-2xl font-semibold">
                          {pendingPaymentReviewCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Awaiting review</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("compositions")}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:cursor-pointer hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <p className="text-xs text-muted-foreground">
                          Unverified compositions
                        </p>
                        <p className="text-2xl font-semibold">
                          {unverifiedCompositionsCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Needs approval</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => goToOpenTickets()}
                        className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:cursor-pointer hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <p className="text-xs text-muted-foreground">Support queue</p>
                        <p className="text-2xl font-semibold">
                          {supportUnreadCount}
                        </p>
                        <p className="text-xs text-muted-foreground">Unread chats</p>
                      </button>
                    </div>

                    <Collapsible
                      open={overviewMoreOpen}
                      onOpenChange={setOverviewMoreOpen}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">More actions</p>
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                          >
                            {overviewMoreOpen ? "Hide" : "Show"}
                            <ChevronDown
                              className={`ml-1 size-4 transition ${
                                overviewMoreOpen ? "rotate-180" : ""
                              }`}
                            />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="mt-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab("requests")}
                            className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:cursor-pointer hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <p className="text-xs text-muted-foreground">
                              Role requests
                            </p>
                            <p className="text-2xl font-semibold">
                              {pendingRequests.length}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Awaiting approval
                            </p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("invites")}
                            className="rounded-xl border border-border/70 bg-muted/20 p-3 text-left transition hover:cursor-pointer hover:bg-muted/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <p className="text-xs text-muted-foreground">
                              Pending invites
                            </p>
                            <p className="text-2xl font-semibold">
                              {pendingInviteCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Unused links
                            </p>
                          </button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>

                <Card className="bg-card/98">
                  <CardHeader className="pb-3">
                    <CardTitle>Insights</CardTitle>
                    <CardDescription>
                      Expand for unread sales and the composer leaderboard.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Collapsible
                      open={overviewActivityOpen}
                      onOpenChange={setOverviewActivityOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-left transition hover:cursor-pointer hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Unread transactions</p>
                            <p className="text-xs text-muted-foreground">
                              {unreadRecentTransactions.length} unread
                            </p>
                          </div>
                          <ChevronDown
                            className={`size-4 shrink-0 transition ${
                              overviewActivityOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                        <div className="space-y-2">
                          {transactionsLoading && transactions.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
                              <Loader className="size-4 animate-spin" />
                              Loading transactions...
                            </div>
                          ) : unreadRecentTransactions.length === 0 ? (
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
                              All caught up. No unread transactions.
                            </div>
                          ) : (
                            unreadRecentTransactions.slice(0, 3).map((t) => (
                              <div
                                key={t.id}
                                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {t.compositions?.title || "Unknown"}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {t.buyers?.users?.display_name ||
                                      t.buyers?.users?.email ||
                                      "Unknown"}{" "}
                                    •{" "}
                                    {formatDateTime(
                                      t.purchased_at ||
                                        t.purchasedAt ||
                                        t.submitted_at ||
                                        t.submittedAt ||
                                        t.created_at ||
                                        t.createdAt ||
                                        "",
                                    )}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-semibold">
                                    {formatKesAmount(Number(t.price_paid || 0))}
                                  </p>
                                  <Badge
                                    className={`mt-2 ${
                                      t.status === "pending"
                                        ? "bg-amber-100 text-amber-800"
                                        : t.status === "rejected"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {(t.status || "approved")
                                      .toString()
                                      .toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={markAllTransactionsRead}
                            disabled={isProcessing || unreadRecentTransactions.length === 0}
                          >
                            <Check className="mr-2 size-4" />
                            Mark All Read
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={resetTransactionsToZero}
                            disabled={
                              isProcessing ||
                              (transactionsSinceReset === 0 &&
                                revenueSinceReset === 0 &&
                                unreadRecentTransactions.length === 0)
                            }
                          >
                            <Trash2 className="mr-2 size-4" />
                            Reset Sales to 0
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setActiveTab("transactions")}
                          >
                            Open Transactions
                            <ChevronRight className="ml-2 size-4" />
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={overviewLeaderboardOpen}
                      onOpenChange={setOverviewLeaderboardOpen}
                    >
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-left transition hover:cursor-pointer hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">Top composers</p>
                            <p className="text-xs text-muted-foreground">
                              Revenue leaderboard
                            </p>
                          </div>
                          <ChevronDown
                            className={`size-4 shrink-0 transition ${
                              overviewLeaderboardOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-3 space-y-3">
                        <div className="space-y-2">
                          {overviewLoading && composerStats.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
                              <Loader className="size-4 animate-spin" />
                              Loading leaderboard...
                            </div>
                          ) : composerStats.length === 0 ? (
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
                              No composer earnings to show yet.
                            </div>
                          ) : (
                            composerStats.slice(0, 3).map((c) => (
                              <div
                                key={c.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/60 p-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {c.display_name}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {c.compositionCount} compositions •{" "}
                                    {c.salesCount} sales
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold">
                                  {formatKesAmount(Number(c.revenue || 0))}
                                </p>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveTab("compositions")}
                          >
                            Open Compositions
                            <ChevronRight className="ml-2 size-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setUserRoleFilter("composer");
                              setUserStatusFilter("all");
                              setUserSearchQuery("");
                              setActiveTab("users");
                            }}
                          >
                            View Composers
                            <ChevronRight className="ml-2 size-4" />
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Manage platform users and roles</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={userSearchQuery}
                      onChange={(event) => setUserSearchQuery(event.target.value)}
                      placeholder="Search users..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={userRoleFilter}
                    onValueChange={(value) =>
                      setUserRoleFilter(value as typeof userRoleFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="composer">Composer</SelectItem>
                      <SelectItem value="buyer">Buyer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={userStatusFilter}
                    onValueChange={(value) =>
                      setUserStatusFilter(value as typeof userStatusFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <PdfFieldExportMenu
                    disabled={filteredUsers.length === 0}
                    fields={USERS_REPORT_FIELDS}
                    storageKey="admin.usersReportPdfFields"
                    menuLabel="Users report fields"
                    onExport={exportUsersPdf}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[760px]">
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
                    <LoadingTableRow colSpan={5} label="Loading users..." />
                  )}
                  {!usersLoading && filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No users match your search and filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredUsers.map((u) => {
                    const resolvedRoles = resolveUserRoles(u);
                    const isAdmin = resolvedRoles.includes("admin");
                    const isComposer = resolvedRoles.includes("composer");
                    const isSuspended = u.is_active === false;
                    const isSelf = appUser?.id === u.id;
                    return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img
                              src={
                                getOptimizedProfileImageUrl(u.avatar_url, {
                                  width: 96,
                                  height: 96,
                                  quality: 68,
                                  resize: "cover",
                                }) || u.avatar_url
                              }
                              alt={`${u.display_name || u.email || "User"} avatar`}
                              className="size-9 rounded-full object-cover border border-border/70 bg-muted"
                              loading="lazy"
                              decoding="async"
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
                              onClick={() => openUserProfileSheet(u)}
                              disabled={isProcessing}
                            >
                              <Eye className="mr-2 size-4" />
                              View Full Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {!isComposer ? (
                              <DropdownMenuItem
                                onClick={() => promoteUserToComposer(u.id)}
                                disabled={isProcessing}
                              >
                                Promote to Composer
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => demoteUserFromComposer(u.id)}
                                disabled={isProcessing}
                                className="text-amber-600"
                              >
                                Remove Composer
                              </DropdownMenuItem>
                            )}

                            {!isAdmin ? (
                              <DropdownMenuItem
                                onClick={() => promoteUserToAdmin(u.id)}
                                disabled={isProcessing}
                              >
                                Promote to Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => demoteUserFromAdmin(u.id)}
                                disabled={isProcessing}
                                className="text-amber-600"
                              >
                                Remove Admin
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => openAdminChatComposer(u, "direct")}
                              disabled={isProcessing || isSuspended}
                            >
                              <MessageCircleMore className="mr-2 size-4" />
                              Initiate Direct Chat
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openAdminChatComposer(u, "notification")}
                              disabled={isProcessing || isSuspended}
                            >
                              <Bell className="mr-2 size-4" />
                              Send Notification
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              onClick={() => openAdminChatComposer(u, "ticket")}
                              disabled={isProcessing || isSuspended}
                            >
                              <MessageSquare className="mr-2 size-4" />
                              Open Ticket Chat
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {isSuspended ? (
                              <DropdownMenuItem
                                onClick={() => unsuspendUser(u.id)}
                                disabled={isProcessing}
                              >
                                <CheckCircle className="size-4 mr-2" />
                                Activate User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => suspendUser(u.id)}
                                disabled={isProcessing}
                              >
                                <Ban className="size-4 mr-2" /> Suspend User
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-red-700"
                              onClick={() => deleteUser(u)}
                              disabled={isProcessing || isSelf}
                            >
                              <Trash2 className="size-4 mr-2" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites */}
        <TabsContent value="invites" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Add Composer Invite</CardTitle>
              <CardDescription>
                Enter an email to allow that user to register as composer
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <input
                className="flex-1 rounded border px-3 py-2"
                placeholder="composer@example.com"
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                disabled={isProcessing}
              />
              <Button
                onClick={() => addComposerInvite(newInviteEmail)}
                disabled={isProcessing}
              >
                <Plus className="mr-2 size-4" />
                Add Invite
              </Button>
            </CardContent>
            {invites.length > 0 && (
              <CardContent>
                <div className="mb-2 text-sm text-muted-foreground">Recent invites</div>
                <Table className="min-w-[720px]">
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
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>Role Requests</CardTitle>
                  <CardDescription>Pending composer/admin access requests</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-72">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={requestSearchQuery}
                      onChange={(event) => setRequestSearchQuery(event.target.value)}
                      placeholder="Search requests..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={requestRoleFilter}
                    onValueChange={(value) =>
                      setRequestRoleFilter(value as typeof requestRoleFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[170px]">
                      <SelectValue placeholder="Requested role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="composer">Composer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <PdfFieldExportMenu
                    disabled={filteredRequests.length === 0}
                    fields={REQUESTS_REPORT_FIELDS}
                    storageKey="admin.requestsReportPdfFields"
                    menuLabel="Requests report fields"
                    onExport={exportRequestsPdf}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests.</p>
              ) : (
                <Table className="min-w-[920px]">
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
                    {filteredRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            No requests match your search and filters.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredRequests.map((r) => (
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

        {/* Enrollments */}
        <TabsContent value="enrollments" className="mt-6">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="size-5 text-primary" />
                      Enrollment Requests
                    </CardTitle>
                    <CardDescription>
                      Review new class enrollments and admit approved students.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={
                        enrollmentStatusFilter === "pending" ? "default" : "outline"
                      }
                      onClick={() => setEnrollmentStatusFilter("pending")}
                    >
                      Pending
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        enrollmentStatusFilter === "admitted" ? "default" : "outline"
                      }
                      onClick={() => setEnrollmentStatusFilter("admitted")}
                    >
                      Admitted
                    </Button>
                    <Button
                      size="sm"
                      variant={enrollmentStatusFilter === "all" ? "default" : "outline"}
                      onClick={() => setEnrollmentStatusFilter("all")}
                    >
                      All
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={enrollmentSearchQuery}
                      onChange={(event) =>
                        setEnrollmentSearchQuery(event.target.value)
                      }
                      placeholder="Search enrollments..."
                      className="pl-9"
                    />
                  </div>
                  <PdfFieldExportMenu
                    disabled={filteredEnrollments.length === 0}
                    fields={ENROLLMENTS_REPORT_FIELDS}
                    storageKey="admin.enrollmentsReportPdfFields"
                    menuLabel="Enrollments report fields"
                    onExport={exportEnrollmentsPdf}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollmentsLoading && enrollments.length === 0 && (
                    <LoadingTableRow colSpan={9} label="Loading enrollments..." />
                  )}
                  {!enrollmentsLoading && enrollments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No enrollments found.
                      </TableCell>
                    </TableRow>
                  )}
                  {!enrollmentsLoading &&
                    enrollments.length > 0 &&
                    filteredEnrollments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center">
                          <p className="text-sm text-muted-foreground">
                            No enrollments match your search.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  {filteredEnrollments.map((enrollment: any) => (
                    <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">
                        {enrollment.full_name ||
                          enrollment.requester?.display_name ||
                          "N/A"}
                      </TableCell>
                      <TableCell>
                        {enrollment.email || enrollment.requester?.email || "N/A"}
                      </TableCell>
                      <TableCell>{enrollment.music_class || "N/A"}</TableCell>
                      <TableCell className="capitalize">
                        {String(enrollment.skill_level || "N/A")}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {enrollment.notes || "-"}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(enrollment.created_at) || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            enrollment.status === "admitted"
                              ? "bg-green-100 text-green-800"
                              : enrollment.status === "rejected"
                                ? "bg-red-100 text-red-800"
                                : "bg-amber-100 text-amber-800"
                          }
                        >
                          {String(enrollment.status || "pending").toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {enrollment.admitted_at
                          ? `${enrollment.admitted_admin?.display_name || enrollment.admitted_admin?.email || "Admin"} - ${formatDateTime(enrollment.admitted_at)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {enrollment.status === "pending" ? (
                          <Button
                            size="sm"
                            onClick={() => admitEnrollment(enrollment)}
                            disabled={isProcessing}
                          >
                            <Check className="mr-2 size-4" />
                            Admit
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compositions */}
        <TabsContent value="compositions" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>All Compositions</CardTitle>
                  <CardDescription>
                    Manage and moderate published compositions
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={compositionSearchQuery}
                      onChange={(event) =>
                        setCompositionSearchQuery(event.target.value)
                      }
                      placeholder="Search compositions..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={compositionVerificationFilter}
                    onValueChange={(value) =>
                      setCompositionVerificationFilter(
                        value as typeof compositionVerificationFilter,
                      )
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Verification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="unverified">Unverified</SelectItem>
                    </SelectContent>
                  </Select>
                  <PdfFieldExportMenu
                    disabled={filteredCompositions.length === 0}
                    fields={COMPOSITIONS_REPORT_FIELDS}
                    storageKey="admin.compositionsReportPdfFields"
                    menuLabel="Compositions report fields"
                    onExport={exportCompositionsPdf}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Composer</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compositionsLoading && compositions.length === 0 && (
                    <LoadingTableRow
                      colSpan={6}
                      label="Loading compositions..."
                    />
                  )}
                  {!compositionsLoading && filteredCompositions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No compositions match your search and filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredCompositions.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {c.description || ""}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.composers?.users?.display_name || "Unknown"}
                      </TableCell>
                      <TableCell>{formatKesAmount(Number(c.price || 0))}</TableCell>
                      <TableCell>
                        {new Date(
                          c.created_at || c.createdAt || "",
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            className={
                              c.is_verified
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }
                          >
                            {c.is_verified ? "Verified" : "Unverified"}
                          </Badge>
                          {c.is_verified && c.verified_at ? (
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.verified_at).toLocaleDateString()}
                            </span>
                          ) : null}
                        </div>
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
                              <Eye className="size-4 mr-2" /> View PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => reviewAndVerifyComposition(c)}
                              disabled={isProcessing || Boolean(c.is_verified)}
                            >
                              <CheckCircle className="size-4 mr-2" /> Review &
                              Verify
                            </DropdownMenuItem>
                            {c.is_verified ? (
                              <DropdownMenuItem
                                onClick={() => unverifyComposition(c)}
                                disabled={isProcessing}
                              >
                                <X className="size-4 mr-2" /> Mark Unverified
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => verifyComposition(c)}
                                disabled={isProcessing}
                              >
                                <CheckCircle className="size-4 mr-2" /> Mark
                                Verified
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => removeComposition(c)}
                              disabled={isProcessing}
                            >
                              <Trash2 className="size-4 mr-2" /> Delete Composition
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
          <Card className="bg-card/98">
            <CardHeader className="border-b border-border/60 bg-card/92">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle>All Transactions</CardTitle>
                  <CardDescription>Complete transaction history</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={transactionSearchQuery}
                      onChange={(event) =>
                        setTransactionSearchQuery(event.target.value)
                      }
                      placeholder="Search transactions..."
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={transactionStatusFilter}
                    onValueChange={(value) =>
                      setTransactionStatusFilter(value as typeof transactionStatusFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={transactionSourceFilter}
                    onValueChange={(value) =>
                      setTransactionSourceFilter(value as typeof transactionSourceFilter)
                    }
                  >
                    <SelectTrigger size="sm" className="w-full sm:w-[190px]">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="payment_submission">Payment submission</SelectItem>
                    </SelectContent>
                  </Select>
                  <PdfFieldExportMenu
                    disabled={filteredTransactions.length === 0}
                    fields={TRANSACTIONS_REPORT_FIELDS}
                    storageKey="admin.transactionsReportPdfFields"
                    menuLabel="Transactions report fields"
                    onExport={exportTransactionsPdf}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetTransactionsToZero}
                    disabled={
                      isProcessing ||
                      (transactionsSinceReset === 0 && revenueSinceReset === 0)
                    }
                  >
                    <Trash2 className="mr-2 size-4" />
                    Reset Sales
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[1260px]">
                <TableHeader className="bg-card/88">
                  <TableRow className="bg-card/88 hover:bg-card/88">
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
                <TableBody className="[&_tr]:bg-card/72 [&_tr:hover]:bg-muted/55">
                  {transactionsLoading && transactions.length === 0 && (
                    <LoadingTableRow
                      colSpan={8}
                      label="Loading transactions..."
                    />
                  )}
                  {!transactionsLoading && filteredTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center">
                        <p className="text-sm text-muted-foreground">
                          No transactions match your search and filters.
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredTransactions.map((p) => (
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
                        {formatKesAmount(Number(p.price_paid || 0))}
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
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements */}        
        <TabsContent value="announcements" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="size-5 text-primary" />
                Announcements
              </CardTitle>
              <CardDescription>
                Broadcast updates to selected user roles with AI-assisted drafting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-border/70">
                <div className="border-b border-border/60 px-3 py-2 text-sm font-semibold">
                  Make Announcement
                </div>
                <div className="space-y-3 p-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Target Roles
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {ANNOUNCEMENT_ROLE_OPTIONS.map((roleOption) => (
                        <label
                          key={roleOption.value}
                          className="flex items-center gap-2 rounded-md border border-border/70 px-2 py-1.5 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={announcementRoles.includes(roleOption.value)}
                            onChange={() => toggleAnnouncementRole(roleOption.value)}
                            disabled={isProcessing}
                          />
                          <span>{roleOption.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Announcement Subject
                    </label>
                    <input
                      className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                      value={announcementSubject}
                      onChange={(e) => setAnnouncementSubject(e.target.value)}
                      placeholder="Platform announcement"
                      disabled={isProcessing}
                      maxLength={160}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Announcement Message
                    </label>
                    <Textarea
                      value={announcementMessage}
                      onChange={(e) => setAnnouncementMessage(e.target.value)}
                      placeholder="Write your announcement for the selected roles..."
                      rows={5}
                      maxLength={4000}
                      disabled={isProcessing}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 min-w-[140px]"
                      onClick={() => void improveAnnouncementDraft()}
                      disabled={
                        isProcessing ||
                        announcementRoles.length === 0 ||
                        !announcementMessage.trim()
                      }
                    >
                      <Sparkles className="mr-2 size-4" />
                      AI Compose
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 min-w-[170px]"
                      onClick={() => void sendRoleAnnouncement()}
                      disabled={
                        isProcessing ||
                        announcementRoles.length === 0 ||
                        !announcementMessage.trim()
                      }
                    >
                      <Send className="mr-2 size-4" />
                      Send Announcement
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Support Panel */}
        <TabsContent value="support" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="size-5 text-primary" />
                    Support Panel
                  </CardTitle>
                  <CardDescription>
                    Manage notification chats, ticket chats, and direct chats with users.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={supportStateFilter === "unread" ? "default" : "outline"}
                    onClick={() => setSupportStateFilter("unread")}
                  >
                    Unread
                  </Button>
                  <Button
                    size="sm"
                    variant={supportStateFilter === "read" ? "default" : "outline"}
                    onClick={() => setSupportStateFilter("read")}
                  >
                    Read
                  </Button>
                  <Button
                    size="sm"
                    variant={supportStateFilter === "all" ? "default" : "outline"}
                    onClick={() => setSupportStateFilter("all")}
                  >
                    All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-4">
                  <div className="rounded-xl border border-border/70">
                    <div className="border-b border-border/60 px-3 py-2 text-sm font-semibold">
                      Start User Chat
                    </div>
                    <div className="space-y-3 p-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          User
                        </label>
                        <select
                          className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                          value={adminChatTargetUserId}
                          onChange={(e) => {
                            const nextUserId = e.target.value;
                            const nextUser =
                              users.find((user: any) => user.id === nextUserId) || null;
                            setAdminChatTargetUserId(nextUserId);
                            setAdminChatSubject((prev) =>
                              prev.trim()
                                ? prev
                                : defaultAdminChatSubject(adminChatType, nextUser),
                            );
                          }}
                          disabled={isProcessing}
                        >
                          <option value="">Select a user</option>
                          {users.map((user: any) => (
                            <option key={user.id} value={user.id}>
                              {formatUserDisplay(user)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Chat Type
                        </label>
                        <select
                          className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                          value={adminChatType}
                          onChange={(e) => {
                            const nextType = e.target.value as AdminThreadType;
                            setAdminChatType(nextType);
                            setAdminChatSubject((prev) =>
                              prev.trim()
                                ? prev
                                : defaultAdminChatSubject(nextType, selectedAdminChatTarget),
                            );
                          }}
                          disabled={isProcessing}
                        >
                          <option value="notification">Notification</option>
                          <option value="ticket">Ticket Chat</option>
                          <option value="direct">Direct Chat</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Subject
                        </label>
                        <input
                          className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                          value={adminChatSubject}
                          onChange={(e) => setAdminChatSubject(e.target.value)}
                          placeholder={
                            defaultAdminChatSubject(
                              adminChatType,
                              selectedAdminChatTarget,
                            ) || "Subject"
                          }
                          disabled={isProcessing}
                          maxLength={160}
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          First Message
                        </label>
                        <Textarea
                          value={adminChatMessage}
                          onChange={(e) => setAdminChatMessage(e.target.value)}
                          placeholder="Write the first message to the user..."
                          rows={3}
                          maxLength={4000}
                          disabled={isProcessing}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 min-w-[140px]"
                          onClick={() => void improveAdminChatDraft()}
                          disabled={isProcessing || !adminChatMessage.trim()}
                        >
                          <Sparkles className="mr-2 size-4" />
                          AI Polish
                        </Button>
                        <Button
                          onClick={() => void createAdminThread()}
                          className="flex-1 min-w-[170px]"
                          disabled={
                            isProcessing ||
                            !adminChatTargetUserId.trim() ||
                            !adminChatMessage.trim()
                          }
                        >
                          {isProcessing ? (
                            <>
                              <Loader className="mr-2 size-4 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Send className="mr-2 size-4" />
                              Start {ADMIN_CHAT_TYPE_LABELS[adminChatType]}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70">
                    <div className="border-b border-border/60 px-3 py-2 text-sm font-semibold">
                      Ticket Requests ({supportTickets.length})
                    </div>
                    <div className="max-h-[280px] overflow-y-auto p-2">
                      {supportTicketsLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                          <Loader className="size-4 animate-spin" />
                          Loading tickets...
                        </div>
                      ) : supportTickets.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          No open tickets in queue.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {supportTickets.map((ticket: any) => (
                            <div
                              key={ticket.id}
                              className="rounded-lg border border-border/70 bg-card px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-1 text-sm font-semibold">
                                  {ticket.subject || "Support Request"}
                                </p>
                                <Badge className="bg-sky-100 text-sky-800">Open</Badge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                {ticket.last_message_preview || "No messages"}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {ticket.requester?.display_name ||
                                  ticket.requester?.email ||
                                  "Unknown user"}{" "}
                                - {formatDateTime(ticket.last_message_at)}
                              </p>
                              {Number(ticket.ticket_rejection_count || 0) > 0 && (
                                <p className="mt-1 text-[11px] text-amber-700">
                                  Rejections: {Number(ticket.ticket_rejection_count || 0)}
                                </p>
                              )}
                              <div className="mt-2 flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => void pickSupportTicket(ticket.id)}
                                  disabled={isProcessing}
                                >
                                  <Check className="mr-2 size-4" />
                                  Pick
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void rejectSupportTicket(ticket.id)}
                                  disabled={isProcessing}
                                >
                                  <X className="mr-2 size-4" />
                                  Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70">
                    <div className="border-b border-border/60 px-3 py-2 text-sm font-semibold">
                      Assigned Chats ({supportThreads.length})
                    </div>
                    <div className="max-h-[280px] overflow-y-auto p-2">
                      {supportThreadsLoading ? (
                        <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                          <Loader className="size-4 animate-spin" />
                          Loading assigned chats...
                        </div>
                      ) : supportThreads.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          You have no assigned chats in this filter.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {supportThreads.map((thread: any) => {
                            const active = thread.id === selectedSupportThreadId;
                            const contextBadge = resolveThreadContextLabel(
                              thread.context,
                            );
                            return (
                              <button
                                key={thread.id}
                                type="button"
                                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                                  active
                                    ? "border-primary bg-primary/10"
                                    : "border-border/70 bg-card hover:bg-muted/40"
                                }`}
                                onClick={() => setSelectedSupportThreadId(thread.id)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="line-clamp-1 text-sm font-semibold">
                                    {thread.subject || "Support Request"}
                                  </p>
                                  <div className="flex flex-col items-end gap-1">
                                    <Badge className={contextBadge.className}>
                                      {contextBadge.label}
                                    </Badge>
                                    <Badge
                                      className={
                                        thread.is_admin_unread
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-emerald-100 text-emerald-800"
                                      }
                                    >
                                      {thread.is_admin_unread ? "Unread" : "Read"}
                                    </Badge>
                                  </div>
                                </div>
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {thread.last_message_preview || "No messages"}
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {thread.requester?.display_name ||
                                    thread.requester?.email ||
                                    "Unknown user"}{" "}
                                  - {formatDateTime(thread.last_message_at)}
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 overflow-hidden rounded-xl border border-border/70">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
                    <div>
                      <p className="max-w-full break-words font-semibold">
                        {selectedSupportThread?.subject || "Select an assigned support chat"}
                      </p>
                      {selectedSupportThread && (
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {selectedSupportThread.requester?.display_name ||
                              selectedSupportThread.requester?.email ||
                              "Unknown user"}
                          </p>
                          <Badge
                            className={
                              resolveThreadContextLabel(selectedSupportThread.context)
                                .className
                            }
                          >
                            {
                              resolveThreadContextLabel(selectedSupportThread.context)
                                .label
                            }
                          </Badge>
                        </div>
                      )}
                    </div>
                    {selectedSupportThread && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markSupportThreadRead(selectedSupportThread.id)}
                          disabled={isProcessing}
                        >
                          Mark Read
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => deleteSupportThread(selectedSupportThread.id)}
                          disabled={isProcessing}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="max-h-[420px] min-h-[300px] overflow-y-auto bg-muted/20 p-4">
                    {!selectedSupportThread ? (
                      <p className="text-sm text-muted-foreground">
                        Pick a ticket and then select it from Assigned Chats to reply.
                      </p>
                    ) : supportMessagesLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader className="size-4 animate-spin" />
                        Loading messages...
                      </div>
                    ) : supportMessages.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No messages yet in this conversation.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {supportMessages.map((message: any) => {
                          const isAdminMessage = message.sender_role === "admin";
                          return (
                            <div
                              key={message.id}
                              className={`flex ${
                                isAdminMessage ? "justify-end" : "justify-start"
                              }`}
                            >
                              <div
                                className={`max-w-[84%] rounded-xl px-3 py-2 text-sm ${
                                  isAdminMessage
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border/70 bg-card text-foreground"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words">
                                  {message.message}
                                </p>
                                <p
                                  className={`mt-1 text-[11px] ${
                                    isAdminMessage
                                      ? "text-primary-foreground/80"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {isAdminMessage ? "Admin" : "Member"} -{" "}
                                  {formatDateTime(message.created_at)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border/60 p-4">
                    <Textarea
                      value={supportReply}
                      onChange={(e) => setSupportReply(e.target.value)}
                      placeholder={
                        selectedSupportThread
                          ? "Reply to member..."
                          : "Select an assigned chat to reply"
                      }
                      rows={3}
                      maxLength={4000}
                      disabled={!selectedSupportThread || isProcessing}
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void improveSupportReplyDraft()}
                        disabled={
                          !selectedSupportThread ||
                          !supportReply.trim() ||
                          isProcessing
                        }
                      >
                        <Sparkles className="mr-2 size-4" />
                        AI Polish Reply
                      </Button>
                      <Button
                        onClick={() => void sendSupportReply()}
                        disabled={
                          !selectedSupportThread ||
                          !supportReply.trim() ||
                          isProcessing
                        }
                      >
                        {isProcessing ? (
                          <>
                            <Loader className="mr-2 size-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 size-4" />
                            Send Reply
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}








