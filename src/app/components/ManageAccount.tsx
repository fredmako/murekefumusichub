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
import { Trash2, Edit2, Shield, CheckCircle, AlertCircle, Loader2, Music } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { storageService } from "@/services/api";

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
  const [showRoleModal, setShowRoleModal] = useState<false | "composer" | "admin">(false);
  const [roleLoading, setRoleLoading] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const uid = appUser?.uid || firebaseUser?.uid;

      if (!uid) {
        console.log('[ManageAccount] No user UID found');
        setLoading(false);
        return;
      }

      console.log('[ManageAccount] Fetching user data for UID:', uid);

      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, roles, display_name, phone, avatar_url, email, firebase_uid")
          .eq("firebase_uid", uid)
          .maybeSingle();

        if (error) {
          console.error('[ManageAccount] Fetch error:', error);
          throw error;
        }

        if (data) {
          console.log('[ManageAccount] User data fetched:', data);
          setSupabaseId(data.id);
          setUser({
            ...data,
            roles: data.roles || [],
          });
          setDisplayName(data.display_name || "");
          setPhone(data.phone || "");
          setAvatarUrl(data.avatar_url || null);
          console.log('[ManageAccount] Form state initialized:', {
            displayName: data.display_name,
            phone: data.phone,
            avatarUrl: data.avatar_url,
          });
        } else {
          console.log('[ManageAccount] No user found in database');
        }
      } catch (err) {
        console.error('[ManageAccount] Error fetching user:', err);
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
      console.log('[handleSaveProfile] Starting profile update for user:', supabaseId);
      console.log('[handleSaveProfile] Data:', { displayName, phone, avatarUrl });
      
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        try {
          console.log('[handleSaveProfile] Uploading avatar...');
          finalAvatarUrl = await storageService.uploadFile('avatars', avatarFile, supabaseId);
          console.log('[handleSaveProfile] Avatar uploaded:', finalAvatarUrl);
        } catch (uploadErr) {
          console.warn('Avatar upload failed (client)', uploadErr);
          // Continue without avatar
        }
      }

      // Try direct Supabase update first
      console.log('[handleSaveProfile] Attempting direct Supabase update...');
      const { error } = await supabase
        .from('users')
        .update({ 
          display_name: displayName || null, 
          phone: phone || null, 
          avatar_url: finalAvatarUrl || null 
        })
        .eq('id', supabaseId);

      if (error) {
        console.error('[handleSaveProfile] Supabase direct update failed:', error);
        
        // If RLS policy blocks direct update, use server endpoint
        if (error?.code === '42501' || error?.message?.toLowerCase().includes('row-level')) {
          console.log('[handleSaveProfile] RLS blocked direct update, using server endpoint...');
          
          try {
            const token = await firebaseUser?.getIdToken();
            const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
            const endpoint = `${base}/sync-user`;
            
            console.log('[handleSaveProfile] Calling server endpoint:', endpoint);
            console.log('[handleSaveProfile] Payload:', {
              firebaseUid: firebaseUser?.uid,
              email: firebaseUser?.email,
              displayName,
              phone,
              avatarUrl: finalAvatarUrl,
            });
            
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
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

            console.log('[handleSaveProfile] Server response status:', res.status);
            
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              console.error('[handleSaveProfile] Server error:', errData);
              throw new Error(errData?.message || 'Server sync failed');
            }
            
            const resultData = await res.json();
            console.log('[handleSaveProfile] Server response:', resultData);
          } catch (srvErr) {
            console.error('[handleSaveProfile] Server endpoint error:', srvErr);
            throw srvErr;
          }
        } else {
          throw error;
        }
      } else {
        console.log('[handleSaveProfile] Supabase update successful');
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

      toast.success('✅ Profile updated successfully');
      console.log('[handleSaveProfile] Profile update completed successfully');
    } catch (err: any) {
      console.error('[handleSaveProfile] Error:', err);
      toast.error(err?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRole = async (roleType: "composer" | "admin") => {
    if (!supabaseId || !firebaseUser) return;

    setRoleLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      
      console.log('[handleRequestRole] Sending request to:', `${base}/request-role`);
      console.log('[handleRequestRole] Payload:', { firebaseUid: firebaseUser.uid, requestedRole: roleType, userId: supabaseId });
      
      const res = await fetch(`${base}/request-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firebaseUid: firebaseUser.uid,
          requestedRole: roleType,
          userId: supabaseId,
        }),
      });

      console.log('[handleRequestRole] Response status:', res.status);

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error(`⏳ You already have a ${data.status} ${roleType} request`);
        } else {
          toast.error(data.message || `Failed to request ${roleType} access`);
        }
        setShowRoleModal(false);
        return;
      }

      toast.success(`✅ ${roleType.charAt(0).toUpperCase() + roleType.slice(1)} request submitted!\nAwaiting admin approval.`);
      setShowRoleModal(false);
    } catch (err: any) {
      console.error(`[handleRequestRole] Error requesting ${showRoleModal}:`, err);
      toast.error(err?.message || `Failed to request ${showRoleModal} access`);
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;

    try {
      setLoading(true);
      await firebaseUser.delete();
      await signOut();
      toast.success('Account deleted successfully');
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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Profile Card */}
        <Card className="overflow-hidden shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white pb-0">
            <div className="flex items-start justify-between pt-6 pb-6">
              <div>
                <CardTitle className="text-3xl">Manage Profile</CardTitle>
                <p className="text-blue-100 mt-2">Update your account details</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8">
            {/* Profile View */}
            {!isEditing ? (
              <div className="space-y-6">
                {/* Avatar and Basic Info */}
                <div className="flex gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl overflow-hidden flex items-center justify-center shadow-md">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-4xl">👤</div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm text-gray-500 font-semibold uppercase">Email</p>
                      <p className="text-lg font-medium text-gray-900">{user?.email}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 font-semibold uppercase">Display Name</p>
                      <p className="text-lg font-medium text-gray-900">{user?.display_name || "Not set"}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 font-semibold uppercase">Phone</p>
                      <p className="text-lg font-medium text-gray-900">{user?.phone || "Not set"}</p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-500 font-semibold uppercase">Current Roles</p>
                      <div className="flex gap-2 mt-2">
                        {user?.roles && user.roles.length > 0 ? (
                          user.roles.map((role) => (
                            <span key={role} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                              <CheckCircle className="w-4 h-4" />
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">User (basic)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <Button 
                    onClick={() => {
                      console.log('[ManageAccount] Edit button clicked, current displayName:', displayName);
                      setIsEditing(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 w-full"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </div>
              </div>
            ) : (
              /* Profile Edit Form */
              <div className="space-y-6">
                <div className="flex gap-6 items-start">
                  <div className="flex-shrink-0">
                    <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl overflow-hidden flex items-center justify-center shadow-md">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-4xl">👤</div>
                      )}
                    </div>
                    <Label htmlFor="avatar-input" className="block mt-4 text-sm text-center cursor-pointer text-purple-600 hover:text-purple-700">
                      <input
                        id="avatar-input"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      Change Photo
                    </Label>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <Label htmlFor="displayName">Display Name</Label>
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., John Musician"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g., +254 712 345 678"
                        className="mt-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-6 flex gap-3">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      console.log('[ManageAccount] Cancel button clicked, resetting form');
                      setIsEditing(false);
                      setDisplayName(user?.display_name || "");
                      setPhone(user?.phone || "");
                      setAvatarUrl(user?.avatar_url || null);
                      setAvatarFile(null);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Roles Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white pb-4">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Role Requests
            </CardTitle>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {isComposer && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-green-800 font-medium">You are approved as a Composer 🎵</p>
              </div>
            )}

            {!isComposer && (
              <Button
                onClick={() => setShowRoleModal("composer")}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
              >
                <Music className="w-4 h-4 mr-2" />
                Request Composer Access
              </Button>
            )}

            {isAdmin && (
              <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <p className="text-blue-800 font-medium">You are an Administrator 🛡️</p>
              </div>
            )}

            {!isAdmin && (
              <Button
                onClick={() => setShowRoleModal("admin")}
                variant="outline"
                className="w-full"
              >
                <Shield className="w-4 h-4 mr-2" />
                Request Admin Access
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="shadow-lg border-0 border-red-200">
          <CardHeader className="bg-gradient-to-r from-red-600 to-rose-600 text-white pb-4">
            <CardTitle className="text-xl">Danger Zone</CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">This action cannot be undone.</p>
            <Button
              onClick={() => setShowDeleteConfirm(true)}
              variant="destructive"
              className="w-full"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Role Request Modal */}
      <AlertDialog open={showRoleModal !== false} onOpenChange={(open) => !open && setShowRoleModal(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request {showRoleModal === "composer" ? "Composer" : "Admin"} Access</AlertDialogTitle>
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
              {roleLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
