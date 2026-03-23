import { normalizeAvatarInRecord } from "@/lib/avatarUrl";
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

export type CommunityAttachmentKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document";

export interface CommunityMessageMetadata {
  mimeType?: string | null;
  fileSize?: number | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  durationMs?: number | null;
  [key: string]: any;
}

export interface CommunityMessage {
  id: string;
  room_id: string;
  sender_user_id: string | null;
  message: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_kind: CommunityAttachmentKind;
  metadata?: CommunityMessageMetadata | null;
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

function normalizeCommunityUserPreview(
  user: CommunityUserPreview | null | undefined,
): CommunityUserPreview | null {
  if (!user) return null;
  return normalizeAvatarInRecord(user);
}

function normalizeCommunityMessage(message: CommunityMessage): CommunityMessage {
  return {
    ...message,
    sender: normalizeCommunityUserPreview(message.sender),
  };
}

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
    const payload = await apiRequest<{
      room: CommunityRoom;
      messages: CommunityMessage[];
    }>(`/community/rooms/${roomId}/messages?limit=${limit}`, {
      method: "GET",
      requiresAuth: true,
      timeoutMs: 30000,
    });

    return {
      ...payload,
      messages: Array.isArray(payload?.messages)
        ? payload.messages.map(normalizeCommunityMessage)
        : [],
    };
  },

  async sendMessage(
    roomId: string,
    payload: {
      message?: string;
      attachmentUrl?: string | null;
      attachmentName?: string | null;
      attachmentKind?: CommunityAttachmentKind;
      metadata?: CommunityMessageMetadata;
    },
  ) {
    const response = await apiRequest<{
      success: boolean;
      message: CommunityMessage;
    }>(`/community/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
      requiresAuth: true,
      timeoutMs: 30000,
    });

    return response?.message
      ? {
          ...response,
          message: normalizeCommunityMessage(response.message),
        }
      : response;
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
