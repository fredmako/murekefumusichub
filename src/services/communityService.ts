import { apiRequest } from "@/services/api";

export interface CommunityRoom {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at?: string;
  updated_at?: string;
  message_count?: number;
}

export interface CommunityUserPreview {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface CommunityMessage {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_kind: "text" | "image";
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at?: string | null;
  sender: CommunityUserPreview | null;
}

export interface CommunitySettings {
  bubbleTone: "theme" | "ocean" | "sunset";
  density: "comfortable" | "compact";
  wallpaper: "aurora" | "graphite" | "sunrise";
}

export const DEFAULT_COMMUNITY_SETTINGS: CommunitySettings = {
  bubbleTone: "theme",
  density: "comfortable",
  wallpaper: "aurora",
};

export const communityService = {
  async getPrimaryRoom() {
    return await apiRequest<{
      room: CommunityRoom;
      messageCount: number;
    }>("/community/rooms/primary", {
      method: "GET",
      requiresAuth: true,
      timeoutMs: 25000,
    });
  },

  async getRoomMessages(roomId: string, limit: number = 150) {
    return await apiRequest<{
      room: CommunityRoom;
      messages: CommunityMessage[];
    }>(`/community/rooms/${roomId}/messages?limit=${limit}`, {
      method: "GET",
      requiresAuth: true,
      timeoutMs: 30000,
    });
  },

  async sendMessage(
    roomId: string,
    payload: {
      message?: string;
      attachmentUrl?: string | null;
      attachmentName?: string | null;
      attachmentKind?: "text" | "image";
      metadata?: Record<string, any>;
    },
  ) {
    return await apiRequest<{
      success: boolean;
      message: CommunityMessage;
    }>(`/community/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
      requiresAuth: true,
      timeoutMs: 30000,
    });
  },

  async getMySettings() {
    const payload = await apiRequest<{
      settings?: Partial<CommunitySettings>;
    }>("/community/settings/me", {
      method: "GET",
      requiresAuth: true,
      timeoutMs: 25000,
    });

    return {
      ...DEFAULT_COMMUNITY_SETTINGS,
      ...(payload?.settings || {}),
    } as CommunitySettings;
  },

  async updateMySettings(settings: Partial<CommunitySettings>) {
    const payload = await apiRequest<{
      success: boolean;
      settings: CommunitySettings;
    }>("/community/settings/me", {
      method: "PUT",
      body: JSON.stringify(settings),
      requiresAuth: true,
      timeoutMs: 25000,
    });

    return payload?.settings || DEFAULT_COMMUNITY_SETTINGS;
  },
};

export default communityService;
