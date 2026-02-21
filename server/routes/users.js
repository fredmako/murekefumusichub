import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { verifyFirebaseToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/users/:id
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { data, error } = await supabase
      .from("users")
      .select(
        `id, firebase_uid, email, display_name, phone, avatar_url, is_active, created_at, user_roles ( roles ( name ) )`,
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "User not found" });
    const roles = (data.user_roles || [])
      .map((r) => r.roles?.name)
      .filter(Boolean);
    return res.json({ ...data, roles });
  } catch (err) {
    console.error("[get-user] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch user", error: err.message });
  }
});

// PUT /api/users/:id
router.put("/users/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, phone, avatar_url, email } = req.body;
    if (!id) return res.status(400).json({ message: "id is required" });
    const payload = {};
    if (display_name !== undefined) payload.display_name = display_name || null;
    if (phone !== undefined) payload.phone = phone || null;
    if (avatar_url !== undefined) payload.avatar_url = avatar_url || null;
    if (email !== undefined) payload.email = email || null;
    if (Object.keys(payload).length === 0)
      return res.status(400).json({ message: "No updatable fields provided" });
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ message: "User updated", user: data });
  } catch (err) {
    console.error("[update-user] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update user", error: err.message });
  }
});

// PUT /api/account - authenticated user's account update
router.put("/account", verifyFirebaseToken, async (req, res) => {
  try {
    const { displayName, phone, avatarUrl, email } = req.body;
    const firebaseUid = req.firebaseDecoded?.uid || req.body.firebaseUid;
    if (!firebaseUid)
      return res.status(400).json({ message: "firebaseUid is required" });
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (!user) return res.status(404).json({ message: "User not found" });
    const payload = {
      ...(displayName !== undefined
        ? { display_name: displayName || null }
        : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
    };
    if (Object.keys(payload).length === 0)
      return res.status(400).json({ message: "No updatable fields provided" });
    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ message: "Account updated", user: data });
  } catch (err) {
    console.error("[update-account] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update account", error: err.message });
  }
});

export default router;
