// routes/roles.js
import express from "express";
import { supabaseAdmin } from "../lib/supabaseServer.js";
import { serverError } from "../utils/errors.js";
const router = express.Router();

// GET /api/user/roles/:authUid
router.get("/roles/:authUid", async (req, res) => {
  try {
    const { authUid } = req.params;
    if (!authUid)
      return res.status(400).json({ error: "Auth UID is required" });

    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, auth_uid, email")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!userData) return res.json([]);

    const roles = [];

    // user_roles join
    const { data: userRoleRows } = await supabaseAdmin
      .from("user_roles")
      .select("roles(name)")
      .eq("user_id", userData.id);

    if (userRoleRows && userRoleRows.length > 0) {
      userRoleRows.forEach((r) => {
        if (r.roles && r.roles.name) roles.push(r.roles.name);
      });
    }

    // check composers table
    const { data: composerData } = await supabaseAdmin
      .from("composers")
      .select("id")
      .eq("user_id", userData.id)
      .maybeSingle();

    if (composerData && !roles.includes("composer")) roles.push("composer");

    // check admin_emails table
    const { data: adminEmail } = await supabaseAdmin
      .from("admin_emails")
      .select("id")
      .eq("email", userData.email)
      .eq("is_active", true)
      .maybeSingle();

    if (adminEmail && !roles.includes("admin")) roles.push("admin");

    return res.json(roles);
  } catch (err) {
    return serverError(res, err);
  }
});

export default router;
