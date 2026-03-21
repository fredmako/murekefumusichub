import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Loader,
  Paperclip,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Smile,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Textarea } from "@/app/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { storageService } from "@/services/api";
import {
  communityService,
  DEFAULT_COMMUNITY_SETTINGS,
  type CommunityMessage,
  type CommunityRoom,
  type CommunitySettings,
  type CommunityUserPreview,
} from "@/services/communityService";

const EMOJIS = ["🙏", "🎼", "✨", "🔥", "👏", "💙", "🙌", "🎧"];

function getInitials(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "MH";
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function getWallpaperBackground(
  wallpaper: CommunitySettings["wallpaper"],
  isDarkMode: boolean,
) {
  if (wallpaper === "sunrise") {
    return isDarkMode
      ? "radial-gradient(circle at 18% 18%, rgba(244,114,182,0.18), transparent 26%), radial-gradient(circle at 82% 12%, rgba(251,191,36,0.18), transparent 24%), linear-gradient(180deg, rgba(35,17,35,0.97), rgba(21,18,31,0.96))"
      : "radial-gradient(circle at 18% 18%, rgba(253,164,175,0.34), transparent 26%), radial-gradient(circle at 82% 12%, rgba(253,224,71,0.28), transparent 24%), linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,238,230,0.97))";
  }

  if (wallpaper === "graphite") {
    return isDarkMode
      ? "radial-gradient(circle at 14% 18%, rgba(148,163,184,0.12), transparent 24%), linear-gradient(180deg, rgba(8,12,20,0.98), rgba(18,24,35,0.96))"
      : "radial-gradient(circle at 14% 18%, rgba(148,163,184,0.16), transparent 24%), linear-gradient(180deg, rgba(246,248,252,0.98), rgba(235,239,245,0.97))";
  }

  return isDarkMode
    ? "radial-gradient(circle at 14% 18%, rgba(56,189,248,0.14), transparent 26%), radial-gradient(circle at 78% 12%, rgba(129,140,248,0.18), transparent 24%), linear-gradient(180deg, rgba(7,16,30,0.98), rgba(9,25,43,0.96))"
    : "radial-gradient(circle at 14% 18%, rgba(125,211,252,0.28), transparent 26%), radial-gradient(circle at 78% 12%, rgba(196,181,253,0.25), transparent 24%), linear-gradient(180deg, rgba(241,248,255,0.97), rgba(231,241,249,0.96))";
}

function getOwnBubbleClasses(tone: CommunitySettings["bubbleTone"]) {
  if (tone === "ocean") return "bg-sky-500 text-sky-50";
  if (tone === "sunset") return "bg-rose-500 text-rose-50";
  return "bg-primary text-primary-foreground";
}

export function CommunityLounge() {
  const { appUser, isLoading: authLoading } = useAuth();
  const { mode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDarkMode = mode === "dark";

  const [room, setRoom] = useState<CommunityRoom | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [settings, setSettings] = useState<CommunitySettings>(
    DEFAULT_COMMUNITY_SETTINGS,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] =
    useState<CommunityUserPreview | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!authLoading && !appUser) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [
    appUser,
    authLoading,
    location.hash,
    location.pathname,
    location.search,
    navigate,
  ]);

  useEffect(() => {
    if (!attachmentFile) {
      setAttachmentPreview(null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(attachmentFile);
    setAttachmentPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [attachmentFile]);

  const loadCommunity = async (showRefreshing = false) => {
    if (!appUser?.id) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [roomPayload, settingsPayload] = await Promise.all([
        communityService.getPrimaryRoom(),
        communityService.getMySettings(),
      ]);
      const nextRoom = roomPayload?.room || null;
      setRoom(nextRoom);
      setSettings(settingsPayload || DEFAULT_COMMUNITY_SETTINGS);

      if (nextRoom?.id) {
        const messagePayload = await communityService.getRoomMessages(nextRoom.id);
        setMessages(messagePayload?.messages || []);
      } else {
        setMessages([]);
      }
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load the community lounge.");
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!appUser?.id) return;
    void loadCommunity(false);
  }, [appUser?.id]);

  useEffect(() => {
    if (!room?.id) return;
    const timer = window.setInterval(() => {
      void communityService
        .getRoomMessages(room.id)
        .then((payload) => {
          setMessages(payload?.messages || []);
          setError(null);
        })
        .catch((err: any) => {
          setError(err?.message || "Failed to refresh community messages.");
        });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [room?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => {
      const sender = message.sender?.display_name || message.sender?.email || "";
      return `${sender} ${message.message || ""}`.toLowerCase().includes(query);
    });
  }, [messages, searchQuery]);

  const participantsCount = useMemo(
    () =>
      new Set(
        messages
          .map((message) => String(message.sender?.id || "").trim())
          .filter(Boolean),
      ).size,
    [messages],
  );
  const messageStackClass = settings.density === "compact" ? "space-y-3" : "space-y-4";

  const handleSaveSettings = async (next: Partial<CommunitySettings>) => {
    const optimistic = { ...settings, ...next };
    setSettings(optimistic);
    try {
      const saved = await communityService.updateMySettings(optimistic);
      setSettings(saved);
      toast.success("Community settings updated");
    } catch (err: any) {
      toast.error(err?.message || "Could not save community settings");
    }
  };

  const handleSend = async () => {
    if (!room?.id || !appUser?.id) return;
    const normalizedMessage = draftMessage.trim();
    if (!normalizedMessage && !attachmentFile) {
      toast.error("Add a message or image before sending.");
      return;
    }

    setSending(true);
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentKind: "text" | "image" = "text";

      if (attachmentFile) {
        attachmentUrl = await storageService.uploadFile(
          "thumbnails",
          attachmentFile,
          appUser.id,
          { timeoutMs: 45000 },
        );
        attachmentName = attachmentFile.name;
        attachmentKind = "image";
      }

      const response = await communityService.sendMessage(room.id, {
        message: normalizedMessage || undefined,
        attachmentUrl,
        attachmentName,
        attachmentKind,
      });

      if (response?.message) {
        setMessages((current) => [...current, response.message]);
      } else {
        const refreshed = await communityService.getRoomMessages(room.id);
        setMessages(refreshed?.messages || []);
      }

      setDraftMessage("");
      setAttachmentFile(null);
      toast.success("Message sent");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send community message");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] px-0 py-2 text-foreground sm:px-4 sm:py-4">
      <div className="app-shell">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <span className="soft-kicker">
              <Users className="size-4 text-primary" />
              Community
            </span>
            <p className="mt-2 text-sm text-muted-foreground">
              A public chat space for everyone inside Murekefu Music Hub.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/messenger?tab=support")}
            >
              Support
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadCommunity(true)}
              disabled={refreshing || loading}
            >
              <RefreshCcw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="mr-2 size-4" />
              Settings
            </Button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-border/70 bg-card/90 shadow-[0_24px_56px_-36px_rgba(15,23,42,0.8)] backdrop-blur-xl">
          <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="border-b border-border/60 bg-background/80 p-4 lg:border-r lg:border-b-0">
              <div className="rounded-[1.4rem] border border-border/60 bg-card/85 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Murekefu Community
                </p>
                <h2 className="mt-3 text-lg font-semibold">
                  {room?.name || "Community Lounge"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {room?.description ||
                    "Meet learners, composers, buyers, and the Murekefu team."}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="rounded-2xl border border-border/60 bg-background/75 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Participants
                    </p>
                    <p className="mt-2 text-lg font-semibold">{participantsCount}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/75 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Style
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {settings.wallpaper} / {settings.density}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[1.4rem] border border-border/60 bg-card/85 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Smile className="size-4 text-primary" />
                  Quick emoji
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setDraftMessage((current) => `${current}${emoji}`)}
                      className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-lg transition hover:bg-muted/50"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <section className="min-h-0">
              <div className="border-b border-border/60 bg-background/75 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      Group chat for everyone on the platform
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click any profile picture in this space to open a member preview.
                    </p>
                  </div>
                  <div className="flex min-w-[240px] items-center gap-2 rounded-2xl border border-border/60 bg-card/80 px-3 py-2">
                    <Search className="size-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search community"
                      className="h-auto border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>

              <div
                className="relative min-h-0"
                style={{
                  backgroundImage: getWallpaperBackground(settings.wallpaper, isDarkMode),
                }}
              >
                <ScrollArea className="h-[calc(100vh-17rem)] min-h-[420px]">
                  <div className={`${messageStackClass} px-4 py-5 sm:px-6`}>
                    {loading ? (
                      <div className="flex min-h-[44vh] items-center justify-center">
                        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/88 px-4 py-2 text-sm text-muted-foreground">
                          <Loader className="size-4 animate-spin" />
                          Loading community messages...
                        </div>
                      </div>
                    ) : error ? (
                      <div className="mx-auto max-w-lg rounded-[1.4rem] border border-destructive/20 bg-destructive/10 p-5 text-sm text-foreground">
                        {error}
                      </div>
                    ) : filteredMessages.length === 0 ? (
                      <div className="mx-auto max-w-lg rounded-[1.4rem] border border-border/60 bg-card/88 p-5 text-center text-sm text-muted-foreground">
                        {searchQuery.trim()
                          ? "No messages match that search."
                          : "No messages yet. Start the conversation."}
                      </div>
                    ) : (
                      filteredMessages.map((message) => {
                        const isOwn = message.sender_user_id === appUser?.id;
                        const senderName =
                          message.sender?.display_name ||
                          message.sender?.email ||
                          "Murekefu member";

                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            {!isOwn ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProfile(message.sender)}
                                className="mt-1 shrink-0"
                              >
                                <Avatar className="size-10 border border-border/60">
                                  <AvatarImage src={message.sender?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(senderName)}
                                  </AvatarFallback>
                                </Avatar>
                              </button>
                            ) : null}

                            <div
                              className={`max-w-[min(92%,42rem)] rounded-[1.35rem] px-4 py-3 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.7)] ${
                                isOwn
                                  ? `rounded-br-md ${getOwnBubbleClasses(settings.bubbleTone)}`
                                  : "rounded-bl-md border border-border/60 bg-card/92 text-foreground"
                              }`}
                            >
                              {!isOwn ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedProfile(message.sender)}
                                  className="mb-1 text-left text-xs font-semibold opacity-80 hover:underline"
                                >
                                  {senderName}
                                </button>
                              ) : null}
                              {message.message ? (
                                <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                  {message.message}
                                </p>
                              ) : null}
                              {message.attachment_url ? (
                                <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-background/15">
                                  <img
                                    src={message.attachment_url}
                                    alt={message.attachment_name || "Attachment"}
                                    className="max-h-72 w-full object-cover"
                                  />
                                  {message.attachment_name ? (
                                    <div className="px-3 py-2 text-xs opacity-80">
                                      {message.attachment_name}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="mt-2 text-right text-[11px] opacity-80">
                                {formatTime(message.created_at)}
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
                {attachmentPreview ? (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3">
                    <img
                      src={attachmentPreview}
                      alt={attachmentFile?.name || "Pending attachment"}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {attachmentFile?.name || "Image attachment"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ready to send with your message
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAttachmentFile(null)}>
                      Remove
                    </Button>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pb-3">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={`composer-${emoji}`}
                      type="button"
                      onClick={() => setDraftMessage((current) => `${current}${emoji}`)}
                      className="rounded-full border border-border/60 bg-card/75 px-3 py-1 text-sm transition hover:bg-muted/50"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setAttachmentFile(nextFile);
                    event.currentTarget.value = "";
                  }}
                />

                <div className="flex items-end gap-2 rounded-[1.65rem] border border-border/60 bg-card/80 p-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.72)]">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || !room?.id}
                  >
                    <Paperclip className="size-4" />
                  </Button>

                  <div className="min-w-0 flex-1">
                    <Label htmlFor="community-message" className="sr-only">
                      Community message
                    </Label>
                    <Textarea
                      id="community-message"
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder="Share a thought with the Murekefu community"
                      rows={1}
                      maxLength={4000}
                      disabled={sending || !room?.id}
                      className="max-h-36 min-h-[52px] resize-none border-0 bg-transparent px-2 py-3 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-full"
                    onClick={() => void handleSend()}
                    disabled={sending || (!draftMessage.trim() && !attachmentFile)}
                  >
                    {sending ? (
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

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="border-border/70 bg-card/95 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Community settings</DialogTitle>
              <DialogDescription>
                Personalize the lounge layout for your account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold">Wallpaper</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["aurora", "graphite", "sunrise"] as const).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={settings.wallpaper === option ? "default" : "outline"}
                      onClick={() => void handleSaveSettings({ wallpaper: option })}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Bubble tone</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["theme", "ocean", "sunset"] as const).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={settings.bubbleTone === option ? "default" : "outline"}
                      onClick={() => void handleSaveSettings({ bubbleTone: option })}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold">Density</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["comfortable", "compact"] as const).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={settings.density === option ? "default" : "outline"}
                      onClick={() => void handleSaveSettings({ density: option })}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(selectedProfile)}
          onOpenChange={(open) => {
            if (!open) setSelectedProfile(null);
          }}
        >
          <DialogContent className="border-border/70 bg-card/95 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Community profile</DialogTitle>
              <DialogDescription>
                These quick profiles are available only inside the community chat.
              </DialogDescription>
            </DialogHeader>
            {selectedProfile ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-14 border border-border/60">
                    <AvatarImage src={selectedProfile.avatar_url || undefined} />
                    <AvatarFallback>
                      {getInitials(
                        selectedProfile.display_name || selectedProfile.email,
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-base font-semibold">
                      {selectedProfile.display_name || "Murekefu member"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedProfile.email || "No email shared"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

export default CommunityLounge;
