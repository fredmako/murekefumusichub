import express from "express";
import { supabase } from "../lib/supabaseClient.js";
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

// POST /api/register
router.post("/register", async (req, res) => {
  try {
    const { email, displayName, phone, avatarUrl } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ message: "email is required", error: "MISSING_EMAIL" });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email))
      return res
        .status(400)
        .json({ message: "email is not valid", error: "INVALID_EMAIL" });

    // Validate avatar URL - only accept Supabase URLs or null
    if (avatarUrl !== undefined) {
      if (!isValidAvatarUrl(avatarUrl)) {
        console.warn("[register] Invalid avatar URL rejected:", avatarUrl);
        return res.status(400).json({
          message:
            "Invalid avatar URL. Only Supabase storage URLs are accepted.",
          error: "INVALID_AVATAR_URL",
        });
      }
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingUser)
      return res.status(409).json({
        message: "User with this email already exists",
        error: "USER_EXISTS",
        id: existingUser.id,
      });

    const { data: newUser, error: createErr } = await supabase
      .from("users")
      .insert({
        email,
        display_name: displayName || null,
        phone: phone || null,
        avatar_url: avatarUrl || null,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createErr) throw createErr;

    // Check if email is in admin_emails table and auto-assign admin role
    let roles = [];
    try {
      const { data: adminEmail } = await supabase
        .from("admin_emails")
        .select("id")
        .eq("email", email)
        .eq("is_active", true)
        .maybeSingle();

      if (adminEmail) {
        console.log(
          "[register] Email found in admin_emails, assigning admin role:",
          email,
        );
        const { data: adminRole } = await supabase
          .from("roles")
          .select("id")
          .eq("name", "admin")
          .maybeSingle();

        if (adminRole?.id) {
          await supabase
            .from("user_roles")
            .insert({ user_id: newUser.id, role_id: adminRole.id });
          roles.push("admin");
        }
      }
    } catch (e) {
      console.warn("[register] admin email check failed:", e?.message || e);
    }

    return res.status(201).json({
      ...newUser,
      roles,
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("[register] Error:", error);
    return res.status(500).json({
      message: "Failed to register user",
      error: error?.message || "Internal server error",
    });
  }
});

// POST /api/sync-user
router.post("/sync-user", async (req, res) => {
  try {
    const { firebaseUid, email, displayName, phone, avatarUrl, role } =
      req.body;
    if (!firebaseUid)
      return res.status(400).json({
        message: "firebaseUid is required",
        error: "MISSING_FIREBASE_UID",
      });
    if (!email)
      return res
        .status(400)
        .json({ message: "email is required", error: "MISSING_EMAIL" });

    const { data: existingUser, error: findError } = await supabase
      .from("users")
      .select("id, firebase_uid, email")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (findError && findError.code !== "PGRST116") throw findError;

    let userId;
    let isNewUser = false;
    if (existingUser) {
      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          email,
          display_name: displayName || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", existingUser.id)
        .select()
        .single();
      if (updateError) throw updateError;
      userId = existingUser.id;
    } else {
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          firebase_uid: firebaseUid,
          email,
          display_name: displayName || null,
          avatar_url: avatarUrl || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (createError) throw createError;
      userId = newUser.id;
      isNewUser = true;

      // Check if email is in admin_emails table and auto-assign admin role
      try {
        const { data: adminEmail } = await supabase
          .from("admin_emails")
          .select("id")
          .eq("email", email)
          .eq("is_active", true)
          .maybeSingle();

        if (adminEmail) {
          console.log(
            "[sync-user] Email found in admin_emails, assigning admin role:",
            email,
          );
          const { data: adminRole } = await supabase
            .from("roles")
            .select("id")
            .eq("name", "admin")
            .maybeSingle();

          if (adminRole?.id) {
            await supabase
              .from("user_roles")
              .insert({ user_id: userId, role_id: adminRole.id });
          }
        }
      } catch (e) {
        console.warn("[sync-user] admin email check failed:", e?.message || e);
      }

      // Assign requested role if provided
      if (role) {
        try {
          const { data: roleRow } = await supabase
            .from("roles")
            .select("id")
            .eq("name", role)
            .maybeSingle();
          if (roleRow?.id)
            await supabase
              .from("user_roles")
              .insert({ user_id: userId, role_id: roleRow.id });
        } catch (e) {
          console.warn("[sync-user] role assignment failed:", e?.message || e);
        }
      }
    }

    const { data: userData } = await supabase
      .from("users")
      .select(`id, firebase_uid, email, display_name, avatar_url, created_at`)
      .eq("id", userId)
      .maybeSingle();

    // Determine roles: first check `admin_emails` table, then `composers` by user_id
    const roles = [];

    // Check if user is admin via admin_emails table in Supabase
    try {
      const { data: adminEmail } = await supabase
        .from("admin_emails")
        .select("id")
        .eq("email", userData.email)
        .eq("is_active", true)
        .maybeSingle();
      if (adminEmail) {
        roles.push("admin");
      } else {
        // Not an admin; check if user has composer record
        const { data: composer } = await supabase
          .from("composers")
          .select("id")
          .eq("user_id", userData.id)
          .maybeSingle();
        if (composer) roles.push("composer");
      }
    } catch (e) {
      console.warn("[sync-user] role detection failed:", e?.message || e);
    }

    return res.status(isNewUser ? 201 : 200).json({
      ...userData,
      roles,
      message: isNewUser
        ? "User created and synced successfully"
        : "User synced successfully",
    });
  } catch (error) {
    console.error("[sync-user] Error:", error);
    return res.status(500).json({
      message: "Failed to sync user",
      error: error?.message || "Internal server error",
    });
  }
});

// Alias: POST /sync-user
router.post("/sync-user-alias", async (req, res) => {
  // Keep legacy alias handling under a different path to avoid duplicate route collisions.
  // The original server used POST /sync-user (without /api). We'll expose it as /sync-user-alias
  // and the app should use /api/sync-user; this is to avoid double-binding in refactor.
  return res
    .status(410)
    .json({ message: "Legacy alias moved. Use /api/sync-user" });
});

// POST /api/request-role
router.post("/request-role", verifyFirebaseToken, async (req, res) => {
  try {
    const { requestedRole, userId } = req.body;
    const firebaseUid = req.firebaseDecoded?.uid || req.body.firebaseUid;
    if (!firebaseUid)
      return res.status(400).json({ message: "firebaseUid is required" });
    if (!["composer", "admin"].includes(requestedRole))
      return res
        .status(400)
        .json({ message: 'requestedRole must be "composer" or "admin"' });

    let uid = userId;
    if (!uid) {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("firebase_uid", firebaseUid)
        .maybeSingle();
      if (!user)
        return res
          .status(404)
          .json({ message: "User not found. Please sync your profile first." });
      uid = user.id;
    }

    const { data: existing } = await supabase
      .from("role_requests")
      .select("id, status")
      .eq("user_id", uid)
      .eq("requested_role", requestedRole)
      .in("status", ["pending", "approved"])
      .maybeSingle();
    if (existing)
      return res.status(409).json({
        message: `You already have a ${existing.status} ${requestedRole} request.`,
        requestId: existing.id,
        status: existing.status,
      });

    const { data: newRequest, error: createErr } = await supabase
      .from("role_requests")
      .insert({
        user_id: uid,
        requested_role: requestedRole,
        status: "pending",
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (createErr) throw createErr;

    // mark users.composer_request so other sessions can detect pending state
    if (requestedRole === "composer") {
      try {
        await supabase
          .from("users")
          .update({ composer_request: true })
          .eq("id", uid);
      } catch (e) {
        console.warn("[request-role] failed to set composer_request flag:", e?.message || e);
      }
    }

    return res.status(201).json({
      message: `${requestedRole} request submitted successfully. Awaiting admin approval.`,
      requestId: newRequest.id,
      status: newRequest.status,
    });
  } catch (error) {
    console.error("[request-role] Error:", error);
    return res.status(500).json({
      message: "Failed to submit request",
      error: error?.message || "Internal server error",
    });
  }
});

export default router;
