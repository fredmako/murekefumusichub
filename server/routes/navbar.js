import express from "express";
import { supabase } from "../lib/supabaseClient.js";

const router = express.Router();

// GET /api/user/roles/:firebaseUid
router.get("/roles/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    if (!firebaseUid)
      return res.status(400).json({ error: "Firebase UID is required" });

    // Get user by firebase UID
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, firebase_uid, email")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) return res.json([]);

    const roles = [];

    // Check if user is a composer
    const { data: composerData } = await supabase
      .from("composers")
      .select("id")
      .eq("user_id", userData.id)
      .maybeSingle();

    if (composerData) {
      roles.push("composer");
    }

    // Check if user is admin via email
    const bypassList = (process.env.ADMIN_IDENTIFIERS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (userData.email && bypassList.includes(userData.email.toLowerCase())) {
      roles.push("admin");
    }

    return res.json(roles);
  } catch (err) {
    console.error("[navbar-user-roles] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
