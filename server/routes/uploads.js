// routes/upload.js
import express from "express";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabaseServer.js";
import { verifySupabaseToken } from "../middleware/verifySupabaseToken.js";
import { serverError } from "../utils/errors.js";
import path from "path";
import crypto from "crypto";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// POST /api/upload/:bucket
// Protected: we expect caller to be authenticated (so we can name files under user id)
router.post(
  "/:bucket",
  verifySupabaseToken,
  upload.single("file"),
  async (req, res) => {
    try {
      const { bucket } = req.params;
      const authUid = req.authUid;
      console.log("[upload] incoming request", {
        bucket,
        authUid: authUid || null,
        hasFile: Boolean(req.file),
        filename: req.file?.originalname || null,
        mimetype: req.file?.mimetype || null,
        size: req.file?.size || 0,
      });

      if (!["avatars", "compositions", "thumbnails"].includes(bucket)) {
        return res.status(400).json({ message: "Invalid bucket" });
      }
      if (!req.file) return res.status(400).json({ message: "File required" });

      const ext = path.extname(req.file.originalname) || "";
      const filename = `${authUid}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;

      // upload using admin client (service role)
      const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filename, req.file.buffer, { upsert: false });

      if (error) throw error;

      // generate a signed URL (valid for e.g., 1 hour) — useful if bucket is private
      const { data: signedData, error: signedErr } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(filename, 3600);

      if (signedErr) {
        // fallback to public URL if createSignedUrl not allowed
        console.warn("[upload] createSignedUrl failed, falling back to public URL", {
          bucket,
          filename,
          error: signedErr?.message || signedErr,
        });
        const { data: pub } = supabaseAdmin.storage
          .from(bucket)
          .getPublicUrl(filename);
        console.log("[upload] success via public URL fallback", {
          bucket,
          filename,
          hasPublicUrl: Boolean(pub?.publicUrl),
        });
        return res.json({ success: true, url: pub.publicUrl });
      }

      console.log("[upload] success with signed URL", {
        bucket,
        filename,
        hasSignedUrl: Boolean(signedData?.signedUrl),
      });
      return res.json({ success: true, url: signedData?.signedUrl || null });
    } catch (err) {
      console.error("[upload] failed", err);
      return serverError(res, err);
    }
  },
);

export default router;
