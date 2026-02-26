import express from "express";
import { supabase } from "../lib/supabaseClient.js";
import { verifyFirebaseToken, adminOnly } from "../middleware/auth.js";

const router = express.Router();

// Protect all admin routes
router.use(verifyFirebaseToken, adminOnly);

router.get("/roles", async (req, res) => {
  try {
    const { data, error } = await supabase.from("roles").select("*");
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-roles] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/users", async (req, res) => {
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
    return res.json({ users: users || [], userRoles: userRoles || [] });
  } catch (err) {
    console.error("[admin-users] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/compositions", async (req, res) => {
  try {
    // compose without deep composer->users join; frontend can fetch user info separately if needed
    const { data, error } = await supabase
      .from("compositions")
      .select(
        `
        *,
        composers (
          id,
          user_id
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

router.get("/transactions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("purchases")
      .select(
        `
        *,
        compositions ( title, composer_id ),
        buyers ( id, user_id, users ( display_name, email ) )
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

router.get("/invites", async (req, res) => {
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

router.get("/composer-requests", async (req, res) => {
  try {
    // Fetch ALL composer requests from role_requests table (not just pending)
    // Admins need to see all requests for full management
    const { data, error } = await supabase
      .from("role_requests")
      .select(
        `id, user_id, requested_role, status, requested_at, users!role_requests_user_id_fkey(id, email, display_name, roles:user_roles(roles(name)))`,
      )
      .eq("requested_role", "composer")
      .order("requested_at", { ascending: false });

    if (error) throw error;

    // Transform response to match admin panel expectations
    const formattedData = (data || []).map((req) => ({
      id: req.id,
      user_id: req.user_id,
      email: req.users?.email,
      display_name: req.users?.display_name,
      displayName: req.users?.display_name, // support both field names
      requested_role: req.requested_role,
      status: req.status,
      created_at: req.requested_at,
      roles: req.users?.roles?.map((ur) => ur.roles?.name) || [],
    }));

    return res.json(formattedData);
  } catch (err) {
    console.error("[admin-composer-requests] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
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
    console.log("[admin-stats] Stats fetched:", {
      totalUsers,
      totalCompositions,
      purchasesCount: purchases?.length,
      totalRevenue,
    });
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

// Debug endpoint to check all compositions in database
router.get("/debug/compositions", async (req, res) => {
  try {
    console.log("[debug-compositions] Querying compositions...");

    // Query without RLS restrictions
    const {
      data: allCompositions,
      error,
      count,
    } = await supabase
      .from("compositions")
      .select("id, title, composer_id, deleted, created_at", {
        count: "exact",
      });

    console.log("[debug-compositions] Query result:", {
      error,
      count,
      compositions: allCompositions?.length || 0,
      sample: allCompositions?.slice(0, 3),
    });

    if (error) {
      return res.status(500).json({
        error: error.message,
        details: error,
      });
    }

    return res.json({
      total: count || 0,
      data: allCompositions || [],
    });
  } catch (err) {
    console.error("[debug-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/invites", async (req, res) => {
  try {
    const { email, invited_by } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const payload = {
      email: String(email).toLowerCase().trim(),
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

router.delete("/invites/:email", async (req, res) => {
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

router.post("/users/:userId/promote-composer", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (userErr || !user)
      return res.status(404).json({ error: "User not found" });

    // Mark the composer request as approved in role_requests table
    const { error: updateReqErr } = await supabase
      .from("role_requests")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("requested_role", "composer")
      .eq("status", "pending");
    if (updateReqErr)
      console.warn(
        "[admin-promote-composer] Failed to update role_requests:",
        updateReqErr,
      );

    // Clear the old composer_request flag if it exists
    const { error: clearErr } = await supabase
      .from("users")
      .update({ composer_request: false })
      .eq("id", userId);
    if (clearErr) throw clearErr;

    try {
      const { data: roleRow } = await supabase
        .from("roles")
        .select("id")
        .eq("name", "composer")
        .maybeSingle();
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
    const { data: existingComposer } = await supabase
      .from("composers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingComposer)
      await supabase.from("composers").insert([{ user_id: userId }]);
    return res.json({ success: true, message: "User promoted to composer" });
  } catch (err) {
    console.error("[admin-promote-composer] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/users/:userId/promote-admin", async (req, res) => {
  try {
    const { userId } = req.params;
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();
    if (userErr || !user)
      return res.status(404).json({ error: "User not found" });

    const { data: roleRow } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "admin")
      .maybeSingle();
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
    console.error("[admin-promote-admin] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/users/:userId/suspend", async (req, res) => {
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

router.post("/composer-requests/:userId/reject", async (req, res) => {
  try {
    const { userId } = req.params;
    // Update the pending composer request to rejected status
    const { error } = await supabase
      .from("role_requests")
      .update({ status: "rejected" })
      .eq("user_id", userId)
      .eq("requested_role", "composer")
      .eq("status", "pending");
    if (error) throw error;
    return res.json({ success: true, message: "Composer request rejected" });
  } catch (err) {
    console.error("[admin-reject-composer-request] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Admin notifications endpoint
router.get("/notifications", async (req, res) => {
  try {
    const { data: invitesData } = await supabase
      .from("invites")
      .select("*")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(50);

    // Fetch pending composer and admin requests from role_requests table
    const { data: roleReqData } = await supabase
      .from("role_requests")
      .select("*")
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(50);

    const items = [];

    // Add invites as notifications
    (invitesData || []).forEach((invite) =>
      items.push({
        id: `invite:${invite.id}`,
        type: "invite",
        email: invite.email,
        invitedBy: invite.invited_by,
        createdAt: invite.created_at,
        used: invite.used,
      }),
    );

    // Fetch user details for all role requests
    const roleUserIds = (roleReqData || [])
      .map((r) => r.user_id)
      .filter(Boolean);
    let usersByUserId = {};
    if (roleUserIds.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, display_name, user_roles ( roles ( name ) )")
          .in("id", roleUserIds);
        (usersData || []).forEach((u) => {
          usersByUserId[u.id] = {
            email: u.email,
            display_name: u.display_name,
            roles: (u.user_roles || [])
              .map((ur) => ur.roles?.name)
              .filter(Boolean),
          };
        });
      } catch (e) {
        console.warn(
          "[admin-notifications] Failed to fetch users for role requests:",
          e?.message || e,
        );
      }
    }

    // Add role requests (composer and admin) as notifications
    (roleReqData || []).forEach((reqItem) => {
      const user = usersByUserId[reqItem.user_id] || {};
      items.push({
        id: `request:${reqItem.id}`,
        type: "request", // Generic request type for composer/admin requests
        userId: reqItem.user_id,
        email: user.email,
        displayName: user.display_name,
        requestedRole: reqItem.requested_role,
        status: reqItem.status,
        createdAt: reqItem.requested_at,
        created_at: reqItem.requested_at,
        roles: user.roles || [],
      });
    });

    return res.json(items);
  } catch (err) {
    console.error("[admin-notifications] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
