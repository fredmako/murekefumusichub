import { toast } from "sonner";

const API_BASE_URL =
  (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

export const navbarService = {
  async fetchUserRoles(firebaseUid: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/user/roles/${firebaseUid}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!response.ok) throw new Error("Failed to fetch roles");
      return await response.json();
    } catch (err: any) {
      console.warn("fetchUserRoles error:", err);
      return [];
    }
  },

  async fetchAdminNotifications() {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notifications`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return await response.json();
    } catch (err: any) {
      console.warn("fetchAdminNotifications error:", err);
      return [];
    }
  },
};
