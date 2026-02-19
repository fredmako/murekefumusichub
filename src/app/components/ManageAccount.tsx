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
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { storageService } from "@/services/api";

export function ManageAccount() {
  const { firebaseUser, signOut, appUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [composerRequest, setComposerRequest] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [supabaseId, setSupabaseId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [displayName, setDisplayName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const uid = appUser?.uid || firebaseUser?.uid;

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("id, roles, composer_request, display_name, phone, avatar_url, email, created_at")
        .eq("firebase_uid", uid)
        .maybeSingle();

      if (data) {
        setSupabaseId(data.id);
        setRoles(data.roles || []);
        setComposerRequest(data.composer_request);
        setDisplayName(data.display_name || "");
        setPhone(data.phone || "");
        setAvatarUrl(data.avatar_url || null);
      }

      setLoading(false);
    };

    fetchUser();
  }, [appUser, firebaseUser]);

  const handleRequestComposer = async () => {
    if (!supabaseId) return;

    const { error } = await supabase
      .from("users")
      .update({ composer_request: true })
      .eq("id", supabaseId);

    if (!error) {
      setComposerRequest(true);
      setSuccess(
        "Composer request submitted successfully. Await admin approval.",
      );
    }
  };
  
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setAvatarFile(f);
    if (f) setAvatarUrl(URL.createObjectURL(f));
  };

  const handleSaveProfile = async () => {
    if (!supabaseId) return;
    setLoading(true);
    try {
      let finalAvatarUrl = avatarUrl;

      if (avatarFile) {
        try {
          // upload file to avatars bucket (client-side). May fail if storage policy denies.
          finalAvatarUrl = await storageService.uploadFile('avatars', avatarFile, supabaseId);
        } catch (uploadErr) {
          console.warn('Avatar upload failed (client); will try server sync as fallback', uploadErr);
        }
      }

      // Try client-side update first (preferred). If it fails due to RLS, fallback to server-side sync.
      const { error } = await supabase
        .from('users')
        .update({ display_name: displayName || null, phone: phone || null, avatar_url: finalAvatarUrl || null })
        .eq('id', supabaseId);

      if (error) {
        console.warn('Client update failed, attempting server-side sync:', error);

        // Detect row-level security / permission error and call server sync endpoint
        if (error?.code === '42501' || (error?.message && error.message.toLowerCase().includes('row-level'))) {
          try {
            const token = await firebaseUser?.getIdToken();
            const base = (import.meta as any).VITE_API_BASE_URL || 'http://localhost:3001';
            const res = await fetch(`${base}/api/sync-user`, {
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

            if (!res.ok) {
              const txt = await res.text().catch(() => '');
              throw new Error(`Server sync failed: ${res.status} ${txt}`);
            }
          } catch (srvErr) {
            throw srvErr;
          }
        } else {
          throw error;
        }
      }

      toast.success('Profile updated');
      // refresh state
      setAvatarFile(null);
      await new Promise((r) => setTimeout(r, 250));
      setSuccess('Profile saved successfully');
    } catch (err: any) {
      console.error('save profile error', err);
      toast.error(err?.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };
  const requestComposer = async () => {
    if (!supabaseId) return;

    // First check if request already exists
    const { data: existing } = await supabase
      .from("role_requests")
      .select("*")
      .eq("user_id", supabaseId)
      .eq("requested_role", "composer")
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (existing) {
      alert("You already have a pending or approved request.");
      return;
    }

    const { error } = await supabase.from("role_requests").insert([
      {
        user_id: supabaseId,
        requested_role: "composer",
      },
    ]);

    if (error) {
      alert("Failed to submit request.");
      return;
    }

    alert("Composer request submitted successfully!");
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete your account?",
    );

    if (!confirmDelete) return;

    try {
      await firebaseUser.delete();
      await signOut();
      navigate("/");
    } catch (error: any) {
      if (error.code === "auth/requires-recent-login") {
        alert("Please log in again before deleting your account.");
      }
    }
  };

  if (loading) return <div>Loading...</div>;

  const isComposer = roles.includes("composer");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Manage Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ================= ROLE STATUS ================= */}
          <div>
            <p className="font-medium">Current Roles:</p>
            <p className="text-gray-600">
              {roles.length > 0 ? roles.join(", ") : "User"}
            </p>
          </div>

          {/* ================= COMPOSER REQUEST ================= */}
          {!isComposer && (
            <div className="space-y-2">
              {composerRequest ? (
                <p className="text-yellow-600 font-medium">
                  Composer Request Pending Approval
                </p>
              ) : (
                <Button onClick={handleRequestComposer} className="w-full">
                  Request Composer Access
                </Button>
              )}

              {success && <p className="text-green-600 text-sm">{success}</p>}
            </div>
          )}

          {isComposer && (
            <p className="text-green-600 font-medium">
              You are approved as a Composer 🎵
            </p>
          )}

          {/* ================= PROFILE EDIT ================= */}
          <div className="space-y-4">
            <p className="font-medium">Profile</p>

            <div className="flex items-center gap-4">
              <div className="w-24 h-24 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-sm text-gray-500">No avatar</div>
                )}
              </div>

              <div className="flex-1">
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />

                <div className="mt-2">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>

                <div className="mt-2">
                  <Label>Avatar</Label>
                  <input type="file" accept="image/*" onChange={handleAvatarChange} />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={loading}>Save Profile</Button>
              <Button variant="ghost" onClick={() => { setDisplayName(''); setPhone(''); setAvatarFile(null); }}>Reset</Button>
            </div>
          </div>

          {/* ================= DELETE ACCOUNT ================= */}
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDeleteAccount}
          >
            <Trash2 className="size-4 mr-2" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
