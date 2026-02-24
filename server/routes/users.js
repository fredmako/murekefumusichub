import express from "express";
import { supabase } from "../lib/supabaseClient.js";
const supabaseAdmin = supabase;
import { verifyFirebaseToken } from "../middleware/auth.js";

const router = express.Router();

// Utility: Validate avatar URL - only accept valid Supabase URLs or null
function isValidAvatarUrl(url) {
  if (!url) return true; // null/undefined is valid (removes avatar)
  if (typeof url !== "string") return false;

  // Reject blob URLs (temporary client-side URLs)
  if (url.startsWith("blob:")) return false;

  // Accept Supabase storage URLs
  if (url.includes("supabase.co/storage/")) return true;

  // Reject anything else to prevent invalid URLs
  return false;
}

// GET /api/users/:id
router.get("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { data, error } = await supabase
      .from("users")
      .select(`id, firebase_uid, email, display_name, avatar_url, created_at`)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "User not found" });

    // Determine roles: check composers table + admin email list
    const roles = [];

    // Check if user has composer record
    const { data: composer } = await supabase
      .from("composers")
      .select("id")
      .eq("user_id", data.id)
      .maybeSingle();
    if (composer) roles.push("composer");

    // Check if user is admin (via email)
    const adminEmails = (process.env.ADMIN_IDENTIFIERS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase());
    if (adminEmails.includes(data.email?.toLowerCase())) roles.push("admin");

    return res.json({ ...data, roles });
  } catch (err) {
    console.error("[get-user] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch user", error: err.message });
  }
});

// GET /api/users/by-firebase/:firebaseUid
router.get("/users/by-firebase/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    if (!firebaseUid)
      return res.status(400).json({ message: "firebaseUid is required" });

    const { data, error } = await supabase
      .from("users")
      .select(`id, firebase_uid, email, display_name, avatar_url, created_at`)
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ message: "User not found" });

    // Determine roles: check composers table + admin email list
    const roles = [];

    // Check if user has composer record
    const { data: composer } = await supabase
      .from("composers")
      .select("id")
      .eq("user_id", data.id)
      .maybeSingle();
    if (composer) roles.push("composer");

    // Check if user is admin (via email)
    const adminEmails = (process.env.ADMIN_IDENTIFIERS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase());
    if (adminEmails.includes(data.email?.toLowerCase())) roles.push("admin");

    return res.json({ ...data, roles });
  } catch (err) {
    console.error("[get-user-by-firebase] Error:", err);
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

    // Validate avatar URL - only accept Supabase URLs or null
    if (avatar_url !== undefined) {
      if (!isValidAvatarUrl(avatar_url)) {
        console.warn("[update-user] Invalid avatar URL rejected:", avatar_url);
        return res.status(400).json({
          message:
            "Invalid avatar URL. Only Supabase storage URLs are accepted.",
        });
      }
    }

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
    console.log("[update-account] Incoming payload:", {
      displayName,
      phone,
      avatarUrl,
      email,
    });

    // Validate avatar URL - only accept Supabase URLs or null
    if (avatarUrl !== undefined) {
      if (!isValidAvatarUrl(avatarUrl)) {
        console.warn(
          "[update-account] Invalid avatar URL rejected:",
          avatarUrl,
        );
        return res.status(400).json({
          message:
            "Invalid avatar URL. Only Supabase storage URLs are accepted.",
        });
      }
    }

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
    const { data, error } = await supabaseAdmin
      .from("users")
      .update(payload)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw error;
    console.log(
      "[update-account] Updated user row returned from supabase:",
      data,
    );
    return res.json({ message: "Account updated", user: data });
  } catch (err) {
    console.error("[update-account] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update account", error: err.message });
  }
});

export default router;
