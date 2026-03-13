import { toast } from "sonner";
import { apiRequest } from "./api";
import { ensureArray } from "@/lib/ensureArray";

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
      return ensureArray<any>(roles, ["roles"]);
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
      return ensureArray<any>(compositions, ["compositions"]);
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
      return ensureArray<any>(transactions, ["transactions"]);
    } catch (err: any) {
      console.warn("fetchTransactions error:", err);
      return [];
    }
  },

  async fetchEnrollments(options?: {
    limit?: number;
    status?: "pending" | "admitted" | "rejected" | "all";
  }) {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.status && options.status !== "all") {
        params.set("status", options.status);
      }
      const endpoint = `/admin/enrollments${params.toString() ? `?${params.toString()}` : ""}`;
      const enrollments = await apiRequest<any>(endpoint);
      return ensureArray<any>(enrollments, ["enrollments"]);
    } catch (err: any) {
      console.warn("fetchEnrollments error:", err);
      return [];
    }
  },

  async fetchRegistrationRegulations() {
    try {
      return await apiRequest<any>("/admin/registration/regulations");
    } catch (err: any) {
      console.warn("fetchRegistrationRegulations error:", err);
      throw err;
    }
  },

  async updateRegistrationRegulations(payload: {
    enrollmentFee: number;
    composerRequestFee: number;
    bankName: string;
    bankAccountNumber: string;
    accountName: string;
  }) {
    try {
      const result = await apiRequest<any>("/admin/registration/regulations", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      toast.success("Registration regulations updated");
      return result;
    } catch (err: any) {
      console.error("updateRegistrationRegulations error:", err);
      toast.error(err.message || "Failed to update regulations");
      throw err;
    }
  },

  async fetchRegistrationPayments(options?: {
    limit?: number;
    status?: "all" | "pending" | "approved" | "rejected";
    type?: "all" | "enrollment" | "composer_request";
  }) {
    try {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.status && options.status !== "all") {
        params.set("status", options.status);
      }
      if (options?.type && options.type !== "all") {
        params.set("type", options.type);
      }
      const endpoint = `/admin/registration/payments${params.toString() ? `?${params.toString()}` : ""}`;
      return ensureArray<any>(await apiRequest<any>(endpoint), [
        "payments",
        "submissions",
      ]);
    } catch (err: any) {
      console.warn("fetchRegistrationPayments error:", err);
      throw err;
    }
  },

  async approveRegistrationPayment(submissionId: string, adminNotes?: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/registration/payments/${submissionId}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ adminNotes: adminNotes || null }),
        },
      );
      toast.success("Registration payment approved");
      return result;
    } catch (err: any) {
      console.error("approveRegistrationPayment error:", err);
      toast.error(err.message || "Failed to approve registration payment");
      throw err;
    }
  },

  async rejectRegistrationPayment(submissionId: string, adminNotes?: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/registration/payments/${submissionId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ adminNotes: adminNotes || null }),
        },
      );
      toast.success("Registration payment rejected");
      return result;
    } catch (err: any) {
      console.error("rejectRegistrationPayment error:", err);
      toast.error(err.message || "Failed to reject registration payment");
      throw err;
    }
  },

  async fetchInvites() {
    try {
      const invites = await apiRequest<any>("/admin/invites");
      return ensureArray<any>(invites, ["invites"]);
    } catch (err: any) {
      console.warn("fetchInvites error:", err);
      return [];
    }
  },

  async fetchRequests() {
    try {
      const requests = await apiRequest<any>("/admin/composer-requests");
      return ensureArray<any>(requests, ["requests"]);
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
  async demoteUserFromComposer(userId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/users/${userId}/demote-composer`,
        {
          method: "POST",
        },
      );
      toast.success("Composer role removed");
      return result;
    } catch (err: any) {
      console.error("demoteUserFromComposer error:", err);
      toast.error("Failed to remove composer role");
      throw err;
    }
  },

  async demoteUserFromAdmin(userId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/users/${userId}/demote-admin`,
        {
          method: "POST",
        },
      );
      toast.success("Admin role removed");
      return result;
    } catch (err: any) {
      console.error("demoteUserFromAdmin error:", err);
      toast.error("Failed to remove admin role");
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

  async admitEnrollment(enrollmentId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/enrollments/${enrollmentId}/admit`,
        {
          method: "POST",
        },
      );
      toast.success("Enrollment admitted");
      return result;
    } catch (err: any) {
      console.error("admitEnrollment error:", err);
      toast.error(err.message || "Failed to admit enrollment");
      throw err;
    }
  },

  async verifyComposition(compositionId: string, verificationNotes?: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/compositions/${compositionId}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ verificationNotes: verificationNotes || null }),
        },
      );
      toast.success("Composition verified");
      return result;
    } catch (err: any) {
      console.error("verifyComposition error:", err);
      toast.error(err.message || "Failed to verify composition");
      throw err;
    }
  },

  async unverifyComposition(compositionId: string, reason?: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/compositions/${compositionId}/unverify`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reason || null }),
        },
      );
      toast.success("Composition marked unverified");
      return result;
    } catch (err: any) {
      console.error("unverifyComposition error:", err);
      toast.error(err.message || "Failed to mark composition unverified");
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


