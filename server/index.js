import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import cors from "cors";

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Configure CORS
// Allow configuring allowed origin via environment variable `ALLOWED_ORIGIN`.
// If not set, default to the requested origin https://murekefumusichub.vercel.app
const DEFAULT_ALLOWED_ORIGIN = "https://murekefumusichub.vercel.app";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN;

// Add explicit headers (this sets Access-Control-Allow-Origin to the configured origin)
app.use((req, res, next) => {
  const requestOrigin = req.get("Origin") || ALLOWED_ORIGIN;
  res.header("Access-Control-Allow-Origin", requestOrigin);
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// Keep express CORS middleware but reflect the request origin when appropriate.
// Support an env var `ALLOWED_ORIGINS` (comma-separated) to restrict allowed origins.
const allowedList = (process.env.ALLOWED_ORIGINS || ALLOWED_ORIGIN)
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no origin)
      if (!origin) return callback(null, true);
      // If ALLOWED_ORIGINS contains '*', allow any origin
      if (allowedList.includes("*")) return callback(null, true);
      // Allow if origin is in the list
      if (allowedList.includes(origin)) return callback(null, true);
      // Otherwise block
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Simple OPTIONS handler for any route (helps with preflight replies)
app.options("*", (req, res) => res.sendStatus(204));

// Supabase config from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
  process.exit(1);
}

// Initialize Supabase client with service role key (has elevated privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);





/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

/**
 * User registration endpoint
 * POST /api/register
 *
 * Request body:
 * {
 *   email: string,
 *   displayName?: string,
 *   phone?: string,
 *   avatarUrl?: string
 * }
 * 
 * This endpoint adds user data to Supabase asynchronously during registration.
 */
app.post("/api/register", async (req, res) => {
  try {
    const { email, displayName, phone, avatarUrl } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        message: "email is required",
        error: "MISSING_EMAIL",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "email is not valid",
        error: "INVALID_EMAIL",
      });
    }

    console.log(`[register] Registering user: ${email}`);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingUser) {
      console.log(`[register] User already exists with email: ${email}`);
      return res.status(409).json({
        message: "User with this email already exists",
        error: "USER_EXISTS",
        id: existingUser.id,
      });
    }

    // Asynchronously create user in Supabase
    const userPromise = supabase
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

    // Return immediately and let it process in the background
    const { data: newUser, error: createErr } = await userPromise;

    if (createErr) {
      console.error(`[register] Create user error for ${email}:`, createErr);
      throw createErr;
    }

    console.log(`[register] Successfully registered user ${email} with id: ${newUser.id}`);

    return res.status(201).json({
      id: newUser.id,
      email,
      displayName: newUser.display_name,
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("[register] Error:", error);

    return res.status(500).json({
      message: "Failed to register user",
      error: error?.message || "Internal server error",
      code: error?.code || "UNKNOWN_ERROR",
    });
  }
});

/**
 * Sync user endpoint - Create or update user in Supabase
 * POST /api/sync-user
 *
 * Request body:
 * {
 *   firebaseUid: string,
 *   email: string,
 *   displayName?: string,
 *   phone?: string,
 *   avatarUrl?: string,
 *   role?: 'user' | 'composer' | 'admin'
 * }
 */
app.post("/api/sync-user", async (req, res) => {
  try {
    const { firebaseUid, email, displayName, phone, avatarUrl, role } = req.body;

    // Validate required fields
    if (!firebaseUid) {
      return res.status(400).json({
        message: "firebaseUid is required",
        error: "MISSING_FIREBASE_UID",
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "email is required",
        error: "MISSING_EMAIL",
      });
    }

    console.log(`[sync-user] Syncing user: ${email} (Firebase UID: ${firebaseUid})`);

    // Check if user already exists by Firebase UID
    const { data: existingUser, error: findError } = await supabase
      .from("users")
      .select("id, firebase_uid, email")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (findError && findError.code !== "PGRST116") {
      console.error(`[sync-user] Error finding user:`, findError);
      throw findError;
    }

    let userId;
    let isNewUser = false;

    if (existingUser) {
      // User exists, update their information
      console.log(`[sync-user] User exists with ID: ${existingUser.id}`);

      const { data: updatedUser, error: updateError } = await supabase
        .from("users")
        .update({
          email,
          display_name: displayName || null,
          phone: phone || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateError) {
        console.error(`[sync-user] Error updating user:`, updateError);
        throw updateError;
      }

      userId = existingUser.id;
      console.log(`[sync-user] User updated successfully: ${userId}`);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          firebase_uid: firebaseUid,
          email,
          display_name: displayName || null,
          phone: phone || null,
          avatar_url: avatarUrl || null,
          role: role || "user",
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error(`[sync-user] Error creating user:`, createError);
        throw createError;
      }

      userId = newUser.id;
      isNewUser = true;
      console.log(`[sync-user] New user created successfully: ${userId}`);
    }

    return res.status(isNewUser ? 201 : 200).json({
      id: userId,
      email,
      displayName,
      message: isNewUser ? "User created and synced successfully" : "User synced successfully",
    });
  } catch (error) {
    console.error("[sync-user] Error:", error);

    return res.status(500).json({
      message: "Failed to sync user",
      error: error?.message || "Internal server error",
      code: error?.code || "UNKNOWN_ERROR",
    });
  }
});

// Alias for backwards compatibility - POST /sync-user routes to /api/sync-user logic
app.post("/sync-user", async (req, res) => {
  try {
    const { firebaseUid, email, displayName, phone, avatarUrl, role } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({
        message: "firebaseUid and email are required",
        error: "MISSING_REQUIRED_FIELDS",
      });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    let userId;
    let isNewUser = false;

    if (existingUser) {
      const { data: updatedUser } = await supabase
        .from("users")
        .update({
          email,
          display_name: displayName || null,
          phone: phone || null,
          avatar_url: avatarUrl || null,
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      userId = existingUser.id;
    } else {
      const { data: newUser } = await supabase
        .from("users")
        .insert({
          firebase_uid: firebaseUid,
          email,
          display_name: displayName || null,
          phone: phone || null,
          avatar_url: avatarUrl || null,
          role: role || "user",
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      userId = newUser.id;
      isNewUser = true;
    }

    return res.status(isNewUser ? 201 : 200).json({
      id: userId,
      email,
      displayName,
      message: isNewUser ? "User created and synced successfully" : "User synced successfully",
    });
  } catch (error) {
    console.error("[sync-user] Alias error:", error);
    return res.status(500).json({
      message: "Failed to sync user",
      error: error?.message || "Internal server error",
    });
  }
});





// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: err.message || "Unknown error",
  });
});

/**
 * Request composer/admin role
 * POST /api/request-role
 *
 * Request body:
 * {
 *   firebaseUid: string,
 *   requestedRole: 'composer' | 'admin',
 *   userId?: string (supabase user id)
 * }
 */
app.post("/api/request-role", async (req, res) => {
  try {
    const { firebaseUid, requestedRole, userId } = req.body;

    console.log(`[request-role] 📥 Received request with body:`, { firebaseUid, requestedRole, userId });

    if (!firebaseUid) {
      console.log(`[request-role] ❌ Missing firebaseUid`);
      return res.status(400).json({ message: "firebaseUid is required" });
    }

    if (!["composer", "admin"].includes(requestedRole)) {
      console.log(`[request-role] ❌ Invalid requestedRole: ${requestedRole}`);
      return res
        .status(400)
        .json({ message: 'requestedRole must be "composer" or "admin"' });
    }

    console.log(
      `[request-role] 🎯 Role request from Firebase UID: ${firebaseUid} for role: ${requestedRole}`
    );

    // Find user if userId not provided
    let uid = userId;
    if (!uid) {
      const { data: user } = await supabase
        .from("users")
        .select("id")
        .eq("firebase_uid", firebaseUid)
        .maybeSingle();

      if (!user) {
        console.warn(
          `[request-role] ⚠️ User not found for Firebase UID: ${firebaseUid}`
        );
        return res
          .status(404)
          .json({ message: "User not found. Please sync your profile first." });
      }
      uid = user.id;
    }

    // Check for existing pending/approved request
    const { data: existing } = await supabase
      .from("role_requests")
      .select("id, status")
      .eq("user_id", uid)
      .eq("requested_role", requestedRole)
      .in("status", ["pending", "approved"])
      .maybeSingle();

    if (existing) {
      console.log(
        `[request-role] ℹ️ Existing ${requestedRole} request found with status: ${existing.status}`
      );
      return res.status(409).json({
        message: `You already have a ${existing.status} ${requestedRole} request.`,
        requestId: existing.id,
        status: existing.status,
      });
    }

    // Create role request
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

    if (createErr) {
      console.error(
        `[request-role] ❌ Error creating request: ${createErr.message}`
      );
      throw createErr;
    }

    console.log(
      `[request-role] ✅ Successfully created ${requestedRole} request for user ${uid}:`,
      newRequest
    );

    return res.status(201).json({
      message: `${requestedRole} request submitted successfully. Awaiting admin approval.`,
      requestId: newRequest.id,
      status: newRequest.status,
    });
  } catch (error) {
    console.error("[request-role] ❌ Error:", error);
    return res.status(500).json({
      message: "Failed to submit request",
      error: error?.message || "Internal server error",
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Auth server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Register user: POST http://localhost:${PORT}/api/register`);
  console.log(
    `📍 Request role: POST http://localhost:${PORT}/api/request-role`
  );
  console.log(`\nWaiting for requests...\n`);
});
