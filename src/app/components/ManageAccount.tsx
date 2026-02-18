import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function ManageAccount() {
  const { firebaseUser, signOut, appUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [composerRequest, setComposerRequest] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [supabaseId, setSupabaseId] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const uid = appUser?.uid || firebaseUser?.uid;

      if (!uid) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("id, roles, composer_request")
        .eq("firebase_uid", uid)
        .maybeSingle();

      if (data) {
        setSupabaseId(data.id);
        setRoles(data.roles || []);
        setComposerRequest(data.composer_request);
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
