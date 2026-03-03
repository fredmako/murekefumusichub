import express from "express";
import { supabaseAdmin } from "../lib/supabaseServer.js";
import { verifySupabaseToken } from "../middleware/verifySupabaseToken.js";

const router = express.Router();

function normalizeText(value, max = 2000) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

// POST /api/support/issues
// Capture support issues raised by authenticated dashboard users.
router.post("/issues", verifySupabaseToken, async (req, res) => {
  try {
    const authUid = req.authUid;
    if (!authUid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const subject = normalizeText(req.body?.subject, 160);
    const message = normalizeText(req.body?.message, 4000);
    const context = normalizeText(req.body?.context, 120) || "dashboard";

    if (!message) {
      return res.status(400).json({ message: "Issue message is required" });
    }

    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("id, email, display_name")
      .eq("auth_uid", authUid)
      .maybeSingle();
    if (userErr) throw userErr;

    const payload = {
      type: "support_issue",
      status: "open",
      context,
      subject: subject || "Support Request",
      message,
      auth_uid: authUid,
      email: user?.email || req.auth?.email || null,
      display_name: user?.display_name || null,
      created_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from("audit_logs")
      .insert({
        user_id: user?.id || null,
        action: "support_issue_submitted",
        payload,
      })
      .select("id")
      .maybeSingle();
    if (insertErr) throw insertErr;

    return res.status(201).json({
      success: true,
      message: "Support issue submitted successfully",
      issueId: inserted?.id || null,
    });
  } catch (err) {
    console.error("[support-issues] Error:", err);
    return res.status(500).json({
      message: "Failed to submit support issue",
      error: err?.message || "UNKNOWN_ERROR",
    });
  }
});

export default router;
