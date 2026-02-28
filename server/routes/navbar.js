import express from "express";
import { supabase } from "../lib/supabaseClient.js";

const router = express.Router();

// GET /api/user/roles/:authUid - Get user roles by Supabase auth UID
router.get("/roles/:authUid", async (req, res) => {
  try {
    const { authUid } = req.params;
    if (!authUid)
      return res.status(400).json({ error: "Auth UID is required" });

    // Get user by auth_uid (must be a valid UUID)
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, auth_uid, email")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) return res.json([]);

    const roles = [];

    // Check if user already has any roles assigned in user_roles
    try {
      const { data: userRoleRows } = await supabase
        .from("user_roles")
        .select(`roles(name)`) // join to roles table
        .eq("user_id", userData.id);
      if (userRoleRows && userRoleRows.length > 0) {
        userRoleRows.forEach((r) => {
          if (r.roles && r.roles.name) roles.push(r.roles.name);
        });
      }
    } catch (e) {
      console.warn(
        "[navbar-user-roles] failed to fetch user_roles:",
        e?.message || e,
      );
    }

    // Check if user is a composer (in case composers table is used separately from user_roles)
    try {
      const { data: composerData } = await supabase
        .from("composers")
        .select("id")
        .eq("user_id", userData.id)
        .maybeSingle();

      if (composerData && !roles.includes("composer")) {
        roles.push("composer");
      }
    } catch (e) {
      console.warn(
        "[navbar-user-roles] composer check failed:",
        e?.message || e,
      );
    }

    // Check if user is admin via admin_emails table (preferred) or fallback to bypass list for dev
    try {
      const { data: adminEmail } = await supabase
        .from("admin_emails")
        .select("id")
        .eq("email", userData.email)
        .eq("is_active", true)
        .maybeSingle();
      if (adminEmail && !roles.includes("admin")) {
        roles.push("admin");
      } else {
        // fallback to legacy bypass list (used in dev envs)
        const bypassList = (process.env.ADMIN_IDENTIFIERS || "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        if (
          userData.email &&
          bypassList.includes(userData.email.toLowerCase()) &&
          !roles.includes("admin")
        ) {
          roles.push("admin");
        }
      }
    } catch (e) {
      console.warn(
        "[navbar-user-roles] admin_emails check failed:",
        e?.message || e,
      );
    }

    return res.json(roles);
  } catch (err) {
    console.error("[navbar-user-roles] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
