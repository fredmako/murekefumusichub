import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LifeBuoy,
  Loader,
  MessageSquarePlus,
  RefreshCcw,
  Send,
  Sparkles,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "sonner";
import {
  supportService,
  type SupportChatMessage,
  type SupportChatThread,
} from "@/services/supportService";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { useLocation, useNavigate } from "react-router-dom";

function formatThreadTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export function MessengerPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [threads, setThreads] = useState<SupportChatThread[]>([]);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [creatingThread, setCreatingThread] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [improvingDraft, setImprovingDraft] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const threadsLoadRef = useRef(false);
  const messagesLoadRef = useRef(false);
  const threadsRequestId = useRef(0);
  const messagesRequestId = useRef(0);
  const lastThreadsErrorAt = useRef(0);
  const lastMessagesErrorAt = useRef(0);

  useEffect(() => {
    if (!authLoading && !appUser) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [appUser, authLoading, location.hash, location.pathname, location.search, navigate]);

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
    async (preserveSelection = true, force = false) => {
      if (!appUser?.id) return;
      if (threadsLoadRef.current) return;
      if (!force && Date.now() - lastThreadsErrorAt.current < 8000) return;
      const requestId = ++threadsRequestId.current;
      threadsLoadRef.current = true;
      setLoadingThreads(true);
      const timeoutHandle = window.setTimeout(() => {
        if (requestId !== threadsRequestId.current) return;
        threadsLoadRef.current = false;
        setLoadingThreads(false);
      }, 12000);
      try {
        const inbox = await supportService.getInbox();
        if (requestId !== threadsRequestId.current) return;
        const nextThreads = inbox?.threads || [];
        setThreads(nextThreads);
        setThreadsError(null);
        lastThreadsErrorAt.current = 0;

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
        const message = error?.message || "Failed to load support chats";
        setThreadsError(message);
        lastThreadsErrorAt.current = Date.now();
      } finally {
        window.clearTimeout(timeoutHandle);
        if (requestId === threadsRequestId.current) {
          threadsLoadRef.current = false;
          setLoadingThreads(false);
        }
      }
    },
    [appUser?.id],
  );

  const loadMessages = useCallback(
    async (threadId: string, markRead = true, force = false) => {
      if (messagesLoadRef.current) return;
      if (!force && Date.now() - lastMessagesErrorAt.current < 8000) return;
      const requestId = ++messagesRequestId.current;
      messagesLoadRef.current = true;
      setLoadingMessages(true);
      const timeoutHandle = window.setTimeout(() => {
        if (requestId !== messagesRequestId.current) return;
        messagesLoadRef.current = false;
        setLoadingMessages(false);
      }, 12000);
      try {
        const response = await supportService.getThreadMessages(threadId);
        if (requestId !== messagesRequestId.current) return;
        setMessages(response?.messages || []);
        setMessagesError(null);
        lastMessagesErrorAt.current = 0;

        if (markRead && response?.thread?.is_user_unread) {
          await supportService.markThreadRead(threadId).catch(() => null);
          await loadThreads(false);
        }
      } catch (error: any) {
        console.error("[support-chat] load messages failed:", error);
        const message = error?.message || "Failed to load thread messages";
        setMessagesError(message);
        lastMessagesErrorAt.current = Date.now();
      } finally {
        window.clearTimeout(timeoutHandle);
        if (requestId === messagesRequestId.current) {
          messagesLoadRef.current = false;
          setLoadingMessages(false);
        }
      }
    },
    [loadThreads],
  );

  useEffect(() => {
    if (!appUser?.id) return;
    void loadThreads(true, true);
  }, [appUser?.id, loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedThreadId, true, true);
  }, [selectedThreadId, loadMessages]);

  useEffect(() => {
    if (!appUser?.id) return;

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
  }, [appUser?.id, loadThreads]);

  useEffect(() => {
    if (!selectedThreadId) return;

    const messageChannel = supabase
      .channel(`support-messages-${selectedThreadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => {
          void loadMessages(selectedThreadId, false);
          void loadThreads(false);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messageChannel);
    };
  }, [selectedThreadId, loadMessages, loadThreads]);

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
        context: "messenger",
      });

      const createdThread = result?.thread;
      if (!createdThread?.id) {
        throw new Error("Support thread was created without an ID");
      }

      toast.success("Support chat started");
      setNewSubject("");
      setDraftMessage("");
      await loadThreads(true, true);
      setSelectedThreadId(createdThread.id);
      await loadMessages(createdThread.id, false, true);
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
      await loadMessages(selectedThreadId, false, true);
      await loadThreads(false, true);
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
        context: selectedThread?.context || "messenger",
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
    <main className="min-h-screen bg-gradient-to-b from-indigo-950/30 via-background to-background text-foreground">
      <div className="section-shell space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="soft-kicker">
              <LifeBuoy className="size-4 text-primary" />
              Messenger
            </span>
            <h1 className="section-title mt-3">Support Messenger</h1>
            <p className="section-copy">
              A dedicated space to chat with support admins in real time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadThreads(true, true)}
              disabled={loadingThreads}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button type="button" onClick={openNewChatComposer}>
              <MessageSquarePlus className="mr-2 size-4" />
              New Chat
            </Button>
          </div>
        </div>

        <div className="grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-3xl border border-border/70 bg-card/90 shadow-[0_24px_44px_-32px_rgba(15,23,42,0.6)] md:grid-cols-[320px_1fr]">
          <div className="border-b border-border/70 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 p-4">
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

            <div className="h-[calc(70vh-64px)] overflow-y-auto p-3">
              {loadingThreads ? (
                <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader className="size-4 animate-spin" />
                  Loading chats...
                </div>
              ) : threadsError ? (
                <div className="space-y-2 px-2 py-3 text-sm text-muted-foreground">
                  <p>{threadsError}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void loadThreads(true, true)}
                  >
                    Retry
                  </Button>
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
                        className={`w-full rounded-xl border px-3 py-2 text-left transition ${
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
            <div className="border-b border-border/60 px-5 py-4">
              {selectedThread ? (
                <div>
                  <p className="font-semibold">{selectedThread.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedThread.context || "Support"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: {String(selectedThread.status || "pending")}
                  </p>
                </div>
              ) : (
                <p className="text-sm font-semibold">Start a new support chat</p>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-5">
              {selectedThread ? (
                loadingMessages ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader className="size-4 animate-spin" />
                    Loading messages...
                  </div>
                ) : messagesError ? (
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>{messagesError}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        selectedThreadId
                          ? void loadMessages(selectedThreadId, false, true)
                          : null
                      }
                    >
                      Retry
                    </Button>
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
                                ? "border border-border/70 bg-card text-foreground"
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
                              {isAdminMessage ? "Admin" : "You"} -{" "}
                              {formatThreadTime(msg.created_at)}
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

            <div className="border-t border-border/60 p-5">
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
      </div>
    </main>
  );
}

export default MessengerPage;
