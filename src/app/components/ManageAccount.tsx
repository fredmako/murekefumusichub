// src/app/components/ManageAccount.tsx
import { useAuth, AppUser } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
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
  Trash2,
  Edit2,
  Camera,
  Shield,
  LayoutDashboard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Music,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { storageService } from "@/services/api";

type RoleRequestState = "none" | "pending" | "approved" | "rejected";
export function ManageAccount() {
  const { appUser, signOut, getAuthToken, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  // local UI/action loading (separate from auth provider loading)
  const [loading, setLoading] = useState(false);
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

  // Form state
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Combined loading for initial render
  const initialLoading = authLoading && !user;

  // Keep manage-account accessible to all authenticated users.
  // Do not auto-redirect by role; users may need to manage profile or request other roles.
  useEffect(() => {
    if (!authLoading && !appUser) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, appUser, navigate]);

  // keep local `user` in sync with context `appUser`
  useEffect(() => {
    if (appUser) {
      setUser(appUser);
      setSupabaseId(appUser.id);
      setDisplayName(appUser.display_name || "");
      setAvatarUrl(appUser.avatar_url || null);
    } else {
      setUser(null);
      setSupabaseId(null);
      setDisplayName("");
      setAvatarUrl(null);
    }
  }, [appUser]);

  const fetchRoleRequestStatus = async (): Promise<{
    roles: string[];
    requests: { composer: RoleRequestState; admin: RoleRequestState };
  } | null> => {
    try {
      const token = await getAuthToken();
      const base =
        (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";
      const res = await fetch(`${base}/request-role/status`, {
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
    setAvatarFile(file);
    if (file) setAvatarUrl(URL.createObjectURL(file)); // local preview only
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
        try {
          const uploadedUrl = await storageService.uploadFile(
            "avatars",
            avatarFile,
            supabaseId,
          );
          finalAvatarUrl = uploadedUrl;
        } catch (uploadErr) {
          console.warn("[handleSaveProfile] avatar upload failed:", uploadErr);
          // keep previous avatar if upload fails
          finalAvatarUrl = user?.avatar_url || null;
        }
      }

      // 2) send update to backend
      try {
        const token = await getAuthToken();
        const base =
          (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";
        const res = await fetch(`${base}/account`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            auth_uid: appUser.auth_uid,
            email: appUser.email,
            displayName,
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
        const base =
          (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";
        const refetchRes = await fetch(`${base}/users/${supabaseId}`, {
          headers: { "Content-Type": "application/json" },
        });
        if (refetchRes.ok) {
          const freshData = await refetchRes.json();
          setUser({
            ...freshData,
            roles: freshData.roles || [],
          });
          setDisplayName(freshData.display_name || "");
          setAvatarUrl(freshData.avatar_url || null);
        } else {
          // fallback local state update
          setUser((u) =>
            u
              ? {
                  ...u,
                  display_name: displayName || null,
                  avatar_url: finalAvatarUrl || null,
                }
              : u,
          );
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
                avatar_url: finalAvatarUrl || null,
              }
            : u,
        );
        setAvatarUrl(finalAvatarUrl || null);
      }

      setAvatarFile(null);
      setIsEditing(false);
      toast.success("âœ… Profile updated successfully");
    } catch (err: any) {
      console.error("[handleSaveProfile] Error:", err);
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRole = async (roleType: "composer" | "admin") => {
    if (!supabaseId || !appUser) return;

    setRoleLoading(true);
    try {
      const token = await getAuthToken();
      const base =
        (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

      const res = await fetch(`${base}/request-role`, {
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
          toast.error(
            `â³ You already have a ${data.status} ${roleType} request`,
          );
          if (
            data?.status === "pending" ||
            data?.status === "approved" ||
            data?.status === "rejected"
          ) {
            setRequestStatus((prev) => ({ ...prev, [roleType]: data.status }));
          }
        } else {
          toast.error(data.message || `Failed to request ${roleType} access`);
        }
        setShowRoleModal(false);
        return;
      }

      toast.success(
        `âœ… ${roleType.charAt(0).toUpperCase() + roleType.slice(1)} request submitted! Awaiting admin approval.`,
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
    } catch (err: any) {
      console.error("[handleRequestRole] error:", err);
      toast.error(err?.message || `Failed to request ${roleType} access`);
    } finally {
      setRoleLoading(false);
    }
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
        const base =
          (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";
        let resp: Response | undefined;
        if (supabaseId) {
          resp = await fetch(`${base}/users/${supabaseId}?_ts=${Date.now()}`, {
            headers: { "Content-Type": "application/json" },
          });
        } else if (authUid) {
          resp = await fetch(
            `${base}/users/by-auth-uid/${authUid}?_ts=${Date.now()}`,
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
      const base =
        (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

      const res = await fetch(`${base}/account`, {
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  const userRoles = Array.isArray(user?.roles)
    ? [...new Set(user.roles)]
    : ([] as string[]);
  const isComposer = userRoles.includes("composer");
  const isAdmin = userRoles.includes("admin");

  const composerRequestStatus: RoleRequestState =
    isComposer ? "approved" : requestStatus.composer;
  const adminRequestStatus: RoleRequestState =
    isAdmin ? "approved" : requestStatus.admin;

  const dashboardOptions = [
    ...(userRoles.includes("buyer")
      ? [{ key: "buyer", label: "Buyer Dashboard", path: "/buyer" }]
      : []),
    ...(userRoles.includes("composer")
      ? [{ key: "composer", label: "Composer Dashboard", path: "/composer" }]
      : []),
    ...(userRoles.includes("admin")
      ? [{ key: "admin", label: "Admin Dashboard", path: "/admin" }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Account Settings
          </h1>
          <p className="text-gray-600">Manage your profile and preferences</p>
        </div>

        {/* Profile Card */}
        <Card className="overflow-hidden shadow-xl border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <CardTitle className="text-2xl flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                ðŸ‘¤
              </div>
              Profile Information
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8 pb-8">
            {!isEditing ? (
              <div className="space-y-8">
                <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative group">
                      <div className="w-40 h-40 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-3xl overflow-hidden flex items-center justify-center shadow-xl ring-4 ring-white">
                        {user?.avatar_url ? (
                          // display the URL that comes from server
                          <img
                            src={user.avatar_url}
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-6xl">ðŸ‘¤</div>
                        )}
                      </div>
                      <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 text-lg">
                        {user?.display_name || "User"}
                      </p>
                      <p className="text-sm text-gray-500">{user?.email}</p>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                        Display Name
                      </div>
                      <p className="text-lg font-medium text-gray-900 pl-3">
                        {user?.display_name || (
                          <span className="text-gray-400 italic">Not set</span>
                        )}
                      </p>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="w-1 h-4 bg-pink-500 rounded-full"></div>
                        Email Address
                      </div>
                      <p className="text-lg font-medium text-gray-900 pl-3">
                        {user?.email}
                      </p>
                    </div>

                    <div className="space-y-3 sm:col-span-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                        Current Roles
                      </div>
                      <div className="flex flex-wrap gap-2 pl-3">
                        {user?.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span
                              key={role}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-semibold shadow-md"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-medium">
                            <Shield className="w-4 h-4" />
                            Basic User
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <Button
                    onClick={() => {
                      setIsEditing(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full sm:w-auto px-8 shadow-lg"
                    size="lg"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative group cursor-pointer">
                    <div className="w-40 h-40 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-3xl overflow-hidden flex items-center justify-center shadow-xl ring-4 ring-purple-100 transition-all group-hover:ring-purple-300">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-6xl">ðŸ‘¤</div>
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-semibold">Change Photo</p>
                    </div>
                  </div>
                  <Label
                    htmlFor="avatar-input"
                    className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium shadow-md transition-all"
                  >
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                      title="Upload a new profile photo"
                    />
                    ðŸ“· Upload New Photo
                  </Label>
                  <Label
                    htmlFor="selfie-input"
                    className="cursor-pointer inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-md transition-all"
                  >
                    <input
                      id="selfie-input"
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handleSelfieChange}
                      className="hidden"
                      title="Take a selfie"
                    />
                    <Camera className="w-4 h-4" />
                    Take Selfie
                  </Label>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label
                      htmlFor="displayName"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Display Name
                    </Label>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g., John Musician"
                      className="h-12 text-base"
                    />
                  </div>
                </div>

                <div className="border-t pt-6 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg"
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
                      setAvatarUrl(user?.avatar_url || null);
                      setAvatarFile(null);
                    }}
                    variant="outline"
                    className="flex-1 sm:flex-none sm:px-8 border-2"
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Roles Card */}
        <Card className="shadow-xl border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <CardTitle className="text-2xl flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              Role Management
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6 pb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-6 border-2 rounded-xl transition-all hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Music className="w-6 h-6 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Composer Access
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Upload and publish music compositions
                    </p>
                    {composerRequestStatus === "approved" ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">Active</span>
                        </div>
                        <Button
                          onClick={() => navigate("/composer")}
                          className="ml-3 bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          Open Dashboard
                        </Button>
                      </div>
                    ) : composerRequestStatus === "pending" ? (
                      <Button
                        disabled
                        className="w-full bg-gray-200 text-gray-700 border-gray-200"
                        size="sm"
                      >
                        Pending Approval
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          onClick={() => setShowRoleModal("composer")}
                          className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 shadow-md"
                          size="sm"
                        >
                          Request Access
                        </Button>
                        {composerRequestStatus === "rejected" ? (
                          <p className="text-xs text-red-600">
                            Your previous request was rejected. You can request again.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-2 rounded-xl transition-all hover:shadow-md">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Admin Access
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Manage platform and users
                    </p>
                    {adminRequestStatus === "approved" ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-blue-700 font-medium">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">Active</span>
                        </div>
                        <Button
                          onClick={() => navigate("/admin")}
                          className="ml-3 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          Open Dashboard
                        </Button>
                      </div>
                    ) : adminRequestStatus === "pending" ? (
                      <Button
                        disabled
                        className="w-full bg-gray-200 text-gray-700 border-gray-200"
                        size="sm"
                      >
                        Pending Approval
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <Button
                          onClick={() => setShowRoleModal("admin")}
                          variant="outline"
                          className="w-full border-2 hover:bg-gray-50"
                          size="sm"
                        >
                          Request Access
                        </Button>
                        {adminRequestStatus === "rejected" ? (
                          <p className="text-xs text-red-600">
                            Your previous admin request was rejected. You can request again.
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
          <Card className="shadow-xl border-0 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
              <CardTitle className="text-xl flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                Switch Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              <div className="grid sm:grid-cols-3 gap-3">
                {dashboardOptions.map((item) => (
                  <Button
                    key={item.key}
                    variant="outline"
                    className="w-full border-2 hover:bg-gray-50"
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
        <Card className="shadow-xl border-2 border-red-200 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-red-600 to-rose-600 text-white">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
              Danger Zone
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-4 mb-4 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 mb-1">
                  Delete Account
                </p>
                <p className="text-sm text-red-700">
                  This action cannot be undone. All your data will be
                  permanently deleted.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              className="w-full sm:w-auto shadow-md"
              size="lg"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          </CardContent>
        </Card>
      </div>

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
              className="bg-purple-600 hover:bg-purple-700"
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
    </div>
  );
}

export default ManageAccount;
