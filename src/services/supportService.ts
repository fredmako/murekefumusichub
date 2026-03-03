import { apiRequest } from "@/services/api";

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

export const supportService = {
  async submitIssue(payload: SupportIssuePayload) {
    return await apiRequest<SupportIssueResponse>("/support/issues", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 30000,
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
    });
  },

  async getMyThreads(limit = 100) {
    return await apiRequest<SupportChatThread[]>(
      `/support/threads/my?limit=${limit}`,
      {
        method: "GET",
        timeoutMs: 30000,
      },
    );
  },

  async getThreadMessages(threadId: string) {
    return await apiRequest<{
      thread: SupportChatThread;
      messages: SupportChatMessage[];
      admin: boolean;
    }>(`/support/threads/${threadId}/messages`, {
      method: "GET",
      timeoutMs: 30000,
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
    });
  },

  async getAdminTicketQueue(limit = 200) {
    return await apiRequest<SupportChatThread[]>(
      `/support/admin/tickets?limit=${limit}`,
      {
        method: "GET",
        timeoutMs: 30000,
      },
    );
  },

  async pickAdminTicket(threadId: string) {
    return await apiRequest<{
      success: boolean;
      alreadyAssigned?: boolean;
      thread: SupportChatThread;
    }>(`/support/admin/tickets/${threadId}/pick`, {
      method: "POST",
      timeoutMs: 30000,
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
    });
  },

  async getAdminThreads(state: "all" | "unread" | "read" = "all", limit = 200) {
    return await apiRequest<SupportChatThread[]>(
      `/support/admin/threads?state=${state}&limit=${limit}`,
      {
        method: "GET",
        timeoutMs: 30000,
      },
    );
  },

  async deleteAdminThread(threadId: string) {
    return await apiRequest<{
      success: boolean;
      message: string;
      thread: SupportChatThread;
    }>(`/support/admin/threads/${threadId}`, {
      method: "DELETE",
      timeoutMs: 30000,
    });
  },
};

export default supportService;
