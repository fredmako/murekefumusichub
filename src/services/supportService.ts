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
}

export const supportService = {
  async submitIssue(payload: SupportIssuePayload) {
    return await apiRequest<SupportIssueResponse>("/support/issues", {
      method: "POST",
      body: JSON.stringify(payload),
      timeoutMs: 30000,
    });
  },
};

export default supportService;
