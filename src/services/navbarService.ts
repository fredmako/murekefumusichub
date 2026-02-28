import { toast } from "sonner";
import { apiRequest } from "@/services/api";

export const navbarService = {
  async fetchUserRoles(firebaseUid: string) {
    try {
      const roles = await apiRequest<any[]>(`/user/roles/${firebaseUid}`);
      return roles || [];
    } catch (err: any) {
      console.warn("fetchUserRoles error:", err);
      return [];
    }
  },

  async fetchAdminNotifications() {
    try {
      const notifications = await apiRequest<any[]>(`/admin/notifications`);
      return notifications || [];
    } catch (err: any) {
      console.warn("fetchAdminNotifications error:", err);
      return [];
    }
  },

  async approveComposerRequest(userId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/users/${userId}/promote-composer`,
        {
          method: "POST",
        },
      );
      toast.success("Composer request approved");
      return result;
    } catch (err: any) {
      console.error("approveComposerRequest error:", err);
      toast.error(err.message || "Failed to approve request");
      throw err;
    }
  },

  async rejectComposerRequest(userId: string) {
    try {
      const result = await apiRequest<any>(
        `/admin/composer-requests/${userId}/reject`,
        {
          method: "POST",
        },
      );
      toast.success("Composer request rejected");
      return result;
    } catch (err: any) {
      console.error("rejectComposerRequest error:", err);
      toast.error(err.message || "Failed to reject request");
      throw err;
    }
  },
};
