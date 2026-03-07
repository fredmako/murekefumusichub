import { toast } from "sonner";
import { apiRequest } from "@/services/api";
import { ensureArray } from "@/lib/ensureArray";

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
