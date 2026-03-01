import express from "express";
import { supabaseAdmin as supabase } from "../lib/supabaseServer.js";
import {
  verifySupabaseToken,
  adminOnly,
} from "../middleware/verifySupabaseToken.js";

const router = express.Router();

// Protect all admin routes
router.use(verifySupabaseToken, adminOnly);

function parseLimit(raw, fallback = 200, max = 1000) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

async function resolveDbUser(userIdentifier) {
  if (!userIdentifier) return null;
  const normalized = String(userIdentifier).trim();
  if (!normalized) return null;

  const { data: byId, error: byIdErr } = await supabase
    .from("users")
    .select("id, auth_uid, email, display_name")
    .eq("id", normalized)
    .maybeSingle();
  if (byIdErr) throw byIdErr;
  if (byId) return byId;

  const { data: byAuthUid, error: byAuthErr } = await supabase
    .from("users")
    .select("id, auth_uid, email, display_name")
    .eq("auth_uid", normalized)
    .maybeSingle();
  if (byAuthErr) throw byAuthErr;
  if (byAuthUid) return byAuthUid;

  return null;
}

router.get("/bootstrap", async (req, res) => {
  try {
    const [rolesRes, invitesRes, pendingReqRes, usersCountRes, compositionsCountRes, purchasesCountRes] =
      await Promise.all([
        supabase.from("roles").select("id, name"),
        supabase
          .from("invites")
          .select("id, email, invited_by, created_at, used")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("role_requests")
          .select("id, user_id, requested_role, status, requested_at")
          .eq("requested_role", "composer")
          .eq("status", "pending")
          .order("requested_at", { ascending: false })
          .limit(50),
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase
          .from("compositions")
          .select("id", { count: "exact", head: true })
          .eq("deleted", false),
        supabase
          .from("purchases")
          .select("id", { count: "exact", head: true }),
      ]);

    if (rolesRes.error) throw rolesRes.error;
    if (invitesRes.error) throw invitesRes.error;
    if (pendingReqRes.error) throw pendingReqRes.error;

    const pendingRequests = pendingReqRes.data || [];
    const reqUserIds = [
      ...new Set(pendingRequests.map((r) => r.user_id).filter(Boolean)),
    ];

    let requestUsersById = {};
    let requestRolesByUserId = {};
    if (reqUserIds.length > 0) {
      const [usersRes, roleRowsRes] = await Promise.all([
        supabase
          .from("users")
          .select("id, email, display_name")
          .in("id", reqUserIds),
        supabase
          .from("user_roles")
          .select("user_id, roles(name)")
          .in("user_id", reqUserIds),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (roleRowsRes.error) throw roleRowsRes.error;

      (usersRes.data || []).forEach((u) => {
        requestUsersById[u.id] = u;
      });

      (roleRowsRes.data || []).forEach((row) => {
        const roleName = row.roles?.name;
        if (!roleName) return;
        if (!requestRolesByUserId[row.user_id]) requestRolesByUserId[row.user_id] = [];
        if (!requestRolesByUserId[row.user_id].includes(roleName)) {
          requestRolesByUserId[row.user_id].push(roleName);
        }
      });
    }

    const formattedRequests = pendingRequests.map((r) => {
      const user = requestUsersById[r.user_id] || null;
      return {
        id: r.user_id,
        request_id: r.id,
        user_id: r.user_id,
        email: user?.email || null,
        display_name: user?.display_name || null,
        displayName: user?.display_name || null,
        requested_role: r.requested_role,
        status: r.status,
        created_at: r.requested_at,
        roles: requestRolesByUserId[r.user_id] || [],
      };
    });

    return res.json({
      roles: rolesRes.data || [],
      invites: invitesRes.data || [],
      requests: formattedRequests,
      stats: {
        totalUsers: usersCountRes.count || 0,
        totalCompositions: compositionsCountRes.count || 0,
        totalTransactions: purchasesCountRes.count || 0,
        totalRevenue: 0, // hydrated by /admin/stats asynchronously on the client
      },
    });
  } catch (err) {
    console.error("[admin-bootstrap] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

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
      .select(
        "id, auth_uid, email, display_name, avatar_url, is_active, composer_request, deleted, created_at, updated_at",
      )
      .order("created_at", { ascending: false });
    if (usersErr) throw usersErr;
    const { data: userRoles, error: userRolesErr } = await supabase
      .from("user_roles")
      .select("user_id, role_id, roles(name)");
    if (userRolesErr) console.warn("user_roles fetch warning:", userRolesErr);
    return res.json({ users: users || [], userRoles: userRoles || [] });
  } catch (err) {
    console.error("[admin-users] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/compositions", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 400, 1000);

    // compose without deep composer->users join; frontend can fetch user info separately if needed
    let query = supabase
      .from("compositions")
      .select(
        `
        id,
        title,
        description,
        price,
        created_at,
        composer_id,
        composers (
          id,
          user_id,
          users(display_name, email)
        )
      `,
      )
      .eq("deleted", false)
      .order("created_at", { ascending: false });

    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data || []);
  } catch (err) {
    console.error("[admin-compositions] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const limit = parseLimit(req.query.limit, 200, 1000);

    const { data: purchases, error: purchasesError } = await supabase
      .from("purchases")
      .select("id, buyer_id, composition_id, price_paid, payment_ref, purchased_at, is_active")
      .order("purchased_at", { ascending: false })
      .limit(limit);
    if (purchasesError) throw purchasesError;

    const compositionIds = [
      ...new Set((purchases || []).map((p) => p.composition_id).filter(Boolean)),
    ];
    const buyerIds = [
      ...new Set((purchases || []).map((p) => p.buyer_id).filter(Boolean)),
    ];

    const [compositionsRes, buyersRes] = await Promise.all([
      compositionIds.length > 0
        ? supabase
            .from("compositions")
            .select("id, title, composer_id")
            .in("id", compositionIds)
        : Promise.resolve({ data: [], error: null }),
      buyerIds.length > 0
        ? supabase
            .from("buyers")
            .select("id, user_id")
            .in("id", buyerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (compositionsRes.error) throw compositionsRes.error;
    if (buyersRes.error) throw buyersRes.error;

    let compositionsById = {};
    (compositionsRes.data || []).forEach((c) => {
      compositionsById[c.id] = c;
    });

    let buyersById = {};
    (buyersRes.data || []).forEach((b) => {
      buyersById[b.id] = b;
    });

    const buyerUserIds = [
      ...new Set(Object.values(buyersById).map((b) => b.user_id).filter(Boolean)),
    ];

    // Backward compatibility: some legacy records may store buyer_id directly as users.id.
    const unresolvedBuyerIds = buyerIds.filter((buyerId) => !buyersById[buyerId]);
    const userLookupIds = [...new Set([...buyerUserIds, ...unresolvedBuyerIds])];

    let usersById = {};
    if (userLookupIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("id, display_name, email")
        .in("id", userLookupIds);
      if (usersError) throw usersError;
      (users || []).forEach((u) => {
        usersById[u.id] = u;
      });
    }

    const formatted = (purchases || []).map((purchase) => {
      const buyerRecord = purchase.buyer_id ? buyersById[purchase.buyer_id] : null;
      const fallbackUser = purchase.buyer_id ? usersById[purchase.buyer_id] : null;
      const buyer = buyerRecord
        ? buyerRecord
        : fallbackUser
          ? { id: purchase.buyer_id, user_id: purchase.buyer_id }
          : null;
      const buyerUser = buyer?.user_id ? usersById[buyer.user_id] : null;
      return {
        ...purchase,
        compositions: purchase.composition_id
          ? compositionsById[purchase.composition_id] || null
          : null,
        buyers: buyer
          ? {
              ...buyer,
              users: buyerUser
                ? {
                    id: buyerUser.id,
                    display_name: buyerUser.display_name,
                    email: buyerUser.email,
                  }
                : null,
            }
          : null,
      };
    });

    return res.json(formatted);
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
    // Fetch ALL composer requests from role_requests table (not just pending).
    const { data: requests, error: requestsError } = await supabase
      .from("role_requests")
      .select("id, user_id, requested_role, status, requested_at")
      .eq("requested_role", "composer")
      .order("requested_at", { ascending: false });
    if (requestsError) throw requestsError;

    const userIds = [...new Set((requests || []).map((r) => r.user_id).filter(Boolean))];

    let usersById = {};
    if (userIds.length > 0) {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, email, display_name")
        .in("id", userIds);
      if (usersError) throw usersError;
      (usersData || []).forEach((u) => {
        usersById[u.id] = u;
      });
    }

    let rolesByUserId = {};
    if (userIds.length > 0) {
      const { data: roleRows, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, roles(name)")
        .in("user_id", userIds);
      if (rolesError) throw rolesError;
      (roleRows || []).forEach((row) => {
        const roleName = row.roles?.name;
        if (!roleName) return;
        if (!rolesByUserId[row.user_id]) rolesByUserId[row.user_id] = [];
        if (!rolesByUserId[row.user_id].includes(roleName)) {
          rolesByUserId[row.user_id].push(roleName);
        }
      });
    }

    const formattedData = (requests || []).map((req) => {
      const user = usersById[req.user_id] || null;
      return {
        id: req.user_id,
        request_id: req.id,
        user_id: req.user_id,
        email: user?.email || null,
        display_name: user?.display_name || null,
        displayName: user?.display_name || null,
        requested_role: req.requested_role,
        status: req.status,
        created_at: req.requested_at,
        roles: rolesByUserId[req.user_id] || [],
      };
    });

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
    const { userId: userIdentifier } = req.params;
    const user = await resolveDbUser(userIdentifier);
    if (!user)
      return res.status(404).json({ error: "User not found" });
    const userId = user.id;

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

    // Keep legacy composer_request flag in sync for UI compatibility.
    const { error: composerFlagErr } = await supabase
      .from("users")
      .update({ composer_request: false })
      .eq("id", userId);
    if (composerFlagErr)
      console.warn(
        "[admin-promote-composer] Failed to clear composer_request:",
        composerFlagErr,
      );

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
    const { userId: userIdentifier } = req.params;
    const user = await resolveDbUser(userIdentifier);
    if (!user)
      return res.status(404).json({ error: "User not found" });
    const userId = user.id;

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

    const { error: adminReqErr } = await supabase
      .from("role_requests")
      .update({ status: "approved" })
      .eq("user_id", userId)
      .eq("requested_role", "admin")
      .eq("status", "pending");
    if (adminReqErr)
      console.warn(
        "[admin-promote-admin] Failed to update admin role request:",
        adminReqErr,
      );

    return res.json({ success: true, message: "User promoted to admin" });
  } catch (err) {
    console.error("[admin-promote-admin] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/users/:userId/suspend", async (req, res) => {
  try {
    const { userId: userIdentifier } = req.params;
    const user = await resolveDbUser(userIdentifier);
    if (!user) return res.status(404).json({ error: "User not found" });
    const userId = user.id;
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
    const { userId: userIdentifier } = req.params;
    const user = await resolveDbUser(userIdentifier);
    const userId = user?.id || String(userIdentifier).trim();
    if (!userId) return res.status(400).json({ error: "Invalid user id" });
    // Update the pending composer request to rejected status
    const { error } = await supabase
      .from("role_requests")
      .update({ status: "rejected" })
      .eq("user_id", userId)
      .eq("requested_role", "composer")
      .eq("status", "pending");
    if (error) throw error;

    if (user?.id) {
      const { error: composerFlagErr } = await supabase
        .from("users")
        .update({ composer_request: false })
        .eq("id", user.id);
      if (composerFlagErr)
        console.warn(
          "[admin-reject-composer-request] Failed to clear composer_request:",
          composerFlagErr,
        );
    }

    return res.json({ success: true, message: "Composer request rejected" });
  } catch (err) {
    console.error("[admin-reject-composer-request] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/role-requests/:userId/reject", async (req, res) => {
  try {
    const { userId: userIdentifier } = req.params;
    const requestedRole =
      req.body?.requestedRole === "admin" ? "admin" : "composer";
    const user = await resolveDbUser(userIdentifier);
    const userId = user?.id || String(userIdentifier).trim();
    if (!userId) return res.status(400).json({ error: "Invalid user id" });

    const { error } = await supabase
      .from("role_requests")
      .update({ status: "rejected" })
      .eq("user_id", userId)
      .eq("requested_role", requestedRole)
      .eq("status", "pending");
    if (error) throw error;

    if (requestedRole === "composer" && user?.id) {
      const { error: composerFlagErr } = await supabase
        .from("users")
        .update({ composer_request: false })
        .eq("id", user.id);
      if (composerFlagErr)
        console.warn(
          "[admin-reject-role-request] Failed to clear composer_request:",
          composerFlagErr,
        );
    }

    return res.json({
      success: true,
      message: `${requestedRole} request rejected`,
    });
  } catch (err) {
    console.error("[admin-reject-role-request] Error:", err);
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

    // Fetch user details for all role requests.
    // Some legacy rows may store user_id as users.auth_uid instead of users.id.
    const roleUserIdentifiers = (roleReqData || [])
      .map((r) => r.user_id)
      .filter(Boolean);
    let usersById = {};
    let usersByAuthUid = {};
    let rolesByUserId = {};
    if (roleUserIdentifiers.length > 0) {
      try {
        const [usersByIdRes, usersByAuthUidRes] = await Promise.all([
          supabase
            .from("users")
            .select("id, auth_uid, email, display_name")
            .in("id", roleUserIdentifiers),
          supabase
            .from("users")
            .select("id, auth_uid, email, display_name")
            .in("auth_uid", roleUserIdentifiers),
        ]);

        if (usersByIdRes.error) throw usersByIdRes.error;
        if (usersByAuthUidRes.error) throw usersByAuthUidRes.error;

        const mergedUsers = [
          ...(usersByIdRes.data || []),
          ...(usersByAuthUidRes.data || []),
        ];

        mergedUsers.forEach((u) => {
          usersById[u.id] = u;
          if (u.auth_uid) usersByAuthUid[u.auth_uid] = u;
        });

        const resolvedUserIds = [...new Set(mergedUsers.map((u) => u.id))];
        if (resolvedUserIds.length > 0) {
          const { data: roleRows, error: roleErr } = await supabase
            .from("user_roles")
            .select("user_id, roles(name)")
            .in("user_id", resolvedUserIds);
          if (roleErr) throw roleErr;

          (roleRows || []).forEach((row) => {
            const roleName = row.roles?.name;
            if (!roleName) return;
            if (!rolesByUserId[row.user_id]) rolesByUserId[row.user_id] = [];
            if (!rolesByUserId[row.user_id].includes(roleName)) {
              rolesByUserId[row.user_id].push(roleName);
            }
          });
        }
      } catch (e) {
        console.warn(
          "[admin-notifications] Failed to fetch users for role requests:",
          e?.message || e,
        );
      }
    }

    // Add role requests (composer and admin) as notifications
    (roleReqData || []).forEach((reqItem) => {
      const user =
        usersById[reqItem.user_id] || usersByAuthUid[reqItem.user_id] || null;
      if (!reqItem.user_id) return;
      const resolvedUserId = user?.id || reqItem.user_id;
      const fallbackDisplayName =
        user?.display_name ||
        user?.email ||
        `User (${String(reqItem.user_id).slice(0, 8)}...)`;
      items.push({
        id: `request:${reqItem.id}`,
        type: "request", // Generic request type for composer/admin requests
        userId: resolvedUserId,
        requestUserId: reqItem.user_id,
        canApprove: Boolean(user?.id),
        email: user?.email || null,
        displayName: fallbackDisplayName,
        requestedRole: reqItem.requested_role,
        status: reqItem.status,
        createdAt: reqItem.requested_at,
        created_at: reqItem.requested_at,
        roles: user?.id ? rolesByUserId[user.id] || [] : [],
      });
    });

    return res.json(items);
  } catch (err) {
    console.error("[admin-notifications] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
