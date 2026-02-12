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
import { doc, deleteDoc } from "firebase/firestore";
import db from "../../lib/firebase";

export function ManageAccount() {
  const { firebaseUser, signOut } = useAuth();
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;

    const confirmDelete = window.confirm(
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
    );

    if (!confirmDelete) return;

    try {
      // 1️⃣ Delete Firestore user document
      await deleteDoc(doc(db, "users", firebaseUser.uid));

      // 2️⃣ Delete Firebase Auth account
      await firebaseUser.delete();

      // 3️⃣ Sign out locally
      await signOut();

      navigate("/");
    } catch (error: any) {
      console.error("Delete account error:", error);

      if (error.code === "auth/requires-recent-login") {
        alert(
          "For security reasons, please log in again before deleting your account.",
        );
      } else {
        alert("Failed to delete account. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Manage Account</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <p className="text-gray-600">
              Deleting your account will permanently remove:
            </p>
            <ul className="list-disc pl-6 mt-2 text-gray-600 space-y-1">
              <li>Your profile information</li>
              <li>Your authentication details</li>
              <li>Your saved data and purchases</li>
            </ul>
          </div>

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
