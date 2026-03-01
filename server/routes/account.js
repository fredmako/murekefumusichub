// routes/account.js
import express from "express";
import { supabaseAdmin } from "../lib/supabaseServer.js";
import { verifySupabaseToken } from "../middleware/verifySupabaseToken.js";
import { serverError } from "../utils/errors.js";

const router = express.Router();

/**
 * PUT /api/account
 * Update current user's profile (display_name, avatar_url).
 * Protected: requires Authorization Bearer token
 */
router.put("/", verifySupabaseToken, async (req, res) => {
  try {
    const authUid = req.authUid;
    if (!authUid) return res.status(401).json({ message: "No auth uid" });

    const { displayName, avatarUrl } = req.body;

    // Find DB user by auth_uid
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, auth_uid")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (userError) throw userError;
    if (!userRow)
      return res.status(404).json({ message: "User row not found" });

    const updates = {
      display_name: displayName ?? undefined,
      avatar_url: avatarUrl ?? undefined,
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", userRow.id)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;
    return res.json(updated);
  } catch (err) {
    return serverError(res, err);
  }
});

/**
 * DELETE /api/account
 * Delete current user (both auth and DB records). Protected; only acts on current session user.
 */
router.delete("/", verifySupabaseToken, async (req, res) => {
  try {
    const authUid = req.authUid;
    if (!authUid) return res.status(401).json({ message: "No auth uid" });

    // find user row
    const { data: userRow, error } = await supabaseAdmin
      .from("users")
      .select("id, auth_uid")
      .eq("auth_uid", authUid)
      .maybeSingle();

    if (error) throw error;
    if (!userRow) return res.status(404).json({ message: "User not found" });

    // delete user-related rows first (cascade depending on your schema)
    // e.g., delete composers, user_roles, purchases, etc. Adjust to your schema.
    await supabaseAdmin.from("composers").delete().eq("user_id", userRow.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userRow.id);
    // ... other cleanup as needed

    // delete the DB user row
    await supabaseAdmin.from("users").delete().eq("id", userRow.id);

    // delete the auth user using admin API
    // supabaseAdmin.auth.admin.deleteUser is available in supabase-js v2+
    if (typeof supabaseAdmin.auth.admin?.deleteUser === "function") {
      await supabaseAdmin.auth.admin.deleteUser(userRow.auth_uid);
    } else {
      console.warn(
        "supabaseAdmin.auth.admin.deleteUser not available in this sdk version",
      );
    }

    return res.json({ success: true });
  } catch (err) {
    return serverError(res, err);
  }
});

export default router;
