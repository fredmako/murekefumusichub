import express from "express";
import { supabase as supabaseAdmin } from "../lib/supabaseClient.js";
import { verifyFirebaseToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * Upload file to Supabase Storage (uses admin/service role key to bypass RLS)
 * POST /api/upload/:bucket
 */
router.post("/:bucket", verifyFirebaseToken, async (req, res) => {
  try {
    const { bucket } = req.params;
    const firebaseUid = req.firebaseDecoded?.uid; // From auth middleware
    const file = req.file; // Requires multer middleware

    // Validate inputs
    if (
      !bucket ||
      !["avatars", "thumbnails", "compositions"].includes(bucket)
    ) {
      return res.status(400).json({ error: "Invalid bucket name" });
    }

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    if (!firebaseUid) {
      return res.status(401).json({ error: "Unauthorized: No Firebase UID" });
    }

    // Get Supabase user ID from Firebase UID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_uid", firebaseUid)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: "User not found in database" });
    }

    const userId = userData.id;

    // Create file path: userId/timestamp-filename
    const timestamp = Date.now();
    const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "-");
    const filePath = `${userId}/${timestamp}-${sanitizedFileName}`;

    // Upload using service role to bypass RLS
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error(`Upload error for bucket ${bucket}:`, uploadError);
      return res.status(500).json({
        error: `Failed to upload file: ${uploadError.message}`,
      });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl || "";

    console.log(`[uploads] File uploaded successfully:`, {
      bucket,
      filePath,
      publicUrl,
      urlData,
    });

    // Record upload in database
    try {
      await supabaseAdmin.from("file_uploads").insert({
        user_id: userId,
        file_name: file.originalname,
        file_path: filePath,
        file_type: file.mimetype,
        file_size: file.size,
        bucket,
        storage_url: publicUrl,
      });
    } catch (dbErr) {
      console.warn("Failed to record file upload in database:", dbErr);
      // Continue anyway - file is uploaded
    }

    return res.json({
      success: true,
      url: publicUrl,
      path: filePath,
    });
  } catch (err) {
    console.error("[uploads] Error:", err);
    return res.status(500).json({
      error: err.message || "Upload failed",
    });
  }
});

export default router;
