import fs from "fs";
import admin from "firebase-admin";
import dotenv from "dotenv";

// Ensure environment variables are loaded when this module is imported
dotenv.config();

const FIREBASE_SA_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (FIREBASE_SA_PATH) {
  try {
    const saRaw = fs.readFileSync(FIREBASE_SA_PATH, "utf8");
    const sa = JSON.parse(saRaw);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log("[firebase-admin] initialized using service account");
  } catch (e) {
    console.warn("[firebase-admin] failed to initialize:", e?.message || e);
  }
} else {
  console.warn(
    "[firebase-admin] FIREBASE_SERVICE_ACCOUNT_PATH not set; token verification disabled",
  );
}

export default admin;
