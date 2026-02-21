import { useAuth } from "@/context/AuthContext";
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
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Music,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { storageService } from "@/services/api";
import { navbarService } from "@/services/navbarService";

interface User {
  id: string;
  firebase_uid: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  roles: string[];
  composer_request?: boolean;
}

export function ManageAccount() {
  const { firebaseUser, signOut, appUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [supabaseId, setSupabaseId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState<
    false | "composer" | "admin"
  >(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "none" | "pending" | "approved"
  >("none");

  // Form state
  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const uid = appUser?.uid || firebaseUser?.uid;

      if (!uid) {
        console.log("[ManageAccount] No user UID found");
        setLoading(false);
        return;
      }

      console.log("[ManageAccount] Fetching user data for UID:", uid);

      try {
        const base =
          (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

        // Prefer Supabase record if it exists. First try to fetch by firebase UID
        let id: string | null = null;
        try {
          const existingRes = await fetch(`${base}/users/by-firebase/${uid}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          });
          if (existingRes.ok) {
            const existingData = await existingRes.json();
            id = existingData?.id;
            // use the existing data directly
            console.log(
              "[ManageAccount] Found Supabase user by firebase uid:",
              existingData,
            );
            setSupabaseId(existingData.id);
            setUser({
              ...existingData,
              roles: existingData.roles || [],
            } as User);
            setDisplayName(existingData.display_name || "");
            setPhone(existingData.phone || "");
            setAvatarUrl(existingData.avatar_url || null);
            // initialize request status
            if (
              existingData.roles &&
              Array.isArray(existingData.roles) &&
              existingData.roles.includes("composer")
            ) {
              setRequestStatus("approved");
            } else if (existingData.composer_request) {
              setRequestStatus("pending");
            } else {
              setRequestStatus("none");
            }
          } else if (existingRes.status === 404) {
            // No Supabase user exists; fall back to syncing with Firebase/Google data
            console.log(
              "[ManageAccount] No Supabase user found; calling sync-user to create using Firebase data",
            );
            const syncRes = await fetch(`${base}/sync-user`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                firebaseUid: uid,
                email: firebaseUser?.email,
                displayName: firebaseUser?.displayName,
                phone: firebaseUser?.phoneNumber,
                avatarUrl: firebaseUser?.photoURL,
              }),
            });

            if (!syncRes.ok) {
              const err = await syncRes.json().catch(() => ({}));
              console.error("[ManageAccount] sync-user failed:", err);
              throw new Error(err?.message || "sync-user failed");
            }

            const syncData = await syncRes.json();
            id = syncData?.id;
            if (!id)
              throw new Error("Failed to obtain Supabase user id after sync");

            // use returned server data when available
            setSupabaseId(syncData.id);
            setUser({ ...syncData, roles: syncData.roles || [] } as User);
            setDisplayName(
              syncData.displayName || firebaseUser?.displayName || "",
            );
            setPhone(syncData.phone || firebaseUser?.phoneNumber || "");
            setAvatarUrl(syncData.avatarUrl || firebaseUser?.photoURL || null);
            if (
              syncData.roles &&
              Array.isArray(syncData.roles) &&
              syncData.roles.includes("composer")
            )
              setRequestStatus("approved");
          } else {
            const err = await existingRes.json().catch(() => ({}));
            console.error("[ManageAccount] Error checking Supabase user:", err);
            throw new Error(err?.message || "Failed to check Supabase user");
          }
        } catch (innerErr) {
          console.error(
            "[ManageAccount] Error resolving user from backend:",
            innerErr,
          );
          throw innerErr;
        }

        // If we obtained id from existing fetch but didn't populate user (shouldn't happen), fetch user by id
        let userRes;
        if (id && !user) {
          userRes = await fetch(`${base}/users/${id}`, {
            headers: { "Content-Type": "application/json" },
          });
        }
        if (userRes) {
          if (!userRes.ok) {
            const err = await userRes.json().catch(() => ({}));
            console.error("[ManageAccount] fetch user by id failed:", err);
            throw new Error(err?.message || "fetch user failed");
          }
          const data = await userRes.json();
          console.log("[ManageAccount] User data fetched from server:", data);
          setSupabaseId(data.id);
          setLoading(false);
          return;
          setUser({ ...data, roles: data.roles || [] } as User);
          setDisplayName(data.display_name || "");
          setPhone(data.phone || "");
          setAvatarUrl(data.avatar_url || null);
        }
        if (!userRes.ok) {
          const err = await userRes.json().catch(() => ({}));
          console.error("[ManageAccount] fetch user by id failed:", err);
          throw new Error(err?.message || "fetch user failed");
        }

        const data = await userRes.json();
        console.log("[ManageAccount] User data fetched from server:", data);
        setSupabaseId(data.id);
        setUser({
          ...data,
          roles: data.roles || [],
        } as User);
        setDisplayName(data.display_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || null);
        // Initialize request status from server response
        if (
          data.roles &&
          Array.isArray(data.roles) &&
          data.roles.includes("composer")
        ) {
          setRequestStatus("approved");
        } else if (data.composer_request) {
          setRequestStatus("pending");
        } else {
          setRequestStatus("none");
        }
        console.log("[ManageAccount] Form state initialized:", {
          displayName: data.display_name,
          phone: data.phone,
          avatarUrl: data.avatar_url,
        });
      } catch (err) {
        console.error("[ManageAccount] Error fetching user:", err);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [appUser, firebaseUser]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setAvatarFile(f);
    if (f) setAvatarUrl(URL.createObjectURL(f));
  };

  const handleSaveProfile = async () => {
    if (!supabaseId) {
      toast.error("User ID not found");
      return;
    }

    setLoading(true);
    try {
      console.log(
        "[handleSaveProfile] Starting profile update for user:",
        supabaseId,
      );
      console.log("[handleSaveProfile] Data:", {
        displayName,
        phone,
        avatarUrl,
      });

      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        try {
          console.log("[handleSaveProfile] Uploading avatar...");
          finalAvatarUrl = await storageService.uploadFile(
            "avatars",
            avatarFile,
            supabaseId,
          );
          console.log("[handleSaveProfile] Avatar uploaded:", finalAvatarUrl);
        } catch (uploadErr) {
          console.warn("Avatar upload failed (client)", uploadErr);
          // Continue without avatar
        }
      }
      // Send update to server endpoint
      try {
        const token = await firebaseUser?.getIdToken();
        const base =
          (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";
        const res = await fetch(`${base}/account`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            firebaseUid: firebaseUser?.uid,
            email: firebaseUser?.email,
            displayName,
            phone,
            avatarUrl: finalAvatarUrl,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.error("[handleSaveProfile] Server error:", errData);
          throw new Error(errData?.message || "Server update failed");
        }

        const resultData = await res.json();
        console.log("[handleSaveProfile] Server response:", resultData);
      } catch (srvErr) {
        console.error("[handleSaveProfile] Server endpoint error:", srvErr);
        throw srvErr;
      }

      setAvatarFile(null);
      setIsEditing(false);

      // Update local state
      if (user) {
        setUser({
          ...user,
          display_name: displayName || null,
          phone: phone || null,
          avatar_url: finalAvatarUrl || null,
        });
      }

      toast.success("✅ Profile updated successfully");
      console.log("[handleSaveProfile] Profile update completed successfully");
    } catch (err: any) {
      console.error("[handleSaveProfile] Error:", err);
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRole = async (roleType: "composer" | "admin") => {
    if (!supabaseId || !firebaseUser) return;

    setRoleLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const base =
        (import.meta as any).VITE_API_BASE_URL || "http://localhost:3001/api";

      console.log(
        "[handleRequestRole] Sending request to:",
        `${base}/request-role`,
      );
      console.log("[handleRequestRole] Payload:", {
        firebaseUid: firebaseUser.uid,
        requestedRole: roleType,
        userId: supabaseId,
      });

      const res = await fetch(`${base}/request-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          requestedRole: roleType,
          userId: supabaseId,
        }),
      });

      console.log("[handleRequestRole] Response status:", res.status);

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(
            `⏳ You already have a ${data.status} ${roleType} request`,
          );
        } else {
          toast.error(data.message || `Failed to request ${roleType} access`);
        }
        setShowRoleModal(false);
        return;
      }

      toast.success(
        `✅ ${roleType.charAt(0).toUpperCase() + roleType.slice(1)} request submitted!\nAwaiting admin approval.`,
      );
      setShowRoleModal(false);
      if (roleType === "composer") setRequestStatus("pending");
    } catch (err: any) {
      console.error(
        `[handleRequestRole] Error requesting ${showRoleModal}:`,
        err,
      );
      toast.error(err?.message || `Failed to request ${showRoleModal} access`);
    } finally {
      setRoleLoading(false);
    }
  };

  // Poll for role changes (detect when admin approves composer role)
  useEffect(() => {
    let timer: any;
    let mounted = true;
    async function checkRoles() {
      if (!firebaseUser) return;
      try {
        const roles = await navbarService.fetchUserRoles(firebaseUser.uid);
        if (!mounted) return;
        if (Array.isArray(roles) && roles.includes("composer")) {
          setRequestStatus("approved");
        }
      } catch (e) {
        // ignore polling errors
      }
    }

    // initial check and interval
    checkRoles();
    timer = setInterval(checkRoles, 10000);
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [firebaseUser]);

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;

    try {
      setLoading(true);
      await firebaseUser.delete();
      await signOut();
      toast.success("Account deleted successfully");
      navigate("/");
    } catch (error: any) {
      if (error.code === "auth/requires-recent-login") {
        toast.error("Please log in again before deleting your account.");
      } else {
        toast.error("Failed to delete account");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-600" />
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  const isComposer = user?.roles.includes("composer");
  const isAdmin = user?.roles.includes("admin");

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
                👤
              </div>
              Profile Information
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-8 pb-8">
            {/* Profile View */}
            {!isEditing ? (
              <div className="space-y-8">
                {/* Avatar and Basic Info Grid */}
                <div className="grid md:grid-cols-[auto_1fr] gap-8 items-start">
                  {/* Avatar Section */}
                  <div className="flex flex-col items-center space-y-3">
                    <div className="relative group">
                      <div className="w-40 h-40 bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 rounded-3xl overflow-hidden flex items-center justify-center shadow-xl ring-4 ring-white">
                        {user?.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-6xl">👤</div>
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

                  {/* Info Grid */}
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

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                        Phone
                      </div>
                      <p className="text-lg font-medium text-gray-900 pl-3">
                        {user?.phone || (
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

                {/* Edit Button */}
                <div className="border-t pt-6">
                  <Button
                    onClick={() => {
                      console.log(
                        "[ManageAccount] Edit button clicked, current displayName:",
                        displayName,
                      );
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
              /* Profile Edit Form */
              <div className="space-y-8">
                {/* Avatar Upload Section */}
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
                        <div className="text-6xl">👤</div>
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
                    />
                    📷 Upload New Photo
                  </Label>
                </div>

                {/* Form Fields */}
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

                  <div className="space-y-3">
                    <Label
                      htmlFor="phone"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g., +254 712 345 678"
                      className="h-12 text-base"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
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
                      console.log(
                        "[ManageAccount] Cancel button clicked, resetting form",
                      );
                      setIsEditing(false);
                      setDisplayName(user?.display_name || "");
                      setPhone(user?.phone || "");
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
              {/* Composer Role */}
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
                    {isComposer || requestStatus === "approved" ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-green-700 font-medium">
                          <CheckCircle className="w-5 h-5 flex-shrink-0" />
                          <span className="text-sm">Active</span>
                        </div>
                        {/* Show redirect button for newly approved users */}
                        {requestStatus === "approved" && !isComposer && (
                          <Button
                            onClick={() => {
                              // navigate to composer dashboard and clear status locally
                              window.location.href = "/composer";
                            }}
                            className="ml-3 bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            Go to Composer Dashboard
                          </Button>
                        )}
                      </div>
                    ) : requestStatus === "pending" ? (
                      <Button
                        disabled
                        className="w-full bg-gray-200 text-gray-700 border-gray-200"
                        size="sm"
                      >
                        Pending Approval
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setShowRoleModal("composer")}
                        className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 shadow-md"
                        size="sm"
                      >
                        Request Access
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Role */}
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
                    {isAdmin ? (
                      <div className="flex items-center gap-2 text-blue-700 font-medium">
                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">Active</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setShowRoleModal("admin")}
                        variant="outline"
                        className="w-full border-2 hover:bg-gray-50"
                        size="sm"
                      >
                        Request Access
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
