// src/app/components/ManageAccount.tsx
import { useAuth, AppUser } from "@/context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { DashboardShell } from "@/app/components/DashboardShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Trash2,
  Edit2,
  Camera,
  Shield,
  LayoutDashboard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Music,
  UserRound,
  Sun,
  Moon,
  Palette,
  Rows3,
  Scaling,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  registrationService,
  requestRoleService,
  storageService,
} from "@/services/api";
import { API_BASE_URL } from "@/lib/apiBase";
import {
  THEME_ICON_SCALES,
  THEME_LAYOUT_DENSITIES,
  THEME_PRESETS,
  THEME_SURFACE_STYLES,
  THEME_UI_SCALES,
  useTheme,
} from "@/context/ThemeContext";
import { getOptimizedProfileImageUrl } from "@/services/profileImageService";
import { buildLoginPath, persistPostLoginRedirect } from "@/lib/authRedirect";
import { formatKesAmount } from "@/lib/currency";

type RoleRequestState = "none" | "pending" | "approved" | "rejected";
type InviteAvailability = {
  available: boolean;
  requestedRole: "composer" | "admin";
  canAccept?: boolean;
  accepted?: boolean;
  invite?: {
    id: string;
    email: string;
    used: boolean;
    usedBy: string | null;
    usedAt: string | null;
    createdAt: string | null;
  };
} | null;
const MAX_AVATAR_SIZE_BYTES = 8 * 1024 * 1024;

export function ManageAccount() {
  const { appUser, signOut, getAuthToken, isLoading: authLoading } = useAuth();
  const {
    mode,
    setMode,
    theme,
    setTheme,
    uiScale,
    setUiScale,
    iconScale,
    setIconScale,
    layoutDensity,
    setLayoutDensity,
    surfaceStyle,
    setSurfaceStyle,
  } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // local UI/action loading (separate from auth provider loading)
  const [loading, setLoading] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [supabaseId, setSupabaseId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<
    false | "composer" | "admin"
  >(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<{
    composer: RoleRequestState;
    admin: RoleRequestState;
  }>({
    composer: "none",
    admin: "none",
  });
  const [composerRegulations, setComposerRegulations] = useState<{
    composerRequestFee: number;
    bankName: string;
    bankAccountNumber: string;
    accountName: string;
  } | null>(null);
  const [composerPaymentStatus, setComposerPaymentStatus] =
    useState<RoleRequestState>("none");
  const [composerPaymentRecord, setComposerPaymentRecord] = useState<
    any | null
  >(null);
  const [composerPaymentRef, setComposerPaymentRef] = useState("");
  const [composerPaymentSubmitting, setComposerPaymentSubmitting] =
    useState(false);
  const [composerInviteState, setComposerInviteState] =
    useState<InviteAvailability>(null);
  const [composerInviteLoading, setComposerInviteLoading] = useState(false);
  const [composerInviteAccepting, setComposerInviteAccepting] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [selfieDialogOpen, setSelfieDialogOpen] = useState(false);
  const [selfieCaptureLoading, setSelfieCaptureLoading] = useState(false);
  const [selfieError, setSelfieError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);

  // Combined loading for initial render
  const initialLoading = authLoading && !user;

  // Keep manage-account accessible to all authenticated users.
  // Do not auto-redirect by role; users may need to manage profile or request other roles.
  useEffect(() => {
    if (!authLoading && !appUser) {
      const currentPath = `${location.pathname}${location.search}${location.hash}`;
      persistPostLoginRedirect(currentPath);
      navigate(buildLoginPath({ nextPath: currentPath }), { replace: true });
    }
  }, [appUser, authLoading, location.hash, location.pathname, location.search, navigate]);

  // keep local `user` in sync with context `appUser`
  useEffect(() => {
    if (appUser) {
      setUser(appUser);
      setSupabaseId(appUser.id);
      setDisplayName(appUser.display_name || "");
      setPhone(appUser.phone || "");
      setAvatarUrl(appUser.avatar_url || null);
    } else {
      setUser(null);
      setSupabaseId(null);
      setDisplayName("");
      setPhone("");
      setAvatarUrl(null);
    }
  }, [appUser]);

  useEffect(() => {
    if (!appUser) {
      setComposerRegulations(null);
      setComposerPaymentStatus("none");
      setComposerPaymentRecord(null);
      setComposerInviteState(null);
      setComposerInviteLoading(false);
      setComposerInviteAccepting(false);
      return;
    }

    void Promise.all([fetchComposerPaymentState(), fetchComposerInviteState()]);
    const timer = setInterval(() => {
      void fetchComposerPaymentState();
      void fetchComposerInviteState();
    }, 15000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id]);

  const fetchRoleRequestStatus = async (): Promise<{
    roles: string[];
    requests: { composer: RoleRequestState; admin: RoleRequestState };
  } | null> => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/request-role/status`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        roles: Array.isArray(data?.roles) ? data.roles : [],
        requests: {
          composer:
            data?.requests?.composer === "pending" ||
            data?.requests?.composer === "approved" ||
            data?.requests?.composer === "rejected"
              ? data.requests.composer
              : "none",
          admin:
            data?.requests?.admin === "pending" ||
            data?.requests?.admin === "approved" ||
            data?.requests?.admin === "rejected"
              ? data.requests.admin
              : "none",
        },
      };
    } catch (err) {
      console.warn("[fetchRoleRequestStatus] error:", err);
      return null;
    }
  };

  const fetchComposerPaymentState = async () => {
    try {
      const [regulations, submissions] = await Promise.all([
        registrationService.getRegulations(),
        registrationService.getMyPayments("composer_request"),
      ]);

      setComposerRegulations({
        composerRequestFee: Number(regulations?.composerRequestFee || 0),
        bankName: regulations?.bankName || "I&M Bank",
        bankAccountNumber:
          regulations?.bankAccountNumber || "0030 7335 5161 50",
        accountName: regulations?.accountName || "Murekefu Music Hub",
      });

      const latest = Array.isArray(submissions) ? submissions[0] || null : null;
      setComposerPaymentRecord(latest);

      if (latest?.status === "pending") {
        setComposerPaymentStatus("pending");
      } else if (latest?.status === "approved" && !latest?.is_consumed) {
        setComposerPaymentStatus("approved");
      } else if (latest?.status === "rejected") {
        setComposerPaymentStatus("rejected");
      } else {
        setComposerPaymentStatus("none");
      }
    } catch (err) {
      console.warn("[fetchComposerPaymentState] error:", err);
      setComposerPaymentStatus("none");
    }
  };

  const fetchComposerInviteState = async () => {
    if (!appUser) {
      setComposerInviteState(null);
      return;
    }

    setComposerInviteLoading(true);
    try {
      const inviteState = await requestRoleService.getInviteStatus("composer");
      if (inviteState?.available) {
        setComposerInviteState(inviteState);
      } else {
        setComposerInviteState(null);
      }
    } catch (err) {
      console.warn("[fetchComposerInviteState] error:", err);
      setComposerInviteState(null);
    } finally {
      setComposerInviteLoading(false);
    }
  };

  const stopSelfieCamera = () => {
    if (selfieStreamRef.current) {
      selfieStreamRef.current.getTracks().forEach((track) => track.stop());
      selfieStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const currentThemeSettings = {
    preset: user?.theme_settings?.preset || theme || "emerald",
    mode:
      user?.theme_settings?.mode === "dark" || mode === "dark" ? "dark" : "light",
    uiScale: user?.theme_settings?.uiScale || uiScale,
    iconScale: user?.theme_settings?.iconScale || iconScale,
    layoutDensity: user?.theme_settings?.layoutDensity || layoutDensity,
    surfaceStyle: user?.theme_settings?.surfaceStyle || surfaceStyle,
  } as const;

  const formatSettingLabel = (value: string) =>
    value
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const applyThemeSettingsToContext = (nextSettings: typeof currentThemeSettings) => {
    setTheme(nextSettings.preset);
    setMode(nextSettings.mode);
    setUiScale(nextSettings.uiScale);
    setIconScale(nextSettings.iconScale);
    setLayoutDensity(nextSettings.layoutDensity);
    setSurfaceStyle(nextSettings.surfaceStyle);
  };

  const handleThemeSettingsUpdate = async (
    partial: Partial<typeof currentThemeSettings>,
    successMessage: string,
  ) => {
    if (!appUser) return;

    const previousSettings = { ...currentThemeSettings };
    const nextSettings = { ...currentThemeSettings, ...partial };

    applyThemeSettingsToContext(nextSettings);
    setThemeSaving(true);

    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/account`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          themeSettings: nextSettings,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to update appearance settings");
      }

      const updated = await res.json().catch(() => null);
      const savedThemeSettings =
        updated?.theme_settings && typeof updated.theme_settings === "object"
          ? updated.theme_settings
          : nextSettings;

      setUser((prev) =>
        prev
          ? {
              ...prev,
              theme_settings: savedThemeSettings,
            }
          : prev,
      );

      applyThemeSettingsToContext(savedThemeSettings as typeof currentThemeSettings);
      toast.success(successMessage);
    } catch (error: any) {
      applyThemeSettingsToContext(previousSettings);
      console.error("[handleThemeSettingsUpdate] error:", error);
      toast.error(error?.message || "Failed to update appearance settings");
    } finally {
      setThemeSaving(false);
    }
  };

  // Keep request status in sync with known role assignments immediately.
  useEffect(() => {
    if (!user) {
      setRequestStatus({ composer: "none", admin: "none" });
      return;
    }
    setRequestStatus((prev) => ({
      composer: user.roles?.includes("composer") ? "approved" : prev.composer,
      admin: user.roles?.includes("admin") ? "approved" : prev.admin,
    }));
  }, [user]);

  const applyAvatarFile = (file: File | null) => {
    if (!file) {
      setAvatarFile(null);
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      toast.error("Please select an image file for your profile photo.");
      return;
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error("Profile photo is too large. Please choose one under 8MB.");
      return;
    }

    setAvatarFile(file);
    setAvatarUrl(URL.createObjectURL(file)); // local preview only
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    applyAvatarFile(f);
    e.target.value = "";
  };

  const handleSelfieChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    applyAvatarFile(f);
    e.target.value = "";
  };

  const openSelfieCapture = async () => {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.isSecureContext
    ) {
      toast.info(
        "Direct camera capture is not available here, so we opened image selection instead.",
      );
      selfieInputRef.current?.click();
      return;
    }

    setSelfieError(null);
    setSelfieDialogOpen(true);
    setSelfieCaptureLoading(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
        },
      });
      selfieStreamRef.current = stream;

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => null);
        }
      });
    } catch (error: any) {
      console.warn("[openSelfieCapture] camera unavailable:", error);
      setSelfieDialogOpen(false);
      toast.info(
        "Camera access was unavailable, so we opened image selection instead.",
      );
      selfieInputRef.current?.click();
    } finally {
      setSelfieCaptureLoading(false);
    }
  };

  const captureSelfieFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      toast.error("Camera preview is not ready yet.");
      return;
    }

    const width = video.videoWidth || 960;
    const height = video.videoHeight || 1280;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Could not capture your selfie.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Could not capture your selfie.");
          return;
        }

        const capturedFile = new File([blob], `selfie-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        applyAvatarFile(capturedFile);
        stopSelfieCamera();
        setSelfieDialogOpen(false);
        toast.success("Selfie captured. Save changes when you're ready.");
      },
      "image/jpeg",
      0.92,
    );
  };

  useEffect(() => {
    if (!selfieDialogOpen) {
      stopSelfieCamera();
    }

    return () => {
      stopSelfieCamera();
    };
  }, [selfieDialogOpen]);

  const handleSaveProfile = async () => {
    if (!supabaseId || !appUser) {
      toast.error("User ID not found");
      return;
    }

    setLoading(true);
    try {
      let finalAvatarUrl = user?.avatar_url || null;

      // 1) upload avatar if new file selected
      if (avatarFile) {
        const uploadedUrl = await storageService.uploadFile(
          "avatars",
          avatarFile,
          supabaseId,
          { timeoutMs: 30000 },
        );
        finalAvatarUrl = uploadedUrl;
      }

      // 2) send update to backend
      try {
        const token = await getAuthToken();
        const res = await fetch(`${API_BASE_URL}/account`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            auth_uid: appUser.auth_uid,
            email: appUser.email,
            displayName,
            phone,
            avatarUrl: finalAvatarUrl,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("[handleSaveProfile] server responded error:", errData);
          throw new Error(errData?.message || "Server update failed");
        }
      } catch (srvErr) {
        console.error("[handleSaveProfile] server endpoint error:", srvErr);
        throw srvErr;
      }

      // 3) refetch user row from your API to get persisted values
      try {
        const refetchRes = await fetch(`${API_BASE_URL}/users/${supabaseId}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (refetchRes.ok) {
          const freshData = await refetchRes.json();
          setUser({
            ...freshData,
            roles: freshData.roles || [],
          });
          setDisplayName(freshData.display_name || "");
          setPhone(freshData.phone || "");
          setAvatarUrl(freshData.avatar_url || null);
        } else {
          // fallback local state update
          setUser((u) =>
            u
              ? {
                  ...u,
                  display_name: displayName || null,
                  phone: phone || null,
                  avatar_url: finalAvatarUrl || null,
                }
              : u,
          );
          setPhone(phone || "");
          setAvatarUrl(finalAvatarUrl || null);
        }
      } catch (refetchErr) {
        console.warn(
          "[handleSaveProfile] refetch failed, using local state:",
          refetchErr,
        );
        setUser((u) =>
          u
            ? {
                ...u,
                display_name: displayName || null,
                phone: phone || null,
                avatar_url: finalAvatarUrl || null,
              }
            : u,
        );
        setPhone(phone || "");
        setAvatarUrl(finalAvatarUrl || null);
      }

      setAvatarFile(null);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (err: any) {
      console.error("[handleSaveProfile] Error:", err);
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRole = async (roleType: "composer" | "admin") => {
    if (!supabaseId || !appUser) return;
    if (
      roleType === "composer" &&
      composerRegulations &&
      Number(composerRegulations.composerRequestFee || 0) > 0 &&
      composerPaymentStatus !== "approved"
    ) {
      toast.error(
        "Submit and get approval for the composer registration payment before requesting composer access.",
      );
      return;
    }

    setRoleLoading(true);
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/request-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          auth_uid: appUser.auth_uid,
          requestedRole: roleType,
          userId: supabaseId,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(`You already have a ${data.status} ${roleType} request`);
          if (
            data?.status === "pending" ||
            data?.status === "approved" ||
            data?.status === "rejected"
          ) {
            setRequestStatus((prev) => ({ ...prev, [roleType]: data.status }));
          }
        } else if (res.status === 402 && roleType === "composer") {
          toast.error(
            data?.message ||
              "Composer registration payment is required before requesting access.",
          );
          await fetchComposerPaymentState();
        } else {
          toast.error(data.message || `Failed to request ${roleType} access`);
        }
        setShowRoleModal(false);
        return;
      }

      toast.success(
        `${
          roleType.charAt(0).toUpperCase() + roleType.slice(1)
        } request submitted. Awaiting admin approval.`,
      );
      setShowRoleModal(false);

      setRequestStatus((prev) => ({ ...prev, [roleType]: "pending" }));

      const freshStatus = await fetchRoleRequestStatus();
      if (freshStatus) {
        setRequestStatus(freshStatus.requests);
        setUser((prev) =>
          prev
            ? {
                ...prev,
                roles: freshStatus.roles || prev.roles || [],
              }
            : prev,
        );
      }
      if (roleType === "composer") {
        await fetchComposerPaymentState();
      }
    } catch (err: any) {
      console.error("[handleRequestRole] error:", err);
      toast.error(err?.message || `Failed to request ${roleType} access`);
    } finally {
      setRoleLoading(false);
    }
  };

  const submitComposerPayment = async () => {
    const paymentRef = composerPaymentRef.trim();
    if (!paymentRef) {
      toast.error("Enter your payment reference code first.");
      return;
    }

    setComposerPaymentSubmitting(true);
    try {
      const result = await registrationService.submitPayment({
        registrationType: "composer_request",
        paymentRef,
      });
      toast.success(
        result?.message ||
          "Payment reference submitted. Wait for admin approval.",
      );
      setComposerPaymentRef("");
      await fetchComposerPaymentState();
    } catch (err: any) {
      if (err?.status === 409) {
        toast.info(
          err?.message ||
            "A registration payment is already pending/approved for composer access.",
        );
      } else {
        toast.error(err?.message || "Failed to submit composer payment");
      }
      await fetchComposerPaymentState();
    } finally {
      setComposerPaymentSubmitting(false);
    }
  };

  const handleAcceptComposerInvite = async () => {
    if (!appUser) return;

    setComposerInviteAccepting(true);
    try {
      const result = await requestRoleService.acceptInvite("composer");
      toast.success(result?.message || "Composer invite accepted.");

      if (result?.invite) {
        setComposerInviteState((prev) =>
          prev
            ? {
                ...prev,
                accepted: true,
                canAccept: false,
                invite: result.invite,
              }
            : prev,
        );
      }

      const freshStatus = await fetchRoleRequestStatus();
      if (freshStatus) {
        setRequestStatus(freshStatus.requests);
        setUser((prev) =>
          prev
            ? {
                ...prev,
                roles: freshStatus.roles || prev.roles || [],
              }
            : prev,
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to accept composer invite");
    } finally {
      setComposerInviteAccepting(false);
      await fetchComposerInviteState();
    }
  };

  const handleThemeModeChange = async (nextMode: "light" | "dark") => {
    if (currentThemeSettings.mode === nextMode) return;
    await handleThemeSettingsUpdate(
      { mode: nextMode },
      `${nextMode === "dark" ? "Dark" : "Light"} mode enabled`,
    );
  };

  // Poll for role changes and refresh user record periodically
  useEffect(() => {
    let timer: any;
    let mounted = true;

    async function checkRolesAndUser() {
      if (!appUser) return;
      const authUid = appUser.auth_uid;
      let serverRoles: string[] | null = null;

      try {
        const statusData = await fetchRoleRequestStatus();
        if (!mounted) return;
        if (statusData) {
          serverRoles = statusData.roles;
          setRequestStatus(statusData.requests);
        }
      } catch (e) {
        // ignore polling errors
      }

      // refresh user record from server
      try {
        let resp: Response | undefined;
        if (supabaseId) {
          resp = await fetch(
            `${API_BASE_URL}/users/${supabaseId}?_ts=${Date.now()}`,
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        } else if (authUid) {
          resp = await fetch(
            `${API_BASE_URL}/users/by-auth-uid/${authUid}?_ts=${Date.now()}`,
            {
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        if (resp && resp.ok) {
          const u = await resp.json();
          setUser((prev) => ({
            ...prev,
            ...u,
            roles: serverRoles || u.roles || prev?.roles || [],
          }));
        }
      } catch (e) {
        // ignore
      }
    }

    checkRolesAndUser();
    timer = setInterval(checkRolesAndUser, 10000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser, supabaseId]);

  const handleDeleteAccount = async () => {
    if (!appUser) return;

    try {
      setLoading(true);
      const token = await getAuthToken();
      const res = await fetch(`${API_BASE_URL}/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: appUser.id,
          auth_uid: appUser.auth_uid,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to delete account");
      }

      await signOut(false);
      toast.success("Account deleted successfully");
      navigate("/", { replace: true });
    } catch (error: any) {
      console.error("[handleDeleteAccount] error:", error);
      toast.error(error?.message || "Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="texture-linen flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const userRoles = Array.isArray(user?.roles)
    ? [...new Set(user.roles)]
    : ([] as string[]);
  const isComposer = userRoles.includes("composer");
  const isAdmin = userRoles.includes("admin");

  const composerRequestStatus: RoleRequestState = isComposer
    ? "approved"
    : requestStatus.composer;
  const adminRequestStatus: RoleRequestState = isAdmin
    ? "approved"
    : requestStatus.admin;
  const composerRegistrationFee = Number(
    composerRegulations?.composerRequestFee || 0,
  );
  const composerRequiresPayment = composerRegistrationFee > 0;
  const composerHasApprovedPayment =
    composerPaymentStatus === "approved" && !composerPaymentRecord?.is_consumed;
  const composerPaymentPending = composerPaymentStatus === "pending";
  const composerInviteAvailable = Boolean(composerInviteState?.available);
  const composerInviteCanAccept = Boolean(
    composerInviteState?.available && composerInviteState?.canAccept,
  );
  const composerInviteAccepted = Boolean(composerInviteState?.accepted);
  const composerCanRequestAccess =
    (!composerRequiresPayment || composerHasApprovedPayment) &&
    !composerInviteCanAccept;

  const dashboardOptions = [
    ...(userRoles.includes("buyer")
      ? [{ key: "buyer", label: "Buyer Dashboard", path: "/buyer" }]
      : []),
    ...(userRoles.includes("composer")
      ? [
          {
            key: "composer-arrangements",
            label: "My Arrangements",
            path: "/composer?tab=arrangements",
          },
          {
            key: "composer-compositions",
            label: "My Compositions",
            path: "/composer?tab=compositions",
          },
        ]
      : []),
    ...(userRoles.includes("admin")
      ? [{ key: "admin", label: "Admin Dashboard", path: "/admin" }]
      : []),
  ];

  const manageNavItems = [
    { id: "profile", label: "Profile", path: "#profile", icon: UserRound },
    { id: "appearance", label: "Appearance", path: "#appearance", icon: Sun },
    { id: "roles", label: "Roles", path: "#roles", icon: Shield },
    ...(dashboardOptions.length > 0
      ? [
          {
            id: "dashboards",
            label: "Dashboards",
            path: "#dashboards",
            icon: LayoutDashboard,
          },
        ]
      : []),
    { id: "danger", label: "Danger Zone", path: "#danger", icon: AlertCircle },
  ];

  return (
    <div className="texture-linen min-h-screen">
      <DashboardShell
        title="Account Settings"
        description="Manage your profile, roles, and dashboard access."
        navItems={manageNavItems}
      >
        {/* Profile Card */}
        <Card
          id="profile"
          className="lift-card texture-speckle scroll-mt-28 overflow-hidden border-border/70 bg-card/95"
        >
          <CardHeader className="border-b border-border/70 bg-card/80">
            <CardTitle className="flex items-center gap-3 text-xl text-foreground">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="h-4 w-4" />
              </div>
              Profile Information
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-5 pb-5">
            {!isEditing ? (
              <div className="space-y-5">
                <div className="grid items-start gap-5 md:grid-cols-[auto_1fr]">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="relative group">
                      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-[#0f766e] to-[#0b4a52] shadow-[0_18px_30px_-24px_rgba(15,23,42,0.9)] ring-2 ring-white/70">
                        {user?.avatar_url ? (
                          // display the URL that comes from server
                          <img
                            src={
                              getOptimizedProfileImageUrl(user.avatar_url, {
                                width: 320,
                                height: 320,
                                quality: 72,
                                resize: "cover",
                              }) || user.avatar_url
                            }
                            alt="avatar"
                            className="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <UserRound className="h-8 w-8 text-white/90" />
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 shadow-md">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-foreground">
                        {user?.display_name || "User"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Display Name
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {user?.display_name || (
                          <span className="italic text-muted-foreground">
                            Not set
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Email Address
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {user?.email}
                      </p>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Phone Number
                      </div>
                      <p className="text-sm font-medium text-foreground">
                        {user?.phone || (
                          <span className="italic text-muted-foreground">
                            Not set
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-3 sm:col-span-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Current Roles
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {userRoles.length > 0 ? (
                          userRoles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
                            <Shield className="w-4 h-4" />
                            Basic User
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/70 pt-6">
                  <Button
                    onClick={() => {
                      setIsEditing(true);
                    }}
                    className="w-full sm:w-auto"
                    size="sm"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative group cursor-pointer">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-[#0f766e] to-[#0b4a52] shadow-[0_18px_30px_-24px_rgba(15,23,42,0.9)] ring-2 ring-white/70 transition-all group-hover:ring-secondary">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserRound className="h-16 w-16 text-white/90" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-semibold">Change Photo</p>
                    </div>
                  </div>
                  <Label
                    htmlFor="avatar-input"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      title="Upload a new profile photo"
                    />
                    <Camera className="h-4 w-4" />
                    Upload New Photo
                  </Label>
                  <input
                    ref={selfieInputRef}
                    id="selfie-input"
                    type="file"
                    accept="image/*"
                    capture="user"
                    onChange={handleSelfieChange}
                    className="hidden"
                    title="Take a selfie"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void openSelfieCapture()}
                    className="inline-flex items-center gap-2"
                  >
                    <UserRound className="h-4 w-4" />
                    Take Selfie
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    We use the front camera when available, then fall back to your
                    image picker if the device does not allow direct capture.
                  </p>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label
                      htmlFor="displayName"
                      className="text-sm font-semibold text-foreground"
                    >
                      Display Name
                    </Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., John Musician"
                      className="h-11 bg-input-background"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label
                      htmlFor="phone"
                      className="text-sm font-semibold text-foreground"
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g., +254712345678"
                      className="h-11 bg-input-background"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/70 pt-6 sm:flex-row">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex-1"
                    size="lg"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-5 h-5 mr-2" />
                    )}
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setDisplayName(user?.display_name || "");
                      setPhone(user?.phone || "");
                      setAvatarUrl(user?.avatar_url || null);
                      setAvatarFile(null);
                    }}
                    variant="outline"
                    className="flex-1 sm:flex-none sm:px-6"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          id="appearance"
          className="lift-card texture-speckle scroll-mt-28 overflow-hidden border-border/70 bg-card/95"
        >
          <CardHeader className="border-b border-border/70 bg-card/80">
            <CardTitle className="flex items-center gap-3 text-xl text-foreground">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {currentThemeSettings.mode === "dark" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </div>
              Appearance
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-5 pb-5">
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                <p className="text-sm font-semibold text-foreground">
                  Personalize the whole system
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Switch between lighter and denser layouts, adjust icon size,
                  and choose a surface style that feels right for your device.
                  Every change is saved to your account automatically.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                    {formatSettingLabel(currentThemeSettings.preset)}
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                    {currentThemeSettings.mode === "dark" ? "Dark Mode" : "Light Mode"}
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                    {formatSettingLabel(currentThemeSettings.uiScale)} view
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                    {formatSettingLabel(currentThemeSettings.iconScale)} icons
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                    {formatSettingLabel(currentThemeSettings.layoutDensity)} layout
                  </span>
                  <span className="rounded-full border border-border/70 bg-card px-3 py-1">
                    {formatSettingLabel(currentThemeSettings.surfaceStyle)} surfaces
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Palette className="h-4 w-4 text-primary" />
                  Color Theme
                </div>
                <div className="flex flex-wrap gap-2">
                  {THEME_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      size="sm"
                      variant={
                        currentThemeSettings.preset === preset ? "default" : "outline"
                      }
                      onClick={() =>
                        void handleThemeSettingsUpdate(
                          { preset },
                          `${formatSettingLabel(preset)} theme applied`,
                        )
                      }
                      disabled={themeSaving}
                    >
                      {formatSettingLabel(preset)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {currentThemeSettings.mode === "dark" ? (
                    <Moon className="h-4 w-4 text-primary" />
                  ) : (
                    <Sun className="h-4 w-4 text-primary" />
                  )}
                  Mode
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={
                      currentThemeSettings.mode === "light" ? "default" : "outline"
                    }
                    onClick={() => void handleThemeModeChange("light")}
                    disabled={themeSaving}
                    className="w-full"
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    Light Mode
                  </Button>
                  <Button
                    type="button"
                    variant={
                      currentThemeSettings.mode === "dark" ? "default" : "outline"
                    }
                    onClick={() => void handleThemeModeChange("dark")}
                    disabled={themeSaving}
                    className="w-full"
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Dark Mode
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Scaling className="h-4 w-4 text-primary" />
                    View Size
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {THEME_UI_SCALES.map((size) => (
                      <Button
                        key={size}
                        type="button"
                        size="sm"
                        variant={
                          currentThemeSettings.uiScale === size ? "default" : "outline"
                        }
                        onClick={() =>
                          void handleThemeSettingsUpdate(
                            { uiScale: size },
                            `${formatSettingLabel(size)} view size enabled`,
                          )
                        }
                        disabled={themeSaving}
                      >
                        {formatSettingLabel(size)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <UserRound className="h-4 w-4 text-primary" />
                    Icon Size
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {THEME_ICON_SCALES.map((size) => (
                      <Button
                        key={size}
                        type="button"
                        size="sm"
                        variant={
                          currentThemeSettings.iconScale === size
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          void handleThemeSettingsUpdate(
                            { iconScale: size },
                            `${formatSettingLabel(size)} icons enabled`,
                          )
                        }
                        disabled={themeSaving}
                      >
                        {formatSettingLabel(size)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Rows3 className="h-4 w-4 text-primary" />
                    Layout Density
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {THEME_LAYOUT_DENSITIES.map((density) => (
                      <Button
                        key={density}
                        type="button"
                        size="sm"
                        variant={
                          currentThemeSettings.layoutDensity === density
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          void handleThemeSettingsUpdate(
                            { layoutDensity: density },
                            `${formatSettingLabel(density)} layout spacing applied`,
                          )
                        }
                        disabled={themeSaving}
                      >
                        {formatSettingLabel(density)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Surface Style
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {THEME_SURFACE_STYLES.map((style) => (
                      <Button
                        key={style}
                        type="button"
                        size="sm"
                        variant={
                          currentThemeSettings.surfaceStyle === style
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          void handleThemeSettingsUpdate(
                            { surfaceStyle: style },
                            `${formatSettingLabel(style)} surfaces enabled`,
                          )
                        }
                        disabled={themeSaving}
                      >
                        {formatSettingLabel(style)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {themeSaving ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving your appearance settings...
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Request Roles Card */}
        <Card
          id="roles"
          className="lift-card texture-speckle scroll-mt-28 overflow-hidden border-border/70 bg-card/95"
        >
          <CardHeader className="border-b border-border/70 bg-card/80">
            <CardTitle className="flex items-center gap-3 text-xl text-foreground">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="w-4 h-4" />
              </div>
              Role Management
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-5 pb-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Music className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="mb-1 font-semibold text-foreground">
                      Composer Access
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Upload and publish music compositions
                    </p>
                    {composerRequestStatus === "approved" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2 font-medium text-emerald-700">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">Active</span>
                        </div>
                        <Button
                          onClick={() => navigate("/composer?tab=arrangements")}
                          className="sm:ml-3"
                          size="sm"
                        >
                          My Arrangements
                        </Button>
                        <Button
                          onClick={() => navigate("/composer?tab=compositions")}
                          variant="outline"
                          size="sm"
                        >
                          My Compositions
                        </Button>
                      </div>
                    ) : composerRequestStatus === "pending" ? (
                      <Button
                        disabled
                        className="w-full border-border/80 bg-muted text-muted-foreground"
                        size="sm"
                      >
                        Pending Approval
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        {composerInviteAvailable ? (
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                              Composer Invite
                            </p>
                            <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-100">
                              {composerInviteAccepted
                                ? "Invite accepted. Composer access should now be active."
                                : "You have a composer invite linked to your account email."}
                            </p>
                            {composerInviteLoading ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Checking invite state...
                              </p>
                            ) : composerInviteCanAccept ? (
                              <Button
                                type="button"
                                className="mt-3 w-full"
                                size="sm"
                                onClick={() => void handleAcceptComposerInvite()}
                                disabled={composerInviteAccepting}
                              >
                                {composerInviteAccepting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Accepting...
                                  </>
                                ) : (
                                  "Accept Invite"
                                )}
                              </Button>
                            ) : (
                              <p className="mt-2 text-xs text-muted-foreground">
                                This invite is already in use.
                              </p>
                            )}
                          </div>
                        ) : null}

                        {!composerInviteAvailable && composerRequiresPayment && composerRegulations ? (
                          <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Registration Payment Required
                            </p>
                            <p className="mt-2 text-sm">
                              Fee:{" "}
                              <span className="font-semibold">
                                {formatKesAmount(composerRegistrationFee)}
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Bank: {composerRegulations.bankName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Account: {composerRegulations.bankAccountNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Account Name: {composerRegulations.accountName}
                            </p>
                            {composerHasApprovedPayment ? (
                              <p className="mt-2 text-xs font-medium text-emerald-700">
                                Payment approved. You can now request composer
                                access.
                              </p>
                            ) : composerPaymentPending ? (
                              <p className="mt-2 text-xs font-medium text-amber-700">
                                Payment pending admin approval. Ref:{" "}
                                {composerPaymentRecord?.payment_ref || "-"}
                              </p>
                            ) : (
                              <div className="mt-3 flex gap-2">
                                <Input
                                  value={composerPaymentRef}
                                  onChange={(e) =>
                                    setComposerPaymentRef(e.target.value)
                                  }
                                  placeholder="Payment reference code"
                                  disabled={composerPaymentSubmitting}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void submitComposerPayment()}
                                  disabled={composerPaymentSubmitting}
                                >
                                  {composerPaymentSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Submit"
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {!composerInviteAvailable ? (
                          <Button
                            onClick={() => setShowRoleModal("composer")}
                            className="w-full"
                            size="sm"
                            disabled={!composerCanRequestAccess}
                          >
                            {composerCanRequestAccess
                              ? "Request Access"
                              : composerPaymentPending
                                ? "Awaiting Payment Approval"
                                : "Payment Required"}
                          </Button>
                        ) : null}
                        {composerRequestStatus === "rejected" ? (
                          <p className="text-xs text-destructive">
                            Your previous request was rejected. You can request
                            again.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="mb-1 font-semibold text-foreground">
                      Admin Access
                    </h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Manage platform and users
                    </p>
                    {adminRequestStatus === "approved" ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 font-medium text-emerald-700">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">Active</span>
                        </div>
                        <Button
                          onClick={() => navigate("/admin")}
                          className="ml-3"
                          size="sm"
                        >
                          Open Dashboard
                        </Button>
                      </div>
                    ) : adminRequestStatus === "pending" ? (
                      <Button
                        disabled
                        className="w-full border-border/80 bg-muted text-muted-foreground"
                        size="sm"
                      >
                        Pending Approval
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          onClick={() => setShowRoleModal("admin")}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          Request Access
                        </Button>
                        {adminRequestStatus === "rejected" ? (
                          <p className="text-xs text-destructive">
                            Your previous admin request was rejected. You can
                            request again.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {dashboardOptions.length > 1 ? (
          <Card
            id="dashboards"
            className="lift-card texture-speckle scroll-mt-28 overflow-hidden border-border/70 bg-card/95"
          >
            <CardHeader className="border-b border-border/70 bg-card/80">
              <CardTitle className="flex items-center gap-3 text-lg text-foreground">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                Switch Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5 pb-5">
              <div className="grid sm:grid-cols-3 gap-3">
                {dashboardOptions.map((item) => (
                  <Button
                    key={item.key}
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(item.path)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Danger Zone */}
        <Card
          id="danger"
          className="lift-card scroll-mt-28 overflow-hidden border-destructive/35 bg-card/95"
        >
          <CardHeader className="border-b border-destructive/30 bg-destructive/5">
            <CardTitle className="flex items-center gap-3 text-xl text-destructive">
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              Danger Zone
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-5 pb-5">
            <div className="mb-4 flex items-start gap-4 rounded-lg border border-destructive/25 bg-destructive/5 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
              <div>
                <p className="mb-1 font-semibold text-destructive">
                  Delete Account
                </p>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone. All your data will be
                  permanently deleted.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              className="w-full sm:w-auto"
              size="lg"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          </CardContent>
        </Card>

      <Dialog
        open={selfieDialogOpen}
        onOpenChange={(open) => {
          setSelfieDialogOpen(open);
          if (!open) {
            setSelfieError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Take a selfie</DialogTitle>
            <DialogDescription>
              Use your front camera for a quick profile photo, or switch to your
              file picker if your device blocks direct camera capture.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-black/90">
              {selfieCaptureLoading ? (
                <div className="flex aspect-[3/4] items-center justify-center text-white/80">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="aspect-[3/4] w-full object-cover"
                />
              )}
            </div>

            {selfieError ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                {selfieError}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keep your face centered and tap <span className="font-semibold">Use Selfie</span>{" "}
                when the preview looks right.
              </p>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelfieDialogOpen(false);
                setSelfieError(null);
              }}
            >
              Cancel
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  stopSelfieCamera();
                  setSelfieDialogOpen(false);
                  selfieInputRef.current?.click();
                }}
              >
                Choose Photo Instead
              </Button>
              <Button
                type="button"
                onClick={captureSelfieFrame}
                disabled={selfieCaptureLoading}
              >
                <Camera className="mr-2 h-4 w-4" />
                Use Selfie
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Request Modal */}
      <AlertDialog
        open={showRoleModal !== false}
        onOpenChange={(open) => !open && setShowRoleModal(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Request {showRoleModal === "composer" ? "Composer" : "Admin"}{" "}
              Access
            </AlertDialogTitle>
            <AlertDialogDescription>
              {showRoleModal === "composer"
                ? "Request access to upload and publish music compositions."
                : "Request administrative access to manage the platform."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={roleLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showRoleModal && handleRequestRole(showRoleModal)}
              disabled={roleLoading}
              className="bg-primary hover:bg-primary/90"
            >
              {roleLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Confirm Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </DashboardShell>
    </div>
  );
}

export default ManageAccount;
