import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LifeBuoy,
  Loader,
  MessageSquare,
  MessageSquarePlus,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "sonner";
import { supportService } from "@/services/supportService";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface SupportIssueButtonProps {
  context: string;
  className?: string;
  triggerLabel?: string;
  triggerIcon?: "lifebuoy" | "message";
  triggerVariant?: "default" | "outline" | "secondary" | "ghost";
  unreadCount?: number;
  onInboxRefresh?: () => void;
}

function formatThreadTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function SupportIssueButton({
  context,
  className,
  triggerLabel = "Contact Support",
  triggerIcon = "lifebuoy",
  triggerVariant = "outline",
  unreadCount = 0,
  onInboxRefresh,
}: SupportIssueButtonProps) {
  const { appUser } = useAuth();
  const TriggerIcon = triggerIcon === "message" ? MessageSquare : LifeBuoy;

  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [improvingDraft, setImprovingDraft] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );
  const selectedThreadClosed = useMemo(() => {
    if (!selectedThread) return false;
    const status = String(selectedThread.status || "").toLowerCase();
    return ["rejected", "expired", "deleted", "resolved"].includes(status);
  }, [selectedThread]);

  const loadThreads = useCallback(
    async (preserveSelection = true) => {
      if (!appUser?.id) return;
      setLoadingThreads(true);
      try {
        const inbox = await supportService.getInbox();
        const nextThreads = inbox?.threads || [];
        setThreads(nextThreads);
        onInboxRefresh?.();

        setSelectedThreadId((currentSelected) => {
          if (!preserveSelection) return currentSelected;
          if (!currentSelected) return nextThreads[0]?.id || null;
          const stillExists = nextThreads.some(
            (thread) => thread.id === currentSelected,
          );
          return stillExists ? currentSelected : nextThreads[0]?.id || null;
        });
      } catch (error: any) {
        console.error("[support-chat] load threads failed:", error);
        toast.error(error?.message || "Failed to load support chats");
      } finally {
        setLoadingThreads(false);
      }
    },
    [appUser?.id, onInboxRefresh],
  );

  const loadMessages = useCallback(
    async (threadId: string, markRead = true) => {
      setLoadingMessages(true);
      try {
        const response = await supportService.getThreadMessages(threadId);
        setMessages(response?.messages || []);

        if (markRead && response?.thread?.is_user_unread) {
          await supportService.markThreadRead(threadId).catch(() => null);
          await loadThreads(false);
        }
      } catch (error: any) {
        console.error("[support-chat] load messages failed:", error);
        toast.error(error?.message || "Failed to load thread messages");
      } finally {
        setLoadingMessages(false);
      }
    },
    [loadThreads],
  );

  useEffect(() => {
    if (!open) return;
    void loadThreads(true);
  }, [open, loadThreads]);

  useEffect(() => {
    if (!open || !selectedThreadId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedThreadId, true);
  }, [open, selectedThreadId, loadMessages]);

  useEffect(() => {
    if (!open || !appUser?.id) return;

    const threadChannel = supabase
      .channel(`support-threads-${appUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_chat_threads",
          filter: `requester_user_id=eq.${appUser.id}`,
        },
        () => {
          void loadThreads(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(threadChannel);
    };
  }, [open, appUser?.id, loadThreads]);

  useEffect(() => {
    if (!open || !selectedThreadId) return;

    const messageChannel = supabase
      .channel(`support-messages-${selectedThreadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_chat_messages",
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => {
          void loadMessages(selectedThreadId, true);
          void loadThreads(false);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messageChannel);
    };
  }, [open, selectedThreadId, loadMessages, loadThreads]);

  const handleStartNewThread = async () => {
    const normalizedMessage = draftMessage.trim();
    if (!normalizedMessage) {
      toast.error("Please enter your issue details.");
      return;
    }

    setCreatingThread(true);
    try {
      const result = await supportService.createThread({
        subject: newSubject.trim() || "Support Request",
        message: normalizedMessage,
        context,
      });

      const createdThread = result?.thread;
      if (!createdThread?.id) {
        throw new Error("Support thread was created without an ID");
      }

      toast.success("Support chat started");
      setNewSubject("");
      setDraftMessage("");
      await loadThreads(true);
      setSelectedThreadId(createdThread.id);
      await loadMessages(createdThread.id, false);
    } catch (error: any) {
      console.error("[support-chat] create thread failed:", error);
      toast.error(error?.message || "Failed to start support chat");
    } finally {
      setCreatingThread(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId) {
      await handleStartNewThread();
      return;
    }
    if (selectedThreadClosed) {
      toast.error("This ticket is closed. Start a new support ticket.");
      return;
    }

    const normalizedMessage = draftMessage.trim();
    if (!normalizedMessage) {
      toast.error("Type a message before sending.");
      return;
    }

    setSendingMessage(true);
    try {
      await supportService.sendMessage(selectedThreadId, normalizedMessage);
      setDraftMessage("");
      await loadMessages(selectedThreadId, false);
      await loadThreads(false);
    } catch (error: any) {
      console.error("[support-chat] send message failed:", error);
      toast.error(error?.message || "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const handleImproveDraftWithAi = async () => {
    const normalizedMessage = draftMessage.trim();
    if (!normalizedMessage) {
      toast.error("Type your message first, then use AI assist.");
      return;
    }

    setImprovingDraft(true);
    try {
      const response = await supportService.draftMessageWithAi({
        useCase: "support",
        subject: selectedThread ? selectedThread.subject : newSubject,
        message: normalizedMessage,
        context: selectedThread?.context || context,
      });

      const nextMessage = response?.draft?.message || normalizedMessage;
      setDraftMessage(nextMessage);

      const nextSubject = response?.draft?.subject || "";
      if (!selectedThread && !newSubject.trim() && nextSubject) {
        setNewSubject(nextSubject);
      }

      toast.success("Message polished with AI");
    } catch (error: any) {
      console.error("[support-chat] ai assist failed:", error);
      toast.error(error?.message || "Failed to generate AI draft");
    } finally {
      setImprovingDraft(false);
    }
  };

  const openNewChatComposer = () => {
    setSelectedThreadId(null);
    setMessages([]);
    setDraftMessage("");
    setNewSubject("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} className={`relative ${className || ""}`}>
          <TriggerIcon className="mr-2 size-4" />
          {triggerLabel}
          {unreadCount > 0 ? (
            <Badge className="absolute -top-2 -right-2 size-5 min-w-5 px-1 text-[10px] leading-none">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle>Support Chat</DialogTitle>
          <DialogDescription>
            Chat with support admins in real time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid h-[72vh] grid-cols-1 md:grid-cols-[280px_1fr]">
          <div className="border-b border-border/70 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 p-3">
              <p className="text-sm font-semibold">Your Chats</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openNewChatComposer}
              >
                <MessageSquarePlus className="mr-2 size-4" />
                New
              </Button>
            </div>

            <div className="h-[calc(72vh-64px)] overflow-y-auto p-2">
              {loadingThreads ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader className="size-4 animate-spin" />
                  Loading chats...
                </div>
              ) : threads.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  No chats yet. Start one.
                </p>
              ) : (
                <div className="space-y-2">
                  {threads.map((thread) => {
                    const active = thread.id === selectedThreadId;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border/70 bg-card hover:bg-muted/40"
                        }`}
                        onClick={() => setSelectedThreadId(thread.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-semibold">
                            {thread.subject || "Support Request"}
                          </p>
                          <div className="flex items-center gap-1">
                            {thread.is_user_unread && (
                              <Badge className="bg-amber-100 text-amber-800">
                                New
                              </Badge>
                            )}
                            {thread.status && (
                              <Badge variant="outline" className="capitalize">
                                {thread.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {thread.last_message_preview || "No messages"}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatThreadTime(thread.last_message_at)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="border-b border-border/60 px-4 py-3">
              {selectedThread ? (
                <div>
                  <p className="font-semibold">{selectedThread.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedThread.context || context}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: {String(selectedThread.status || "pending")}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold">Start a new support chat</p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
              {selectedThread ? (
                loadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader className="size-4 animate-spin" />
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isAdminMessage = msg.sender_role === "admin";
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isAdminMessage ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[82%] rounded-xl px-3 py-2 text-sm ${
                              isAdminMessage
                                ? "bg-card text-foreground border border-border/70"
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">
                              {msg.message}
                            </p>
                            <p
                              className={`mt-1 text-[11px] ${
                                isAdminMessage
                                  ? "text-muted-foreground"
                                  : "text-primary-foreground/80"
                              }`}
                            >
                              {isAdminMessage ? "Admin" : "You"} - {formatThreadTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
                  <div>
                    <Label htmlFor="support-subject">Subject</Label>
                    <Input
                      id="support-subject"
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="Short issue title"
                      maxLength={160}
                      disabled={creatingThread || sendingMessage}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The first message below will open a new support thread.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-border/60 p-4">
              <div className="space-y-2">
                <Label htmlFor="support-message">
                  {selectedThread ? "Reply" : "Issue Details"}
                </Label>
                <Textarea
                  id="support-message"
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  placeholder={
                    selectedThread
                      ? selectedThreadClosed
                        ? "This ticket is closed. Start a new chat."
                        : "Type your message..."
                      : "Describe the issue in detail..."
                  }
                  rows={3}
                  maxLength={4000}
                  disabled={
                    creatingThread ||
                    sendingMessage ||
                    improvingDraft ||
                    selectedThreadClosed
                  }
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleImproveDraftWithAi()}
                  disabled={
                    creatingThread ||
                    sendingMessage ||
                    improvingDraft ||
                    selectedThreadClosed ||
                    !draftMessage.trim() ||
                    !appUser?.id
                  }
                >
                  {improvingDraft ? (
                    <>
                      <Loader className="mr-2 size-4 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" />
                      AI Assist
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={
                    creatingThread ||
                    sendingMessage ||
                    improvingDraft ||
                    !draftMessage.trim() ||
                    selectedThreadClosed ||
                    !appUser?.id
                  }
                >
                  {creatingThread || sendingMessage ? (
                    <>
                      <Loader className="mr-2 size-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 size-4" />
                      {selectedThread ? "Send Reply" : "Start Chat"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SupportIssueButton;

