import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCheck,
  CircleAlert,
  LifeBuoy,
  Loader,
  MessageSquarePlus,
  MoreVertical,
  RefreshCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { toast } from "sonner";
import {
  supportService,
  type SupportChatMessage,
  type SupportChatThread,
} from "@/services/supportService";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { supabase } from "@/lib/supabase";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { emitMessengerInboxUpdated } from "@/lib/messengerEvents";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CommunityLounge } from "@/app/components/messenger/CommunityLounge";

function formatThreadTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const withinWeek = now.getTime() - date.getTime() < 1000 * 60 * 60 * 24 * 6;
  if (withinWeek) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getInitials(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "MH";
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function buildThreadPreview(thread: SupportChatThread) {
  const preview = thread.last_message_preview?.trim() || "No messages yet";
  if (thread.last_sender_role === "admin") return `Support: ${preview}`;
  if (thread.last_sender_role === "member") return `You: ${preview}`;
  return preview;
}

function getStatusLabel(thread: SupportChatThread | null) {
  if (!thread) return "New";
  const status = String(thread.status || "active").toLowerCase();
  if (["resolved", "rejected", "deleted", "expired"].includes(status)) {
    return "Closed";
  }
  if (status === "pending") return "Pending";
  if (status === "active") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function MessengerPage() {
  const { appUser, isLoading: authLoading } = useAuth();
  const { mode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDarkMode = mode === "dark";
  const activeWorkspace =
    searchParams.get("tab") === "community" ? "community" : "support";

  const [threads, setThreads] = useState<SupportChatThread[]>([]);
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [threadFilter, setThreadFilter] = useState<"all" | "unread">("all");
  const [isComposingNewThread, setIsComposingNewThread] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [creatingThread, setCreatingThread] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [improvingDraft, setImprovingDraft] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [draftMessage, setDraftMessage] = useState("");

  const threadsLoadRef = useRef(false);
  const messagesLoadRef = useRef(false);
  const threadsRequestId = useRef(0);
  const messagesRequestId = useRef(0);
  const lastThreadsErrorAt = useRef(0);
  const lastMessagesErrorAt = useRef(0);
  const compactViewportRef = useRef(isCompactViewport);
  const composerModeRef = useRef(isComposingNewThread);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    compactViewportRef.current = isCompactViewport;
  }, [isCompactViewport]);

  useEffect(() => {
    composerModeRef.current = isComposingNewThread;
  }, [isComposingNewThread]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };

    setIsCompactViewport(mediaQuery.matches);
    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!authLoading && !appUser) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [appUser, authLoading, location.hash, location.pathname, location.search, navigate]);

  const displayName = appUser?.display_name || appUser?.email || "Guest";
  const userInitials = useMemo(() => getInitials(displayName), [displayName]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const selectedThreadClosed = useMemo(() => {
    if (!selectedThread) return false;
    const status = String(selectedThread.status || "").toLowerCase();
    return ["rejected", "expired", "deleted", "resolved"].includes(status);
  }, [selectedThread]);

  const filteredThreads = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesFilter = threadFilter === "unread" ? thread.is_user_unread : true;
      if (!matchesFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        thread.subject,
        thread.context,
        thread.last_message_preview,
        thread.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [searchQuery, threadFilter, threads]);

  const unreadCount = useMemo(
    () => threads.filter((thread) => thread.is_user_unread).length,
    [threads],
  );

  const shouldShowThreadList =
    !isCompactViewport || (!selectedThreadId && !isComposingNewThread);
  const shouldShowConversation =
    !isCompactViewport || Boolean(selectedThreadId || isComposingNewThread);

  const conversationBackdropStyle = useMemo(
    () => ({
      backgroundImage: isDarkMode
        ? [
            "radial-gradient(circle at 20% 18%, rgba(43,108,176,0.16), transparent 30%)",
            "radial-gradient(circle at 82% 14%, rgba(16,185,129,0.12), transparent 26%)",
            "linear-gradient(180deg, rgba(6,16,27,0.96), rgba(8,20,34,0.9))",
          ].join(", ")
        : [
            "radial-gradient(circle at 20% 18%, rgba(147,197,253,0.36), transparent 30%)",
            "radial-gradient(circle at 82% 14%, rgba(110,231,183,0.22), transparent 26%)",
            "linear-gradient(180deg, rgba(241,248,255,0.96), rgba(232,242,249,0.94))",
          ].join(", "),
    }),
    [isDarkMode],
  );

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
        const inbox = await supportService.getInbox(200);
        if (requestId !== threadsRequestId.current) return;

        const nextThreads = inbox?.threads || [];
        setThreads(nextThreads);
        setThreadsError(null);
        lastThreadsErrorAt.current = 0;

        setSelectedThreadId((currentSelected) => {
          if (!preserveSelection) return currentSelected;
          if (composerModeRef.current) return null;

          if (!currentSelected) {
            return compactViewportRef.current ? null : nextThreads[0]?.id || null;
          }

          const stillExists = nextThreads.some((thread) => thread.id === currentSelected);
          if (stillExists) return currentSelected;

          return compactViewportRef.current ? null : nextThreads[0]?.id || null;
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
    if (activeWorkspace !== "support") return;
    if (!appUser?.id) return;
    void loadThreads(true, true);
  }, [activeWorkspace, appUser?.id, loadThreads]);

  useEffect(() => {
    if (activeWorkspace !== "support") return;
    if (!selectedThreadId) {
      setMessages([]);
      setMessagesError(null);
      return;
    }
    void loadMessages(selectedThreadId, true, true);
  }, [activeWorkspace, selectedThreadId, loadMessages]);

  useEffect(() => {
    if (activeWorkspace !== "support") return;
    if (!selectedThreadId) return;
    if (!selectedThread?.is_user_unread) return;

    setThreads((current) =>
      current.map((thread) =>
        thread.id === selectedThreadId ? { ...thread, is_user_unread: false } : thread,
      ),
    );
    emitMessengerInboxUpdated();
    void supportService.markThreadRead(selectedThreadId).catch(() => null);
  }, [activeWorkspace, selectedThread?.is_user_unread, selectedThreadId]);

  useEffect(() => {
    if (activeWorkspace !== "support") return;
    if (!selectedThreadId || loadingMessages) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeWorkspace, loadingMessages, messages, selectedThreadId]);

  useEffect(() => {
    if (activeWorkspace !== "support") return;
    if (!isCompactViewport && !selectedThreadId && !isComposingNewThread && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    }
  }, [activeWorkspace, isCompactViewport, isComposingNewThread, selectedThreadId, threads]);

  useEffect(() => {
    if (activeWorkspace !== "support") return;
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
  }, [activeWorkspace, appUser?.id, loadThreads]);

  useEffect(() => {
    if (activeWorkspace !== "support") return;
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
          void loadMessages(selectedThreadId, true, true);
          void loadThreads(false, true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(messageChannel);
    };
  }, [activeWorkspace, selectedThreadId, loadMessages, loadThreads]);

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
      composerModeRef.current = false;
      setIsComposingNewThread(false);
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
    composerModeRef.current = true;
    setIsComposingNewThread(true);
    setSelectedThreadId(null);
    setMessages([]);
    setMessagesError(null);
  };

  const handleSelectThread = (threadId: string) => {
    composerModeRef.current = false;
    setIsComposingNewThread(false);
    setSelectedThreadId(threadId);
  };

  const handleBackToInbox = () => {
    composerModeRef.current = false;
    setIsComposingNewThread(false);
    setSelectedThreadId(null);
    setMessages([]);
    setMessagesError(null);
  };

  const composerDisabled =
    creatingThread ||
    sendingMessage ||
    improvingDraft ||
    selectedThreadClosed ||
    !appUser?.id;

  const handleMarkAllRead = async () => {
    const unreadThreadIds = threads
      .filter((thread) => thread.is_user_unread)
      .map((thread) => thread.id)
      .filter(Boolean);

    if (unreadThreadIds.length === 0 || markingAllRead) {
      if (!markingAllRead && unreadThreadIds.length === 0) {
        toast.info("There are no unread messenger chats right now.");
      }
      return;
    }

    setMarkingAllRead(true);
    setThreads((current) =>
      current.map((thread) =>
        unreadThreadIds.includes(thread.id)
          ? { ...thread, is_user_unread: false }
          : thread,
      ),
    );

    try {
      const results = await Promise.allSettled(
        unreadThreadIds.map((threadId) => supportService.markThreadRead(threadId)),
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;

      if (successCount === 0) {
        throw new Error("Could not mark messenger chats as read");
      }

      emitMessengerInboxUpdated();

      if (successCount < unreadThreadIds.length) {
        toast.success(`${successCount} chat${successCount === 1 ? "" : "s"} marked as read.`);
        await loadThreads(true, true);
        return;
      }

      toast.success("All messenger chats marked as read.");
      await loadThreads(true, true);
    } catch (error: any) {
      await loadThreads(true, true);
      toast.error(error?.message || "Failed to mark messenger chats as read.");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const switchWorkspace = (workspace: "support" | "community") => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", workspace);
    setSearchParams(nextParams, { replace: true });
  };

  if (activeWorkspace === "community") {
    return <CommunityLounge />;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] px-0 py-2 text-foreground sm:px-4 sm:py-4">
      <div className="app-shell">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <span className="soft-kicker">
              <LifeBuoy className="size-4 text-primary" />
              Messenger
            </span>
            <p className="mt-2 text-sm text-muted-foreground">
              Switch between direct support and the public Murekefu community.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-border/70 bg-background/70 p-1">
              <button
                type="button"
                onClick={() => switchWorkspace("support")}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                <LifeBuoy className="mr-2 inline size-4" />
                Support
              </button>
              <button
                type="button"
                onClick={() => switchWorkspace("community")}
                className="rounded-full px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                <Users className="mr-2 inline size-4" />
                Community
              </button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadThreads(true, true)}
              disabled={loadingThreads}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleMarkAllRead()}
              disabled={markingAllRead || unreadCount === 0}
            >
              <CheckCheck className="mr-2 size-4" />
              {markingAllRead ? "Marking..." : "Mark All Read"}
            </Button>
            <Button type="button" size="sm" onClick={openNewChatComposer}>
              <MessageSquarePlus className="mr-2 size-4" />
              New Chat
            </Button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.8)] backdrop-blur-xl">
          <div className="grid h-[calc(100vh-9rem)] min-h-[620px] grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
            <aside
              className={`${shouldShowThreadList ? "flex" : "hidden"} min-h-0 flex-col border-r border-border/60 bg-background/80 md:flex`}
            >
              <div className="border-b border-border/60 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {userInitials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        Support inbox
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void loadThreads(true, true)}
                      disabled={loadingThreads}
                      aria-label="Refresh chats"
                    >
                      <RefreshCcw className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={openNewChatComposer}
                      aria-label="Start a new chat"
                    >
                      <MessageSquarePlus className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-border/60 bg-background/75 px-3 py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Search className="size-4" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search or start a new chat"
                      className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setThreadFilter("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      threadFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setThreadFilter("unread")}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      threadFilter === "unread"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
                  </button>
                </div>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-2 p-3">
                  {loadingThreads ? (
                    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/70 px-3 py-4 text-sm text-muted-foreground">
                      <Loader className="size-4 animate-spin" />
                      Loading chats...
                    </div>
                  ) : threadsError ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-foreground">
                      <p>{threadsError}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => void loadThreads(true, true)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : filteredThreads.length === 0 ? (
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
                      {searchQuery.trim()
                        ? "No chats match that search yet."
                        : "No chats yet. Start a new one to reach support."}
                    </div>
                  ) : (
                    filteredThreads.map((thread) => {
                      const isActive = thread.id === selectedThreadId;
                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => handleSelectThread(thread.id)}
                          className={`flex w-full items-start gap-3 rounded-[1.35rem] border px-3 py-3 text-left transition ${
                            isActive
                              ? "border-primary/50 bg-primary/10 shadow-[0_18px_40px_-34px_rgba(16,185,129,0.85)]"
                              : "border-border/60 bg-background/65 hover:bg-muted/50"
                          }`}
                        >
                          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                            {getInitials(thread.subject || "Support")}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="truncate text-sm font-semibold">
                                {thread.subject || "Support Request"}
                              </p>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatThreadTime(thread.last_message_at)}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {buildThreadPreview(thread)}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="rounded-full bg-muted/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                {getStatusLabel(thread)}
                              </span>
                              {thread.is_user_unread ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-300">
                                  <span className="size-1.5 rounded-full bg-current" />
                                  New
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </aside>

            <section
              className={`${shouldShowConversation ? "flex" : "hidden"} min-h-0 flex-col md:flex`}
            >
              <div className="border-b border-border/60 bg-background/70 px-4 py-3 backdrop-blur-md sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {isCompactViewport ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleBackToInbox}
                        aria-label="Back to chats"
                      >
                        <ArrowLeft className="size-4" />
                      </Button>
                    ) : null}

                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      {selectedThread ? (
                        <span className="text-xs font-semibold">
                          {getInitials(selectedThread.subject || "Support")}
                        </span>
                      ) : (
                        <ShieldCheck className="size-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold sm:text-base">
                        {selectedThread ? selectedThread.subject : "New support chat"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedThread
                          ? `${selectedThread.context || "Support"} - ${getStatusLabel(selectedThread)}`
                          : "Start a chat with the admin team"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {selectedThreadClosed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                        <CircleAlert className="size-3.5" />
                        Closed
                      </span>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        selectedThreadId
                          ? void loadMessages(selectedThreadId, false, true)
                          : void loadThreads(true, true)
                      }
                      aria-label="Refresh conversation"
                    >
                      <RefreshCcw className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={openNewChatComposer}
                      aria-label="Open new chat composer"
                    >
                      <MessageSquarePlus className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="More options">
                      <MoreVertical className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 overflow-hidden" style={conversationBackdropStyle}>
                <div
                  className="pointer-events-none absolute inset-0 opacity-70"
                  style={{
                    backgroundImage: [
                      "radial-gradient(circle at 0 0, rgba(255,255,255,0.06) 2px, transparent 2px)",
                      "radial-gradient(circle at 22px 20px, rgba(255,255,255,0.05) 1.5px, transparent 1.6px)",
                    ].join(", "),
                    backgroundSize: "46px 46px, 64px 64px",
                  }}
                  aria-hidden="true"
                />

                <ScrollArea className="relative h-full">
                  <div className="space-y-4 px-4 py-5 sm:px-6">
                    {!selectedThread ? (
                      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center">
                        <div className="rounded-[1.8rem] border border-border/60 bg-card/88 p-6 text-center shadow-[0_20px_50px_-34px_rgba(15,23,42,0.75)] backdrop-blur-xl">
                          <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
                            <LifeBuoy className="size-6" />
                          </div>
                          <h2 className="mt-4 text-xl font-semibold">
                            Start a support conversation
                          </h2>
                          <p className="mt-2 text-sm text-muted-foreground">
                            Your chats stay here so you can come back to every reply,
                            just like a dedicated messenger workspace.
                          </p>
                          <div className="mt-4 rounded-2xl border border-border/60 bg-background/75 p-4 text-left">
                            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                              Ready to send
                            </p>
                            <p className="mt-2 text-sm text-foreground">
                              Add a subject and message below, then start the chat.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : loadingMessages ? (
                      <div className="flex min-h-[50vh] items-center justify-center">
                        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/85 px-4 py-2 text-sm text-muted-foreground">
                          <Loader className="size-4 animate-spin" />
                          Loading messages...
                        </div>
                      </div>
                    ) : messagesError ? (
                      <div className="mx-auto max-w-lg rounded-[1.4rem] border border-destructive/20 bg-destructive/10 p-5">
                        <p className="text-sm text-foreground">{messagesError}</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-3"
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
                      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center">
                        <div className="rounded-[1.5rem] border border-border/60 bg-card/88 p-5 text-center">
                          <p className="text-sm text-muted-foreground">
                            No messages in this chat yet. Your next message will start
                            the conversation.
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isAdminMessage = message.sender_role === "admin";
                        return (
                          <div
                            key={message.id}
                            className={`flex ${isAdminMessage ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[min(88%,40rem)] rounded-[1.35rem] px-4 py-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.7)] ${
                                isAdminMessage
                                  ? "rounded-bl-md border border-border/60 bg-card/92 text-foreground"
                                  : "rounded-br-md bg-emerald-500 text-emerald-50"
                              }`}
                            >
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {message.message}
                              </p>
                              <div
                                className={`mt-2 flex items-center justify-end gap-1 text-[11px] ${
                                  isAdminMessage
                                    ? "text-muted-foreground"
                                    : "text-emerald-50/80"
                                }`}
                              >
                                {!isAdminMessage ? <CheckCheck className="size-3.5" /> : null}
                                <span>{formatMessageTime(message.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              <div className="border-t border-border/60 bg-background/88 px-3 py-3 backdrop-blur-md sm:px-4">
                {!selectedThread ? (
                  <div className="mb-3">
                    <Label htmlFor="support-subject" className="sr-only">
                      Subject
                    </Label>
                    <Input
                      id="support-subject"
                      value={newSubject}
                      onChange={(event) => setNewSubject(event.target.value)}
                      placeholder="Subject for this support chat"
                      maxLength={160}
                      disabled={creatingThread || sendingMessage}
                      className="h-11 rounded-2xl border-border/60 bg-card/75"
                    />
                  </div>
                ) : null}

                {selectedThreadClosed ? (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                    This ticket is closed. Start a new chat if you still need help.
                  </div>
                ) : null}

                <div className="flex items-end gap-2 rounded-[1.65rem] border border-border/60 bg-card/80 p-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.72)]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleImproveDraftWithAi()}
                    disabled={composerDisabled || !draftMessage.trim()}
                    aria-label="Use AI to improve message"
                    title="Use AI to improve message"
                  >
                    {improvingDraft ? (
                      <Loader className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                  </Button>

                  <div className="min-w-0 flex-1">
                    <Label htmlFor="support-message" className="sr-only">
                      Message
                    </Label>
                    <Textarea
                      id="support-message"
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder={
                        selectedThread
                          ? "Type a message"
                          : "Describe your issue in detail"
                      }
                      rows={1}
                      maxLength={4000}
                      disabled={composerDisabled}
                      className="max-h-36 min-h-[52px] resize-none border-0 bg-transparent px-2 py-3 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-full"
                    onClick={() => void handleSendMessage()}
                    disabled={composerDisabled || !draftMessage.trim()}
                    aria-label={selectedThread ? "Send reply" : "Start chat"}
                  >
                    {creatingThread || sendingMessage ? (
                      <Loader className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

export default MessengerPage;
