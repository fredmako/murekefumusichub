import { toast } from "sonner";
import { apiRequest } from "./api";

export const adminService = {
  async fetchBootstrap() {
    try {
      const payload = await apiRequest<any>("/admin/bootstrap");
      return (
        payload || {
          roles: [],
          invites: [],
          requests: [],
          stats: {
            totalUsers: 0,
            totalCompositions: 0,
            totalRevenue: 0,
            totalTransactions: 0,
          },
        }
      );
    } catch (err: any) {
      console.warn("fetchBootstrap error:", err);
      return {
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
    }
  },

  async fetchRoles() {
    try {
      const roles = await apiRequest<any>("/admin/roles");
      return roles || [];
    } catch (err: any) {
      console.warn("fetchRoles error:", err);
      return [];
    }
  },

  async fetchUsers() {
    try {
      const users = await apiRequest<any>("/admin/users");
      return users || [];
    } catch (err: any) {
      console.warn("fetchUsers error:", err);
      return [];
    }
  },

  async fetchCompositions(options?: { limit?: number }) {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      const endpoint = `/admin/compositions${params.toString() ? `?${params.toString()}` : ""}`;
      const compositions = await apiRequest<any>(endpoint);
      return compositions || [];
    } catch (err: any) {
      console.warn("fetchCompositions error:", err);
      return [];
    }
  },

  async fetchTransactions(options?: { limit?: number }) {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      const endpoint = `/admin/transactions${params.toString() ? `?${params.toString()}` : ""}`;
      const transactions = await apiRequest<any>(endpoint);
      return transactions || [];
    } catch (err: any) {
      console.warn("fetchTransactions error:", err);
      return [];
    }
  },

  async fetchInvites() {
    try {
      const invites = await apiRequest<any>("/admin/invites");
      return invites || [];
    } catch (err: any) {
      console.warn("fetchInvites error:", err);
      return [];
    }
  },

  async fetchRequests() {
    try {
      const requests = await apiRequest<any>("/admin/composer-requests");
      return requests || [];
    } catch (err: any) {
      console.warn("fetchRequests error:", err);
      return [];
    }
  },

  async fetchStats() {
    try {
      const stats = await apiRequest<any>("/admin/stats");
      return (
        stats || {
          totalUsers: 0,
          totalCompositions: 0,
          totalRevenue: 0,
          totalTransactions: 0,
        }
      );
    } catch (err: any) {
      console.warn("fetchStats error:", err);
      return {
        totalUsers: 0,
        totalCompositions: 0,
        totalRevenue: 0,
        totalTransactions: 0,
      };
    }
  },

  async addComposerInvite(email: string, invitedBy: string) {
    try {
      const result = await apiRequest<any>("/admin/invites", {
        method: "POST",
        body: JSON.stringify({ email, invited_by: invitedBy }),
      });
      toast.success("Composer invite sent!");
      return result;
    } catch (err: any) {
      console.error("addComposerInvite error:", err);
      toast.error(err.message || "Failed to add invite");
      throw err;
    }
  },

  async revokeInvite(email: string) {
    try {
      const result = await apiRequest<any>(`/admin/invites/${email}`, {
        method: "DELETE",
      });
      toast.success("Invite revoked");
      return result;
    } catch (err: any) {
      console.error("revokeInvite error:", err);
      toast.error("Failed to revoke invite");
      throw err;
    }
  },

  async promoteUserToComposer(userId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/users/${userId}/promote-composer`,
        {
          method: "POST",
        },
      );
      toast.success("User promoted to composer");
      return result;
    } catch (err: any) {
      console.error("promoteUserToComposer error:", err);
      toast.error("Failed to promote user");
      throw err;
    }
  },

  async promoteUserToAdmin(userId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/users/${userId}/promote-admin`,
        {
          method: "POST",
        },
      );
      toast.success("User promoted to admin");
      return result;
    } catch (err: any) {
      console.error("promoteUserToAdmin error:", err);
      toast.error("Failed to promote user");
      throw err;
    }
  },

  async suspendUser(userId: string) {
    try {
      const result = await apiRequest<any>(`/admin/users/${userId}/suspend`, {
        method: "POST",
      });
      toast.success("User suspended");
      return result;
    } catch (err: any) {
      console.error("suspendUser error:", err);
      toast.error("Failed to suspend user");
      throw err;
    }
  },

  async rejectRequest(userId: string) {
    try {
      const result = await apiRequest<any>(`/admin/role-requests/${userId}/reject`, {
        method: "POST",
        body: JSON.stringify({ requestedRole: "composer" }),
      });
      toast.success("Request rejected");
      return result;
    } catch (err: any) {
      console.error("rejectRequest error:", err);
      toast.error("Failed to reject request");
      throw err;
    }
  },

  async rejectRoleRequest(userId: string, requestedRole: "composer" | "admin") {
    try {
      const result = await apiRequest<any>(`/admin/role-requests/${userId}/reject`, {
        method: "POST",
        body: JSON.stringify({ requestedRole }),
      });
      toast.success(`${requestedRole} request rejected`);
      return result;
    } catch (err: any) {
      console.error("rejectRoleRequest error:", err);
      toast.error("Failed to reject request");
      throw err;
    }
  },

  async approvePaymentSubmission(submissionId: string, adminNotes?: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/payment-submissions/${submissionId}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ adminNotes: adminNotes || null }),
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

  async rejectPaymentSubmission(submissionId: string, adminNotes?: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/payment-submissions/${submissionId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ adminNotes: adminNotes || null }),
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

  async removeComposition(compositionId: string) {
    try {
      const result = await apiRequest<any>(`/compositions/${compositionId}`, {
        method: "DELETE",
      });
      toast.success("Composition removed");
      return result;
    } catch (err: any) {
      console.error("removeComposition error:", err);
      toast.error(err.message || "Failed to remove composition");
      throw err;
    }
  },
};
