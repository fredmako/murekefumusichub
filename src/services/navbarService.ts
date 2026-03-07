import { toast } from "sonner";
import { apiRequest } from "@/services/api";
import { ensureArray } from "@/lib/ensureArray";

type NavbarNotificationItem = {
  id: string;
  type: string;
  createdAt?: string;
  [key: string]: any;
};

export const navbarService = {
  async fetchUserRoles(authUid: string) {
    try {
      const roles = await apiRequest<any[]>(`/user/roles/${authUid}`);
      return roles || [];
    } catch (err: any) {
      console.warn("fetchUserRoles error:", err);
      return [];
    }
  },

  async fetchAdminNotifications() {
    const notifications = await apiRequest<any>(`/admin/notifications`, {
      requiresAuth: true,
    });
    return ensureArray<any>(notifications, ["notifications"]);
  },

  async fetchSupportInbox(limit = 200) {
    const payload = await apiRequest<any>(`/support/inbox?limit=${limit}`, {
      method: "GET",
      timeoutMs: 30000,
      requiresAuth: true,
    });

    const unreadThreads = ensureArray<any>(payload?.unreadThreads, [
      "threads",
      "tickets",
    ]);
    const unreadCount =
      Number.isFinite(Number(payload?.unreadCount)) && Number(payload?.unreadCount) >= 0
        ? Number(payload.unreadCount)
        : unreadThreads.length;

    const items: NavbarNotificationItem[] = unreadThreads.map((thread) => ({
      id: `message:${thread.id}`,
      type: "message",
      threadId: thread.id,
      subject: thread.subject || "New message",
      preview: thread.last_message_preview || "",
      status: thread.status || "active",
      context: thread.context || "support",
      createdAt:
        thread.last_message_at ||
        thread.updated_at ||
        thread.created_at ||
        new Date().toISOString(),
    }));

    return {
      unreadCount,
      items,
    };
  },

  async fetchNotifications(options: { isAdmin: boolean }) {
    const { isAdmin } = options;

    const [inboxResult, adminNotifications] = await Promise.all([
      this.fetchSupportInbox().catch((err) => {
        const status = Number((err as any)?.status || 0);
        if (status !== 403 && status !== 404) {
          console.warn("fetchSupportInbox error:", err);
        }
        return {
          unreadCount: 0,
          items: [] as NavbarNotificationItem[],
        };
      }),
      isAdmin
        ? this.fetchAdminNotifications().catch((err) => {
            const status = Number((err as any)?.status || 0);
            if (status !== 403) {
              console.warn("fetchAdminNotifications error:", err);
            }
            return [];
          })
        : Promise.resolve([]),
    ]);

    const items = [...(inboxResult.items || []), ...(adminNotifications || [])].sort(
      (a, b) => {
        const aTime = new Date(a?.createdAt || a?.created_at || 0).getTime();
        const bTime = new Date(b?.createdAt || b?.created_at || 0).getTime();
        return bTime - aTime;
      },
    );

    return {
      items,
      messengerUnreadCount: Number(inboxResult.unreadCount || 0),
    };
  },

  async approveRoleRequest(userId: string, requestedRole: "composer" | "admin") {
    try {
      const endpoint =
        requestedRole === "admin"
          ? `/admin/users/${userId}/promote-admin`
          : `/admin/users/${userId}/promote-composer`;
      const result = await apiRequest<any>(endpoint, {
        method: "POST",
        requiresAuth: true,
      });
      toast.success(
        `${requestedRole === "admin" ? "Admin" : "Composer"} request approved`,
      );
      return result;
    } catch (err: any) {
      console.error("approveRoleRequest error:", err);
      toast.error(err.message || "Failed to approve request");
      throw err;
    }
  },

  async rejectRoleRequest(userId: string, requestedRole: "composer" | "admin") {
    try {
      const result = await apiRequest<any>(
        `/admin/role-requests/${userId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ requestedRole }),
          requiresAuth: true,
        },
      );
      toast.success(
        `${requestedRole === "admin" ? "Admin" : "Composer"} request rejected`,
      );
      return result;
    } catch (err: any) {
      console.error("rejectRoleRequest error:", err);
      toast.error(err.message || "Failed to reject request");
      throw err;
    }
  },

  async approvePaymentSubmission(submissionId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/payment-submissions/${submissionId}/approve`,
        {
          method: "POST",
          requiresAuth: true,
        },
      );
      toast.success("Payment approved");
      return result;
    } catch (err: any) {
      console.error("approvePaymentSubmission error:", err);
      toast.error(err.message || "Failed to approve payment");
      throw err;
    }
  },

  async rejectPaymentSubmission(submissionId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/payment-submissions/${submissionId}/reject`,
        {
          method: "POST",
          requiresAuth: true,
        },
      );
      toast.success("Payment rejected");
      return result;
    } catch (err: any) {
      console.error("rejectPaymentSubmission error:", err);
      toast.error(err.message || "Failed to reject payment");
      throw err;
    }
  },
};

