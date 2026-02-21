import express from "express";
import { supabase } from "../lib/supabaseClient.js";

const router = express.Router();

// GET /api/user/roles/:firebaseUid
router.get("/roles/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    if (!firebaseUid)
      return res.status(400).json({ error: "Firebase UID is required" });
    const { data, error } = await supabase
      .from("users")
      .select(`id, firebase_uid, email, user_roles ( roles (name) )`)
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.json([]);
    const roleNames =
      data.user_roles?.map((r) => r.roles?.name).filter(Boolean) ?? [];
    return res.json(roleNames || []);
  } catch (err) {
    console.error("[navbar-user-roles] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
