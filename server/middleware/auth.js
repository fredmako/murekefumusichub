import admin from "../lib/firebaseAdmin.js";
import { supabase } from "../lib/supabaseClient.js";

export async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.get("Authorization") || req.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const idToken = authHeader.split(" ")[1];
  if (!admin.apps.length) {
    console.warn("[verifyFirebaseToken] firebase-admin not initialized");
    // Opt-in development bypass: allow decoding the JWT payload without verification
    // when ALLOW_FIREBASE_VERIFY_BYPASS=true is set in the environment. This is
    // strictly for local development and DOES NOT VERIFY SIGNATURES. Do NOT
    // enable in production.
    if (process.env.ALLOW_FIREBASE_VERIFY_BYPASS === "true") {
      try {
        const parts = idToken.split(".");
        if (parts.length >= 2) {
          const payload = JSON.parse(
            Buffer.from(parts[1], "base64").toString("utf8"),
          );
          req.firebaseDecoded = payload;
          console.warn(
            "[verifyFirebaseToken] Using JWT payload bypass for local dev (UNVERIFIED)",
          );
          return next();
        }
      } catch (e) {
        console.warn(
          "[verifyFirebaseToken] Bypass decode failed:",
          e?.message || e,
        );
      }
    }

    return res
      .status(500)
      .json({ message: "Server not configured for token verification" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.firebaseDecoded = decoded;
    return next();
  } catch (err) {
    console.error(
      "[verifyFirebaseToken] token verify error:",
      err?.message || err,
    );
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export async function adminOnly(req, res, next) {
  try {
    const uid = req.firebaseDecoded?.uid;
    if (!uid) return res.status(401).json({ message: "Unauthorized" });

    const { data, error } = await supabase
      .from("users")
      .select("user_roles ( roles ( name ) )")
      .eq("firebase_uid", uid)
      .maybeSingle();

    if (error) {
      console.warn("[adminOnly] role lookup error:", error);
      return res.status(500).json({ message: "Failed to verify admin role" });
    }

    const roles = (data?.user_roles || [])
      .map((r) => r.roles?.name)
      .filter(Boolean);
    if (!roles.includes("admin")) {
      // Development override: when firebase-admin is not available or during local dev
      // allow requests from emails listed in ADMIN_IDENTIFIERS if the env flag is set.
      if (process.env.ALLOW_FIREBASE_VERIFY_BYPASS === "true") {
        try {
          const bypassList = (process.env.ADMIN_IDENTIFIERS || "")
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          const userEmail =
            req.firebaseDecoded && req.firebaseDecoded.email
              ? String(req.firebaseDecoded.email).toLowerCase()
              : null;
          if (userEmail && bypassList.includes(userEmail)) {
            console.warn(
              "[adminOnly] Using email-based bypass for admin access (dev only)",
            );
            return next();
          }
        } catch (e) {
          console.warn("[adminOnly] bypass check failed:", e?.message || e);
        }
      }
      return res.status(403).json({ message: "Admin access required" });
    }

    return next();
  } catch (err) {
    console.error("[adminOnly] Error:", err);
    return res.status(500).json({ message: "Failed to verify admin role" });
  }
}

export default { verifyFirebaseToken, adminOnly };
