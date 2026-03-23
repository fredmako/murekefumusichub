import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AudioLines,
  BellRing,
  FileText,
  ImagePlus,
  Loader,
  Mic,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Smile,
  Square,
  Users,
  X,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { storageService } from "@/services/api";
import {
  buildProfileImageSrcSet,
  getOptimizedProfileImageUrl,
} from "@/services/profileImageService";
import {
  communityService,
  DEFAULT_COMMUNITY_SETTINGS,
  type CommunityAttachmentKind,
  type CommunityMessage,
  type CommunityRoom,
  type CommunitySettings,
  type CommunityUserPreview,
} from "@/services/communityService";

function getInitials(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "MH";
  const parts = normalized.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

const COMMUNITY_QUICK_EMOJIS = [
  "\u{1F64F}",
  "\u{1F3BC}",
  "\u2728",
  "\u{1F525}",
  "\u{1F44F}",
  "\u{1F499}",
  "\u{1F64C}",
  "\u{1F3A7}",
];

const COMMUNITY_ETIQUETTE = [
  "Welcome new members warmly and keep the tone respectful.",
  "Share music, ideas, and feedback without spamming the lounge.",
  "Avoid harmful, abusive, or misleading content when posting publicly.",
];

function getEtiquetteStorageKey(userId?: string | null) {
  return `community-etiquette-seen:${String(userId || "guest")}`;
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

type CommunityDraftAttachment = {
  file: File;
  kind: Exclude<CommunityAttachmentKind, "text">;
  previewUrl: string | null;
  mimeType: string;
  fileSize: number;
  durationMs?: number | null;
};

function detectCommunityAttachmentKind(
  file: File,
): Exclude<CommunityAttachmentKind, "text"> {
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    [
      ".pdf",
      ".doc",
      ".docx",
      ".txt",
      ".rtf",
      ".csv",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
    ].some((extension) => name.endsWith(extension))
  ) {
    return "document";
  }

  return "document";
}

function createAttachmentPreviewUrl(
  file: File,
  kind: Exclude<CommunityAttachmentKind, "text">,
) {
  return ["image", "video", "audio"].includes(kind) ? URL.createObjectURL(file) : null;
}

function revokeAttachmentPreviewUrl(value?: string | null) {
  if (value && value.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
}

function formatFileSize(bytes?: number | null) {
  const normalized = Number(bytes);
  if (!Number.isFinite(normalized) || normalized <= 0) return "";
  if (normalized >= 1024 * 1024) {
    return `${(normalized / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (normalized >= 1024) {
    return `${Math.round(normalized / 1024)} KB`;
  }
  return `${normalized} B`;
}

function formatDurationMs(value?: number | null) {
  const totalSeconds = Math.max(0, Math.floor(Number(value || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderCommunityAttachment(message: CommunityMessage) {
  const attachmentUrl = message.attachment_url || undefined;
  const attachmentName = message.attachment_name || "Attachment";
  const mimeType = String(message.metadata?.mimeType || "").toLowerCase();
  const fileSize = formatFileSize(message.metadata?.fileSize);

  if (message.attachment_kind === "image" && attachmentUrl) {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-background/15">
        <img
          src={attachmentUrl}
          alt={attachmentName}
          className="max-h-80 w-full object-cover"
        />
        <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs opacity-80">
          <span className="truncate">{attachmentName}</span>
          {fileSize ? <span className="shrink-0">{fileSize}</span> : null}
        </div>
      </div>
    );
  }

  if (message.attachment_kind === "video" && attachmentUrl) {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-black/10 bg-background/15 p-2">
        <video
          controls
          preload="metadata"
          className="max-h-80 w-full rounded-xl bg-black"
          src={attachmentUrl}
        />
        <div className="flex items-center justify-between gap-2 px-1 pt-2 text-xs opacity-80">
          <span className="truncate">{attachmentName}</span>
          {fileSize ? <span className="shrink-0">{fileSize}</span> : null}
        </div>
      </div>
    );
  }

  if (message.attachment_kind === "audio" && attachmentUrl) {
    return (
      <div className="mt-3 rounded-2xl border border-black/10 bg-background/15 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <AudioLines className="size-4" />
          <span className="truncate">{attachmentName}</span>
        </div>
        <audio controls preload="metadata" className="w-full" src={attachmentUrl} />
        <div className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
          <span>{mimeType || "Audio attachment"}</span>
          <span className="shrink-0">
            {[fileSize, formatDurationMs(message.metadata?.durationMs)]
              .filter(Boolean)
              .join(" • ")}
          </span>
        </div>
      </div>
    );
  }

  if (message.attachment_kind === "document") {
    return (
      <div className="mt-3 rounded-2xl border border-black/10 bg-background/15 p-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-background/80 p-2">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attachmentName}</p>
            <p className="mt-1 text-xs opacity-80">
              {[mimeType || "Document", fileSize].filter(Boolean).join(" • ")}
            </p>
            {attachmentUrl ? (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center text-xs font-semibold underline-offset-4 hover:underline"
              >
                Open document
              </a>
            ) : (
              <p className="mt-2 text-xs opacity-80">Document is preparing...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function getCommunityAvatarImage(
  avatarUrl: string | null | undefined,
  size: number,
) {
  return {
    src:
      getOptimizedProfileImageUrl(avatarUrl, {
        width: size * 2,
        height: size * 2,
        resize: "cover",
      }) ||
      avatarUrl ||
      undefined,
    srcSet:
      buildProfileImageSrcSet(avatarUrl, [size, size * 2], {
        resize: "cover",
      }) || undefined,
    sizes: `${size}px`,
  };
}

function CommunityAvatar({
  user,
  size,
  className,
  fallbackClassName,
}: {
  user: CommunityUserPreview | null | undefined;
  size: number;
  className?: string;
  fallbackClassName?: string;
}) {
  const displayName = user?.display_name || user?.email || "Murekefu member";
  const avatarImage = getCommunityAvatarImage(user?.avatar_url, size);

  return (
    <Avatar className={className}>
      <AvatarImage
        src={avatarImage.src}
        srcSet={avatarImage.srcSet}
        sizes={avatarImage.sizes}
        alt={displayName}
      />
      <AvatarFallback className={fallbackClassName}>
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  );
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
  const [draftAttachment, setDraftAttachment] =
    useState<CommunityDraftAttachment | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [showComposerEmojis, setShowComposerEmojis] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showEtiquetteNotice, setShowEtiquetteNotice] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      mediaRecorderRef.current?.stream
        ?.getTracks()
        .forEach((track) => track.stop());
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      revokeAttachmentPreviewUrl(draftAttachment?.previewUrl);
    };
  }, [draftAttachment?.previewUrl]);

  useEffect(() => {
    if (!appUser?.id) return;
    const storageKey = getEtiquetteStorageKey(appUser.id);
    const hasSeenNotice = localStorage.getItem(storageKey) === "true";
    setShowEtiquetteNotice(!hasSeenNotice);
    if (!hasSeenNotice) {
      toast("Community etiquette", {
        description:
          "Be respectful, welcome others, and keep the lounge helpful for everyone.",
      });
    }
  }, [appUser?.id]);

  const loadCommunity = async (showRefreshing = false) => {
    if (!appUser?.id) return;
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const [roomPayload, settingsPayload] = await Promise.all([
        communityService.getPrimaryRoom(),
        communityService.getMySettings().catch((settingsError) => {
          console.warn("[community-lounge] settings fallback:", settingsError);
          return DEFAULT_COMMUNITY_SETTINGS;
        }),
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
      return `${sender} ${message.message || ""} ${message.attachment_name || ""}`
        .toLowerCase()
        .includes(query);
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

  const handleDismissEtiquette = () => {
    if (appUser?.id) {
      localStorage.setItem(getEtiquetteStorageKey(appUser.id), "true");
    }
    setShowEtiquetteNotice(false);
  };

  const clearDraftAttachment = () => {
    revokeAttachmentPreviewUrl(draftAttachment?.previewUrl);
    setDraftAttachment(null);
    setRecordingDurationMs(0);
  };

  const setDraftAttachmentFromFile = (
    nextFile: File | null,
    options?: { durationMs?: number | null },
  ) => {
    if (!nextFile) return;

    const nextKind = detectCommunityAttachmentKind(nextFile);
    const nextPreviewUrl = createAttachmentPreviewUrl(nextFile, nextKind);
    revokeAttachmentPreviewUrl(draftAttachment?.previewUrl);
    setDraftAttachment({
      file: nextFile,
      kind: nextKind,
      previewUrl: nextPreviewUrl,
      mimeType: nextFile.type || "",
      fileSize: nextFile.size,
      durationMs: options?.durationMs ?? null,
    });
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingTracks = () => {
    mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
    recordingStreamRef.current = null;
  };

  const stopAudioRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    await new Promise<void>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => {
          const blobType =
            recorder.mimeType ||
            recordingChunksRef.current[0]?.type ||
            "audio/webm";
          const extension = blobType.includes("mp4") ? "m4a" : "webm";
          const recordedBlob = new Blob(recordingChunksRef.current, {
            type: blobType,
          });
          const recordedFile = new File(
            [recordedBlob],
            `community-voice-note-${Date.now()}.${extension}`,
            { type: blobType },
          );
          const startedAt = recordingStartedAtRef.current || Date.now();
          setDraftAttachmentFromFile(recordedFile, {
            durationMs: Math.max(0, Date.now() - startedAt),
          });
          recordingChunksRef.current = [];
          recordingStartedAtRef.current = null;
          stopRecordingTimer();
          stopRecordingTracks();
          setIsRecordingAudio(false);
          resolve();
        },
        { once: true },
      );
      recorder.stop();
    });
  };

  const startAudioRecording = async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      toast.error("Audio recording is not supported on this device or browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setRecordingDurationMs(0);
      setAttachmentMenuOpen(false);

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      });

      recorder.start();
      stopRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        if (!recordingStartedAtRef.current) return;
        setRecordingDurationMs(Date.now() - recordingStartedAtRef.current);
      }, 250);
    } catch (err: any) {
      toast.error(
        err?.message || "Microphone access was not granted for voice recording.",
      );
      stopRecordingTimer();
      stopRecordingTracks();
      setIsRecordingAudio(false);
    }
  };

  const handleSend = async () => {
    if (!room?.id || !appUser?.id) return;
    const normalizedMessage = draftMessage.trim();
    if (!normalizedMessage && !draftAttachment) {
      toast.error("Add a message or attachment before sending.");
      return;
    }

    setSending(true);
    const optimisticId = `community-pending-${Date.now()}`;
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentKind: CommunityAttachmentKind = "text";
      let attachmentMetadata: Record<string, any> = {};

      const optimisticMessage: CommunityMessage = {
        id: optimisticId,
        room_id: room.id,
        sender_user_id: appUser.id,
        message: normalizedMessage || null,
        attachment_url: draftAttachment?.previewUrl || null,
        attachment_name: draftAttachment?.file.name || null,
        attachment_kind: draftAttachment?.kind || "text",
        metadata: draftAttachment
          ? {
              mimeType: draftAttachment.mimeType,
              fileSize: draftAttachment.fileSize,
              durationMs: draftAttachment.durationMs ?? null,
              pending: true,
            }
          : { pending: true },
        created_at: new Date().toISOString(),
        sender: {
          id: appUser.id,
          display_name: appUser.display_name,
          email: appUser.email,
          avatar_url: appUser.avatar_url,
        },
      };

      setMessages((current) => [...current, optimisticMessage]);

      if (draftAttachment) {
        const uploadResult = await storageService.uploadCommunityAttachment(
          draftAttachment.file,
          appUser.id,
          { timeoutMs: 60000 },
        );
        attachmentUrl = uploadResult.url;
        attachmentName = draftAttachment.file.name;
        attachmentKind = draftAttachment.kind;
        attachmentMetadata = {
          mimeType: uploadResult.mimeType || draftAttachment.mimeType || null,
          fileSize: draftAttachment.fileSize,
          durationMs: draftAttachment.durationMs ?? null,
          storageBucket: uploadResult.bucket,
          storagePath: uploadResult.path,
        };
      }

      const response = await communityService.sendMessage(room.id, {
        message: normalizedMessage || undefined,
        attachmentUrl,
        attachmentName,
        attachmentKind,
        metadata: attachmentMetadata,
      });

      if (response?.message) {
        setMessages((current) =>
          current.map((message) =>
            message.id === optimisticId ? response.message : message,
          ),
        );
      } else {
        const refreshed = await communityService.getRoomMessages(room.id);
        setMessages(refreshed?.messages || []);
      }

      setDraftMessage("");
      clearDraftAttachment();
      setShowComposerEmojis(false);
      toast.success("Message sent");
    } catch (err: any) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId),
      );
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
                  {COMMUNITY_QUICK_EMOJIS.map((emoji) => (
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

              {showEtiquetteNotice ? (
                <div className="mt-4 rounded-[1.4rem] border border-primary/20 bg-primary/10 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <BellRing className="size-4 text-primary" />
                        Community etiquette
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        A quick note for everyone joining the lounge.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleDismissEtiquette}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {COMMUNITY_ETIQUETTE.map((rule) => (
                      <div key={rule} className="flex items-start gap-2 text-sm">
                        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{rule}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={handleDismissEtiquette}
                  >
                    Got it
                  </Button>
                </div>
              ) : null}
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
                        <p>{error}</p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void loadCommunity(true)}
                            disabled={refreshing || loading}
                          >
                            <RefreshCcw className="mr-2 size-4" />
                            Refresh
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => navigate("/messenger?tab=support")}
                          >
                            Contact support
                          </Button>
                        </div>
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
                        const senderProfile =
                          message.sender ||
                          (isOwn && appUser
                            ? {
                                id: appUser.id,
                                display_name: appUser.display_name,
                                email: appUser.email,
                                avatar_url: appUser.avatar_url,
                              }
                            : null);
                        const senderName =
                          senderProfile?.display_name ||
                          senderProfile?.email ||
                          "Murekefu member";

                        return (
                          <div
                            key={message.id}
                            className={`flex gap-3 ${isOwn ? "justify-end" : "justify-start"}`}
                          >
                            {!isOwn ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProfile(senderProfile)}
                                className="mt-1 shrink-0"
                              >
                                <CommunityAvatar
                                  user={senderProfile}
                                  size={40}
                                  className="size-10 border border-border/60"
                                  fallbackClassName="text-xs"
                                />
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
                                  onClick={() => setSelectedProfile(senderProfile)}
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
                              {renderCommunityAttachment(message)}
                              <div className="mt-2 text-right text-[11px] opacity-80">
                                {message.metadata?.pending
                                  ? "Sending..."
                                  : formatTime(message.created_at)}
                              </div>
                            </div>

                            {isOwn ? (
                              <button
                                type="button"
                                onClick={() => setSelectedProfile(senderProfile)}
                                className="mt-1 shrink-0"
                              >
                                <CommunityAvatar
                                  user={senderProfile}
                                  size={40}
                                  className="size-10 border border-border/60"
                                  fallbackClassName="text-xs"
                                />
                              </button>
                            ) : null}
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>

              <div className="border-t border-border/60 bg-background/88 px-3 py-3 backdrop-blur-md sm:px-4">
                {draftAttachment ? (
                  <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3">
                    {draftAttachment.kind === "image" && draftAttachment.previewUrl ? (
                      <img
                        src={draftAttachment.previewUrl}
                        alt={draftAttachment.file.name || "Pending attachment"}
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                    ) : draftAttachment.kind === "video" && draftAttachment.previewUrl ? (
                      <video
                        src={draftAttachment.previewUrl}
                        className="h-16 w-16 rounded-xl bg-black object-cover"
                      />
                    ) : draftAttachment.kind === "audio" ? (
                      <div className="grid h-16 w-16 place-items-center rounded-xl bg-primary/10 text-primary">
                        <AudioLines className="size-6" />
                      </div>
                    ) : (
                      <div className="grid h-16 w-16 place-items-center rounded-xl bg-primary/10 text-primary">
                        <FileText className="size-6" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {draftAttachment.file.name || "Attachment"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          draftAttachment.kind,
                          formatFileSize(draftAttachment.fileSize),
                          draftAttachment.kind === "audio"
                            ? formatDurationMs(draftAttachment.durationMs)
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearDraftAttachment}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}

                {isRecordingAudio ? (
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-2 rounded-full bg-red-500" />
                      <div>
                        <p className="text-sm font-medium">Recording voice note...</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDurationMs(recordingDurationMs)}
                        </p>
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={() => void stopAudioRecording()}>
                      <Square className="mr-2 size-4" />
                      Stop
                    </Button>
                  </div>
                ) : null}

                {showComposerEmojis ? (
                  <div className="flex flex-wrap gap-2 pb-3">
                    {COMMUNITY_QUICK_EMOJIS.map((emoji) => (
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
                ) : null}

                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    if (nextFile) {
                      setDraftAttachmentFromFile(nextFile);
                    }
                    setAttachmentMenuOpen(false);
                    event.currentTarget.value = "";
                  }}
                />

                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    if (nextFile) {
                      setDraftAttachmentFromFile(nextFile);
                    }
                    setAttachmentMenuOpen(false);
                    event.currentTarget.value = "";
                  }}
                />

                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.rtf,.csv,.xls,.xlsx,.ppt,.pptx,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    if (nextFile) {
                      setDraftAttachmentFromFile(nextFile);
                    }
                    setAttachmentMenuOpen(false);
                    event.currentTarget.value = "";
                  }}
                />

                <div className="flex items-end gap-2 rounded-[1.65rem] border border-border/60 bg-card/80 p-2 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.72)]">
                  <DropdownMenu open={attachmentMenuOpen} onOpenChange={setAttachmentMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={sending || !room?.id}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="top"
                      align="start"
                      className="w-64 rounded-2xl border border-border/70 bg-card/95 p-2"
                    >
                      <DropdownMenuLabel>Add to community message</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => mediaInputRef.current?.click()}>
                        <ImagePlus className="size-4" />
                        Photos and videos
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => audioInputRef.current?.click()}>
                        <AudioLines className="size-4" />
                        Audio file
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
                        <FileText className="size-4" />
                        Document
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          isRecordingAudio
                            ? void stopAudioRecording()
                            : void startAudioRecording()
                        }
                      >
                        {isRecordingAudio ? (
                          <Square className="size-4" />
                        ) : (
                          <Mic className="size-4" />
                        )}
                        {isRecordingAudio ? "Stop voice note" : "Record voice note"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

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
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowComposerEmojis((current) => !current)}
                    disabled={sending || !room?.id}
                  >
                    <Smile className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 shrink-0 rounded-full"
                    onClick={() => void handleSend()}
                    disabled={sending || (!draftMessage.trim() && !draftAttachment)}
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
                  <CommunityAvatar
                    user={selectedProfile}
                    size={56}
                    className="size-14 border border-border/60"
                  />
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
