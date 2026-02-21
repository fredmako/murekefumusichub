import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { supabase } from "./lib/supabaseClient.js";
import admin from "./lib/firebaseAdmin.js";
import { verifyFirebaseToken, adminOnly } from "./middleware/auth.js";
import compositionsRouter from "./routes/compositions.js";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import usersRouter from "./routes/users.js";
import navbarRouter from "./routes/navbar.js";
import purchasesRouter from "./routes/purchases.js";
import categoriesRouter from "./routes/categories.js";

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
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
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
  }),
);

// Simple OPTIONS handler for any route (helps with preflight replies)
app.options("*", (req, res) => res.sendStatus(204));

// Mount routers
app.use("/api", authRouter);
app.use("/api", usersRouter);
app.use("/api/admin", adminRouter);
app.use("/api/user", navbarRouter);
app.use("/api/compositions", compositionsRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/categories", categoriesRouter);

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// Export server start/stop helpers for tests
let _serverInstance = null;
export function startServer(port = PORT) {
  if (_serverInstance) return _serverInstance;
  _serverInstance = app.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
  });
  return _serverInstance;
}

export function stopServer() {
  if (_serverInstance) {
    _serverInstance.close();
    _serverInstance = null;
  }
}

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
    const { firebaseUid, email, displayName, phone, avatarUrl, role } =
      req.body;

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

    console.log(
      `[sync-user] Syncing user: ${email} (Firebase UID: ${firebaseUid})`,
    );

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

      // Assign role via user_roles mapping (schema uses roles + user_roles)
      if (role) {
        try {
          const { data: roleRow, error: roleErr } = await supabase
            .from("roles")
            .select("id")
            .eq("name", role)
            .maybeSingle();

          if (roleErr) {
            console.warn("[sync-user] role lookup error:", roleErr);
          }

          if (roleRow?.id) {
            const { error: urErr } = await supabase.from("user_roles").insert({
              user_id: userId,
              role_id: roleRow.id,
            });

            if (urErr)
              console.warn("[sync-user] user_roles insert warning:", urErr);
          }
        } catch (e) {
          console.warn("[sync-user] role assignment failed:", e?.message || e);
        }
      }
    }

    // Fetch user's assigned roles to return to caller
    const { data: userWithRoles } = await supabase
      .from("users")
      .select("user_roles ( roles ( name ) )")
      .eq("id", userId)
      .maybeSingle();

    const roles = (userWithRoles?.user_roles || [])
      .map((ur) => ur.roles?.name)
      .filter(Boolean);

    return res.status(isNewUser ? 201 : 200).json({
      id: userId,
      email,
      displayName,
      roles,
      message: isNewUser
        ? "User created and synced successfully"
        : "User synced successfully",
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
    const { firebaseUid, email, displayName, phone, avatarUrl, role } =
      req.body;

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
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      userId = newUser.id;
      isNewUser = true;

      // Assign role for alias endpoint as well
      if (role) {
        try {
          const { data: roleRow, error: roleErr } = await supabase
            .from("roles")
            .select("id")
            .eq("name", role)
            .maybeSingle();

          if (roleErr) {
            console.warn("[sync-user-alias] role lookup error:", roleErr);
          }

          if (roleRow?.id) {
            const { error: urErr } = await supabase.from("user_roles").insert({
              user_id: userId,
              role_id: roleRow.id,
            });

            if (urErr)
              console.warn(
                "[sync-user-alias] user_roles insert warning:",
                urErr,
              );
          }
        } catch (e) {
          console.warn(
            "[sync-user-alias] role assignment failed:",
            e?.message || e,
          );
        }
      }
    }

    // For alias endpoint, also return roles
    const { data: aliasUserWithRoles } = await supabase
      .from("users")
      .select("user_roles ( roles ( name ) )")
      .eq("id", userId)
      .maybeSingle();

    const aliasRoles = (aliasUserWithRoles?.user_roles || [])
      .map((ur) => ur.roles?.name)
      .filter(Boolean);

    return res.status(isNewUser ? 201 : 200).json({
      id: userId,
      email,
      displayName,
      roles: aliasRoles,
      message: isNewUser
        ? "User created and synced successfully"
        : "User synced successfully",
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
app.post("/api/request-role", verifyFirebaseToken, async (req, res) => {
  try {
    const { requestedRole, userId } = req.body;
    const firebaseUid = req.firebaseDecoded?.uid || req.body.firebaseUid;

    console.log(`[request-role] 📥 Received request with body:`, {
      firebaseUid,
      requestedRole,
      userId,
    });

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
      `[request-role] 🎯 Role request from Firebase UID: ${firebaseUid} for role: ${requestedRole}`,
    );

    // Find user if userId not provided
    let uid = userId;
    try {
      if (!uid) {
        const { data: user, error: findErr } = await supabase
          .from("users")
          .select("id")
          .eq("firebase_uid", firebaseUid)
          .maybeSingle();

        if (findErr) {
          console.error("[request-role] Supabase find user error:", findErr);
          throw findErr;
        }

        if (!user) {
          console.warn(
            `[request-role] ⚠️ User not found for Firebase UID: ${firebaseUid}`,
          );
          return res.status(404).json({
            message: "User not found. Please sync your profile first.",
          });
        }
        uid = user.id;
      }
    } catch (e) {
      console.error("[request-role] Error while resolving user id:", e);
      const payload = {
        message: "Failed to resolve user id",
        error: e?.message || String(e),
      };
      if (process.env.ALLOW_FIREBASE_VERIFY_BYPASS === "true")
        payload.stack = e?.stack;
      return res.status(500).json(payload);
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
        `[request-role] ℹ️ Existing ${requestedRole} request found with status: ${existing.status}`,
      );
      return res.status(409).json({
        message: `You already have a ${existing.status} ${requestedRole} request.`,
        requestId: existing.id,
        status: existing.status,
      });
    }

    // Create role request
    try {
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
        console.error(`[request-role] ❌ Error creating request:`, createErr);
        throw createErr;
      }

      console.log(
        `[request-role] ✅ Successfully created ${requestedRole} request for user ${uid}:`,
        newRequest,
      );

      return res.status(201).json({
        message: `${requestedRole} request submitted successfully. Awaiting admin approval.`,
        requestId: newRequest.id,
        status: newRequest.status,
      });
    } catch (e) {
      console.error("[request-role] Error inserting role_request:", e);
      const payload = {
        message: "Failed to create role request",
        error: e?.message || String(e),
      };
      if (process.env.ALLOW_FIREBASE_VERIFY_BYPASS === "true")
        payload.stack = e?.stack;
      return res.status(500).json(payload);
    }
  } catch (error) {
    console.error("[request-role] ❌ Error:", error);
    return res.status(500).json({
      message: "Failed to submit request",
      error: error?.message || "Internal server error",
    });
  }
});

/**
 * ===================== ADMIN ROUTES =====================
 */

// Protect all admin routes: require valid Firebase token and admin role
app.use("/api/admin", verifyFirebaseToken, adminOnly);

/**
 * GET /api/admin/roles - Fetch all roles
 */
app.get("/api/admin/roles", async (req, res) => {
  try {
    const { data, error } = await supabase.from("roles").select("*");
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-roles] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/users - Fetch all users with their roles
 */
app.get("/api/admin/users", async (req, res) => {
  try {
    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (usersErr) throw usersErr;

    const { data: userRoles, error: userRolesErr } = await supabase
      .from("user_roles")
      .select("*");

    if (userRolesErr) console.warn("user_roles fetch warning:", userRolesErr);

    return res.json({
      users: users || [],
      userRoles: userRoles || [],
    });
  } catch (err) {
    console.error("[admin-users] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/compositions - Fetch all compositions
 */
app.get("/api/admin/compositions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("compositions")
      .select(
        `
        *,
        composers (
          id,
          user_id,
          users ( display_name, email )
        )
      `,
      )
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/transactions - Fetch all purchases/transactions
 */
app.get("/api/admin/transactions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("purchases")
      .select(
        `
        *,
        compositions ( title, composer_id ),
        buyers (
          id,
          user_id,
          users ( display_name, email )
        )
      `,
      )
      .order("purchased_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-transactions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/invites - Fetch all composer invites
 */
app.get("/api/admin/invites", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("invites")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-invites] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/composer-requests - Fetch pending composer requests
 */
app.get("/api/admin/composer-requests", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, email, roles, composer_request, created_at")
      .eq("composer_request", true)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-composer-requests] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/stats - Fetch admin dashboard stats
 */
app.get("/api/admin/stats", async (req, res) => {
  try {
    const { count: totalUsers } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true });

    const { count: totalCompositions } = await supabase
      .from("compositions")
      .select("id", { count: "exact", head: true });

    const { data: purchases } = await supabase
      .from("purchases")
      .select("price_paid");

    const totalRevenue = (purchases || []).reduce(
      (sum, p) => sum + (parseFloat(p.price_paid) || 0),
      0,
    );

    return res.json({
      totalUsers: totalUsers || 0,
      totalCompositions: totalCompositions || 0,
      totalRevenue,
      totalTransactions: purchases?.length || 0,
    });
  } catch (err) {
    console.error("[admin-stats] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/invites - Create a composer invite
 */
app.post("/api/admin/invites", async (req, res) => {
  try {
    const { email, invited_by } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const payload = {
      email: email.toLowerCase().trim(),
      invited_by,
      created_at: new Date().toISOString(),
      used: false,
    };

    const { data, error } = await supabase
      .from("invites")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error("[admin-create-invite] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/invites/:email - Revoke a composer invite
 */
app.delete("/api/admin/invites/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const normalizedEmail = decodeURIComponent(email).toLowerCase().trim();

    const { error } = await supabase
      .from("invites")
      .delete()
      .eq("email", normalizedEmail);

    if (error) throw error;

    return res.json({ success: true, message: "Invite revoked" });
  } catch (err) {
    console.error("[admin-revoke-invite] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:userId/promote-composer - Promote user to composer
 */
app.post("/api/admin/users/:userId/promote-composer", async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists and get current roles
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Clear composer_request flag on users table
    const { error: clearErr } = await supabase
      .from("users")
      .update({ composer_request: false })
      .eq("id", userId);

    if (clearErr) throw clearErr;

    // Assign composer role via user_roles mapping
    try {
      const { data: roleRow, error: roleErr } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "composer")
        .maybeSingle();

      if (roleErr)
        console.warn("[admin-promote-composer] role lookup warning:", roleErr);

      if (roleRow?.id) {
        const { data: exists } = await supabase
          .from("user_roles")
          .select("*")
          .eq("user_id", userId)
          .eq("role_id", roleRow.id)
          .maybeSingle();

        if (!exists) {
          const { error: urErr } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role_id: roleRow.id });
          if (urErr)
            console.warn(
              "[admin-promote-composer] user_roles insert warning:",
              urErr,
            );
        }
      }
    } catch (e) {
      console.warn(
        "[admin-promote-composer] role assignment failed:",
        e?.message || e,
      );
    }

    // Ensure composers table has an entry for this user
    const { data: existingComposer } = await supabase
      .from("composers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingComposer) {
      await supabase.from("composers").insert([{ user_id: userId }]);
    }

    return res.json({ success: true, message: "User promoted to composer" });
  } catch (err) {
    console.error("[admin-promote-composer] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:userId/promote-admin - Promote user to admin
 */
app.post("/api/admin/users/:userId/promote-admin", async (req, res) => {
  try {
    const { userId } = req.params;

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Assign admin role via user_roles mapping
    try {
      const { data: roleRow, error: roleErr } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "admin")
        .maybeSingle();

      if (roleErr)
        console.warn("[admin-promote-admin] role lookup warning:", roleErr);

      if (roleRow?.id) {
        const { data: exists } = await supabase
          .from("user_roles")
          .select("*")
          .eq("user_id", userId)
          .eq("role_id", roleRow.id)
          .maybeSingle();

        if (!exists) {
          const { error: urErr } = await supabase
            .from("user_roles")
            .insert({ user_id: userId, role_id: roleRow.id });
          if (urErr) throw urErr;
        }
      }

      return res.json({ success: true, message: "User promoted to admin" });
    } catch (err) {
      console.error("[admin-promote-admin] Error assigning admin role:", err);
      return res.status(500).json({ error: err.message || String(err) });
    }
  } catch (err) {
    console.error("[admin-promote-admin] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users/:userId/suspend - Suspend a user
 */
app.post("/api/admin/users/:userId/suspend", async (req, res) => {
  try {
    const { userId } = req.params;

    const { error } = await supabase
      .from("users")
      .update({ is_active: false })
      .eq("id", userId);

    if (error) throw error;

    return res.json({ success: true, message: "User suspended" });
  } catch (err) {
    console.error("[admin-suspend-user] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/composer-requests/:userId/reject - Reject composer request
 */
app.post("/api/admin/composer-requests/:userId/reject", async (req, res) => {
  try {
    const { userId } = req.params;

    const { error } = await supabase
      .from("users")
      .update({ composer_request: false })
      .eq("id", userId);

    if (error) throw error;

    return res.json({ success: true, message: "Request rejected" });
  } catch (err) {
    console.error("[admin-reject-request] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * ===================== NAVBAR ROUTES =====================
 */

/**
 * GET /api/user/roles/:firebaseUid - Fetch user roles by firebase UID
 */
app.get("/api/user/roles/:firebaseUid", async (req, res) => {
  try {
    const { firebaseUid } = req.params;

    if (!firebaseUid) {
      return res.status(400).json({ error: "Firebase UID is required" });
    }

    const { data, error } = await supabase
      .from("users")
      .select(
        `
        id,
        firebase_uid,
        email,
        user_roles (
          roles (name)
        )
      `,
      )
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.json([]);
    }

    const roleNames =
      data.user_roles?.map((r) => r.roles?.name).filter(Boolean) ?? [];

    return res.json(roleNames || []);
  } catch (err) {
    console.error("[navbar-user-roles] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/notifications - Fetch admin notifications (invites, requests, composer requests)
 */
app.get("/api/admin/notifications", async (req, res) => {
  try {
    // Fetch invites from the invites table
    const { data: invitesData, error: invitesErr } = await supabase
      .from("invites")
      .select("*")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch role requests from role_requests table
    const { data: roleReqData, error: roleReqErr } = await supabase
      .from("role_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch composer requests from users table (include roles)
    const { data: composerReqs, error: compErr } = await supabase
      .from("users")
      .select(
        "id, email, display_name, created_at, composer_request, user_roles ( roles ( name ) )",
      )
      .eq("composer_request", true)
      .order("created_at", { ascending: false })
      .limit(50);

    const items = [];

    // Process invites
    (invitesData || []).forEach((invite) => {
      items.push({
        id: `invite:${invite.id}`,
        type: "invite",
        email: invite.email,
        invitedBy: invite.invited_by,
        createdAt: invite.created_at,
        used: invite.used,
      });
    });

    // Process role requests — attach user roles for context
    const roleUserIds = (roleReqData || [])
      .map((r) => r.user_id)
      .filter(Boolean);
    let rolesByUser = {};
    if (roleUserIds.length > 0) {
      try {
        const { data: usersWithRoles } = await supabase
          .from("users")
          .select("id, user_roles ( roles ( name ) )")
          .in("id", roleUserIds);

        (usersWithRoles || []).forEach((u) => {
          rolesByUser[u.id] = (u.user_roles || [])
            .map((ur) => ur.roles?.name)
            .filter(Boolean);
        });
      } catch (e) {
        console.warn(
          "[admin-notifications] Failed to fetch roles for role requests:",
          e?.message || e,
        );
      }
    }

    (roleReqData || []).forEach((req) => {
      items.push({
        id: `request:${req.id}`,
        type: "role_request",
        userId: req.user_id,
        requestedRole: req.requested_role,
        status: req.status,
        createdAt: req.created_at || req.requested_at,
        roles: rolesByUser[req.user_id] || [],
      });
    });

    // Process composer requests (include roles)
    (composerReqs || []).forEach((u) => {
      const roles = (u.user_roles || [])
        .map((ur) => ur.roles?.name)
        .filter(Boolean);
      items.push({
        id: `composer:${u.id}`,
        type: "composer_request",
        userId: u.id,
        email: u.email,
        displayName: u.display_name,
        createdAt: u.created_at,
        roles,
      });
    });

    return res.json(items);
  } catch (err) {
    console.error("[navbar-notifications] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Start server
/**
 * ===================== USER / ACCOUNT ROUTES =====================
 */

/**
 * GET /api/users/:id - Fetch single user by Supabase id
 */
app.get("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { data, error } = await supabase
      .from("users")
      .select(
        `id, firebase_uid, email, display_name, phone, avatar_url, is_active, created_at, user_roles ( roles ( name ) )`,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;

    if (!data) return res.status(404).json({ message: "User not found" });

    // Normalize roles
    const roles = (data.user_roles || [])
      .map((r) => r.roles?.name)
      .filter(Boolean);

    return res.json({ ...data, roles });
  } catch (err) {
    console.error("[get-user] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to fetch user", error: err.message });
  }
});

/**
 * PUT /api/users/:id - Update user fields by Supabase id
 * Body: { display_name?, phone?, avatar_url?, email? }
 */
app.put("/api/users/:id", verifyFirebaseToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, phone, avatar_url, email } = req.body;

    if (!id) return res.status(400).json({ message: "id is required" });

    const payload = {};
    if (display_name !== undefined) payload.display_name = display_name || null;
    if (phone !== undefined) payload.phone = phone || null;
    if (avatar_url !== undefined) payload.avatar_url = avatar_url || null;
    if (email !== undefined) payload.email = email || null;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ message: "User updated", user: data });
  } catch (err) {
    console.error("[update-user] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update user", error: err.message });
  }
});

/**
 * PUT /api/account - Update the authenticated user's account by firebaseUid
 * Body: { firebaseUid, displayName?, phone?, avatarUrl? }
 */
app.put("/api/account", verifyFirebaseToken, async (req, res) => {
  try {
    const { displayName, phone, avatarUrl, email } = req.body;
    const firebaseUid = req.firebaseDecoded?.uid || req.body.firebaseUid;

    if (!firebaseUid)
      return res.status(400).json({ message: "firebaseUid is required" });

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("firebase_uid", firebaseUid)
      .maybeSingle();

    if (!user) return res.status(404).json({ message: "User not found" });

    const payload = {
      ...(displayName !== undefined
        ? { display_name: displayName || null }
        : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl || null } : {}),
      ...(email !== undefined ? { email: email || null } : {}),
    };

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    const { data, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;

    return res.json({ message: "Account updated", user: data });
  } catch (err) {
    console.error("[update-account] Error:", err);
    return res
      .status(500)
      .json({ message: "Failed to update account", error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Auth server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Register user: POST http://localhost:${PORT}/api/register`);
  console.log(
    `📍 Request role: POST http://localhost:${PORT}/api/request-role`,
  );
  console.log(`📍 Admin endpoints: http://localhost:${PORT}/api/admin/*`);
  console.log(`📍 Navbar endpoints: http://localhost:${PORT}/api/user/*`);
  console.log(`\nWaiting for requests...\n`);
});

/**
 * ===================== PUBLIC COMPOSITIONS ROUTES =====================
 */

/**
 * GET /api/compositions - public list of compositions
 * Query params: category, search, limit
 */
app.get("/api/compositions", async (req, res) => {
  try {
    const { category, search, limit } = req.query;

    let query = supabase
      .from("compositions")
      .select(
        `
        *,
        composers(id, users(display_name)),
        categories(name),
        composition_stats(views, purchases)
      `,
      )
      .eq("is_published", true)
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (category) query = query.eq("category_id", category);
    if (search)
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    if (limit) query = query.limit(Number(limit));

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[public-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/compositions/:id - public composition detail (increments views)
 */
app.get("/api/compositions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "id is required" });

    const { data, error } = await supabase
      .from("compositions")
      .select(
        `
        *,
        composers(id, users(display_name, email)),
        categories(name),
        composition_stats(views, purchases)
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data)
      return res.status(404).json({ message: "Composition not found" });

    // Try to increment views via RPC; ignore errors to avoid blocking read
    try {
      await supabase.rpc("increment_views", { composition_id: id });
    } catch (e) {
      console.warn(
        "[public-composition] increment_views RPC failed:",
        e?.message || e,
      );
    }

    return res.json(data);
  } catch (err) {
    console.error("[public-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/compositions - create a new composition (authenticated)
 */
app.post("/api/compositions", verifyFirebaseToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      price,
      file_url,
      thumbnail_url,
      duration_seconds,
      composer_id,
    } = req.body;

    if (!title || !composer_id) {
      return res
        .status(400)
        .json({ message: "title and composer_id are required" });
    }

    const { data: newComp, error: createErr } = await supabase
      .from("compositions")
      .insert({
        title,
        description: description || null,
        category_id: category_id || null,
        price: price || 0,
        file_url: file_url || null,
        thumbnail_url: thumbnail_url || null,
        duration_seconds: duration_seconds || null,
        composer_id,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createErr) throw createErr;

    // Initialize stats
    try {
      await supabase
        .from("composition_stats")
        .insert({ composition_id: newComp.id });
    } catch (e) {
      console.warn(
        "[create-composition] Failed to init stats:",
        e?.message || e,
      );
    }

    return res.status(201).json(newComp);
  } catch (err) {
    console.error("[create-composition] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});
