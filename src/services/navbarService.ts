import { toast } from "sonner";
import { getIdToken } from "@/services/api";

const API_BASE_URL =
  (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

async function buildAuthHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  try {
    const token = await getIdToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch (e) {
    // ignore token build errors; caller will receive 401 if required
  }
  return headers;
}

export const navbarService = {
  async fetchUserRoles(firebaseUid: string) {
    try {
      const headers = await buildAuthHeaders();
      const response = await fetch(
        `${API_BASE_URL}/user/roles/${firebaseUid}`,
        {
          method: "GET",
          headers,
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
      const headers = await buildAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/admin/notifications`, {
        method: "GET",
        headers,
      });
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return await response.json();
    } catch (err: any) {
      console.warn("fetchAdminNotifications error:", err);
      return [];
    }
  },
};
