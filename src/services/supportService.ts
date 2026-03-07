import { apiRequest } from "@/services/api";
import { ensureArray } from "@/lib/ensureArray";

export interface SupportIssuePayload {
  subject?: string;
  message: string;
  context?: string;
}

export interface SupportIssueResponse {
  success: boolean;
  message?: string;
  issueId?: string | null;
  threadId?: string | null;
}

export interface SupportChatThread {
  id: string;
  requester_user_id: string;
  subject: string;
  context: string;
  status: string;
  is_admin_unread: boolean;
  is_user_unread: boolean;
  last_message_preview: string;
  last_sender_role: "member" | "admin" | null;
  last_message_at: string;
  deleted_by_admin: boolean;
  assigned_admin_user_id?: string | null;
  assigned_at?: string | null;
  expires_at?: string | null;
  ticket_rejection_count?: number;
  is_closed?: boolean;
  created_at: string;
  updated_at: string;
  requester?: {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface SupportChatMessage {
  id: string;
  thread_id: string;
  sender_user_id: string | null;
  sender_role: "member" | "admin";
  message: string;
  created_at: string;
}

export interface SupportInboxPayload {
  threads: SupportChatThread[];
  unreadThreads: SupportChatThread[];
  unreadCount: number;
  lastUpdatedAt?: string;
}

export type AdminThreadType = "notification" | "ticket" | "direct";
export type AiDraftUseCase = "support" | "message" | "announcement";

export interface SupportAiDraftPayload {
  useCase: AiDraftUseCase;
  message: string;
  subject?: string;
  audienceRoles?: string[];
  context?: string;
}

export const supportService = {
  async submitIssue(payload: SupportIssuePayload) {
    return await apiRequest<SupportIssueResponse>("/support/issues", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async createThread(payload: SupportIssuePayload) {
    return await apiRequest<{
      success: boolean;
      thread: SupportChatThread;
      message: SupportChatMessage;
    }>("/support/threads", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async createAdminThread(payload: {
    targetUserId: string;
    threadType: AdminThreadType;
    subject?: string;
    message: string;
    context?: string;
  }) {
    return await apiRequest<{
      success: boolean;
      threadType: AdminThreadType;
      thread: SupportChatThread;
      message: SupportChatMessage;
    }>("/support/admin/threads", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async draftMessageWithAi(payload: SupportAiDraftPayload) {
    return await apiRequest<{
      success: boolean;
      useCase: AiDraftUseCase;
      model: string;
      draft: {
        subject?: string;
        message: string;
      };
    }>("/support/ai/draft", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 45000,
      requiresAuth: true,
    });
  },

  async createRoleAnnouncement(payload: {
    roles: string[];
    subject?: string;
    message: string;
    context?: string;
  }) {
    return await apiRequest<{
      success: boolean;
      recipientCount: number;
      targetRoles: string[];
      createdThreadIds: string[];
      message: string;
    }>("/support/admin/announcements", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 45000,
      requiresAuth: true,
    });
  },

  async getInbox(limit = 100): Promise<SupportInboxPayload> {
    const payload = await apiRequest<any>(`/support/inbox?limit=${limit}`, {
      method: "GET",
      timeoutMs: 30000,
      requiresAuth: true,
    });

    const threads = ensureArray<SupportChatThread>(payload, ["threads", "tickets"]);
    const unreadThreads = ensureArray<SupportChatThread>(payload?.unreadThreads, [
      "threads",
      "tickets",
    ]);

    return {
      threads,
      unreadThreads,
      unreadCount:
        Number.isFinite(Number(payload?.unreadCount)) &&
        Number(payload?.unreadCount) >= 0
          ? Number(payload.unreadCount)
          : unreadThreads.length,
      lastUpdatedAt: payload?.lastUpdatedAt,
    };
  },

  async getMyThreads(limit = 100) {
    const payload = await apiRequest<any>(`/support/threads/my?limit=${limit}`, {
      method: "GET",
      timeoutMs: 30000,
      requiresAuth: true,
    });
    return ensureArray<SupportChatThread>(payload, ["threads", "tickets"]);
  },

  async getThreadMessages(threadId: string) {
    return await apiRequest<{
      thread: SupportChatThread;
      messages: SupportChatMessage[];
      admin: boolean;
    }>(`/support/threads/${threadId}/messages`, {
      method: "GET",
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async sendMessage(threadId: string, message: string) {
    return await apiRequest<{
      success: boolean;
      thread: SupportChatThread;
      message: SupportChatMessage;
      senderRole: "member" | "admin";
    }>(`/support/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async markThreadRead(threadId: string) {
    return await apiRequest<{
      success: boolean;
      thread: SupportChatThread;
      admin: boolean;
    }>(`/support/threads/${threadId}/read`, {
      method: "POST",
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async getAdminTicketQueue(limit = 200) {
    const payload = await apiRequest<any>(`/support/admin/tickets?limit=${limit}`, {
      method: "GET",
      timeoutMs: 30000,
      requiresAuth: true,
    });
    return ensureArray<SupportChatThread>(payload, ["tickets", "threads"]);
  },

  async pickAdminTicket(threadId: string) {
    return await apiRequest<{
      success: boolean;
      alreadyAssigned?: boolean;
      thread: SupportChatThread;
    }>(`/support/admin/tickets/${threadId}/pick`, {
      method: "POST",
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async rejectAdminTicket(threadId: string) {
    return await apiRequest<{
      success: boolean;
      rejectedByAllAdmins: boolean;
      notifyUser: boolean;
      thread: SupportChatThread;
      rejectionCount: number;
      requiredRejections: number;
    }>(`/support/admin/tickets/${threadId}/reject`, {
      method: "POST",
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },

  async getAdminThreads(state: "all" | "unread" | "read" = "all", limit = 200) {
    const payload = await apiRequest<any>(
      `/support/admin/threads?state=${state}&limit=${limit}`,
      {
        method: "GET",
        timeoutMs: 30000,
        requiresAuth: true,
      },
    );
    return ensureArray<SupportChatThread>(payload, ["threads", "tickets"]);
  },

  async deleteAdminThread(threadId: string) {
    return await apiRequest<{
      success: boolean;
      message: string;
      thread: SupportChatThread;
    }>(`/support/admin/threads/${threadId}`, {
      method: "DELETE",
      timeoutMs: 30000,
      requiresAuth: true,
    });
  },
};

export default supportService;

