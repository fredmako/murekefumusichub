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
    if (!roles.includes("admin"))
      return res.status(403).json({ message: "Admin access required" });

    return next();
  } catch (err) {
    console.error("[adminOnly] Error:", err);
    return res.status(500).json({ message: "Failed to verify admin role" });
  }
}

export default { verifyFirebaseToken, adminOnly };
