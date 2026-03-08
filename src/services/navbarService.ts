import { toast } from "sonner";
import { apiRequest } from "@/services/api";
import { ensureArray } from "@/lib/ensureArray";

type NavbarNotificationItem = {
  id: string;
  type: string;
  createdAt?: string;
  [key: string]: any;
};

function normalizeContext(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isSystemNotificationContext(context: unknown) {
  const normalized = normalizeContext(context);
  return normalized.includes("announcement") || normalized.includes("notification");
}

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

  async fetchReadNotificationIds() {
    const payload = await apiRequest<any>(`/notifications/read`, {
      method: "GET",
      requiresAuth: true,
    });
    return new Set(
      ensureArray<string>(payload, ["ids", "notificationIds"])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    );
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

    const mappedThreads: NavbarNotificationItem[] = unreadThreads.map((thread) => {
      const context = thread.context || "support";
      return {
        id: `message:${thread.id}`,
        type: "message",
        threadId: thread.id,
        subject: thread.subject || "New message",
        preview: thread.last_message_preview || "",
        status: thread.status || "active",
        context,
        createdAt:
          thread.last_message_at ||
          thread.updated_at ||
          thread.created_at ||
          new Date().toISOString(),
      };
    });

    const notificationItems = mappedThreads
      .filter((thread) => isSystemNotificationContext(thread.context))
      .map((thread) => ({
        ...thread,
        type: normalizeContext(thread.context).includes("announcement")
          ? "announcement"
          : "notification",
      }));
    const messengerItems = mappedThreads.filter(
      (thread) => !isSystemNotificationContext(thread.context),
    );

    return {
      unreadCount,
      messengerUnreadCount: messengerItems.length,
      messengerItems,
      notificationItems,
    };
  },

  async fetchNotifications(options: { isAdmin: boolean }) {
    const { isAdmin } = options;

    const [inboxResult, adminNotifications, readNotificationIds] = await Promise.all([
      this.fetchSupportInbox().catch((err) => {
        const status = Number((err as any)?.status || 0);
        if (status !== 403 && status !== 404) {
          console.warn("fetchSupportInbox error:", err);
        }
        return {
          unreadCount: 0,
          messengerUnreadCount: 0,
          messengerItems: [] as NavbarNotificationItem[],
          notificationItems: [] as NavbarNotificationItem[],
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
        : Promise.resolve([] as NavbarNotificationItem[]),
      isAdmin
        ? this.fetchReadNotificationIds().catch((err) => {
            const status = Number((err as any)?.status || 0);
            if (status !== 403 && status !== 404) {
              console.warn("fetchReadNotificationIds error:", err);
            }
            return new Set<string>();
          })
        : Promise.resolve(new Set<string>()),
    ]);

    const supportNotificationItems = isAdmin
      ? []
      : ensureArray<any>(inboxResult.notificationItems, ["notifications"]);
    const notificationItems = [
      ...supportNotificationItems,
      ...ensureArray<any>(adminNotifications, ["notifications"]),
    ]
      .filter((item) => !readNotificationIds.has(String(item?.id || "").trim()))
      .sort(
      (a, b) => {
        const aTime = new Date(a?.createdAt || a?.created_at || 0).getTime();
        const bTime = new Date(b?.createdAt || b?.created_at || 0).getTime();
        return bTime - aTime;
      },
      );

    return {
      notificationItems,
      messengerUnreadCount: Math.max(
        0,
        Number(inboxResult.messengerUnreadCount || 0),
      ),
    };
  },

  async markNotificationsRead(items: NavbarNotificationItem[]) {
    const normalizedItems = ensureArray<NavbarNotificationItem>(items, ["notifications"]);
    const threadIds = [...new Set(
      normalizedItems
        .map((item) => String(item?.threadId || "").trim())
        .filter(Boolean),
    )];
    const notificationIds = [...new Set(
      normalizedItems
        .filter((item) => !item?.threadId)
        .map((item) => String(item?.id || "").trim())
        .filter(Boolean),
    )];

    const operations: Promise<unknown>[] = [];
    if (threadIds.length > 0) {
      operations.push(
        Promise.all(
          threadIds.map((threadId) =>
            apiRequest(`/support/threads/${threadId}/read`, {
              method: "POST",
              requiresAuth: true,
            }),
          ),
        ),
      );
    }
    if (notificationIds.length > 0) {
      operations.push(
        apiRequest(`/notifications/mark-read`, {
          method: "POST",
          body: JSON.stringify({ notificationIds }),
          requiresAuth: true,
        }),
      );
    }

    if (operations.length === 0) {
      return {
        markedCount: 0,
        threadIds,
        notificationIds,
        partialFailure: false,
      };
    }

    const results = await Promise.allSettled(operations);
    const failureCount = results.filter((result) => result.status === "rejected").length;

    if (failureCount === results.length) {
      const firstFailure = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      throw firstFailure?.reason || new Error("Failed to mark notifications as read");
    }

    const markedCount = threadIds.length + notificationIds.length;
    if (markedCount > 0) {
      toast.success("Notifications marked as read");
    }

    return {
      markedCount,
      threadIds,
      notificationIds,
      partialFailure: failureCount > 0,
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

  async admitEnrollment(enrollmentId: string) {
    try {
      const result = await apiRequest<any>(`/admin/enrollments/${enrollmentId}/admit`, {
        method: "POST",
        requiresAuth: true,
      });
      toast.success("Enrollment admitted");
      return result;
    } catch (err: any) {
      console.error("admitEnrollment error:", err);
      toast.error(err.message || "Failed to admit enrollment");
      throw err;
    }
  },
};

