import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health
app.get('/api/health', (c) => c.json({ ok: true, service: 'murekefu-music-hub' }));
app.get('/health', (c) => c.json({ ok: true, service: 'murekefu-music-hub' }));

async function verifyToken(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${c.env.SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function getUserFromDb(c, authUid) {
  const res = await fetch(`${c.env.SUPABASE_URL}/rest/v1/users?auth_uid=eq.${authUid}&select=*`, {
    headers: { 'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  const users = await res.json();
  return users[0] || null;
}

async function getUserRoles(c, userId, userEmail) {
  const roles = ['buyer'];
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const roleRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}&select=roles(name)`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  (await roleRes.json() || []).forEach(row => {
    const name = row.roles?.name;
    if (name && !roles.includes(name)) roles.push(name);
  });

  const composerRes = await fetch(`${supabaseUrl}/rest/v1/composers?user_id=eq.${userId}&select=id`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  if ((await composerRes.json() || []).length > 0 && !roles.includes('composer')) roles.push('composer');

  const adminIdentifiers = String(c.env.ADMIN_IDENTIFIERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const normalizedEmail = String(userEmail || '').trim().toLowerCase();
  if (adminIdentifiers.includes(normalizedEmail) && !roles.includes('admin')) {
    roles.push('admin');
  } else {
    const adminRes = await fetch(`${supabaseUrl}/rest/v1/admin_emails?email=ilike.${normalizedEmail}&is_active=eq.true&id=not.is.null&select=id`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    if ((await adminRes.json() || []).length > 0 && !roles.includes('admin')) roles.push('admin');
  }

  return roles;
}

async function requireAdmin(c) {
  const user = await verifyToken(c);
  if (!user) return { error: 'Unauthorized', status: 401 };
  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return { error: 'User not found', status: 404 };
  const roles = await getUserRoles(c, userRow.id, userRow.email);
  if (!roles.includes('admin')) return { error: 'Admin access required', status: 403 };
  return { user, userRow, roles };
}

// ============================================================
// ROLE REQUEST ENDPOINTS
// ============================================================

app.get('/api/request-role/status', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return c.json({ message: 'User not found' }, 404);

  const roles = await getUserRoles(c, userRow.id, userRow.email);
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const reqRes = await fetch(`${supabaseUrl}/rest/v1/role_requests?user_id=eq.${userRow.id}&requested_role=in.(composer,admin)&select=requested_role,status,requested_at&order=requested_at.desc`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const requests = await reqRes.json();

  const requestStatus = { composer: 'none', admin: 'none' };
  (requests || []).forEach(row => {
    const role = row.requested_role;
    if (!['composer', 'admin'].includes(role)) return;
    if (requestStatus[role] === 'none') requestStatus[role] = row.status || 'none';
  });

  if (roles.includes('composer')) requestStatus.composer = 'approved';
  if (roles.includes('admin')) requestStatus.admin = 'approved';

  return c.json({ roles, requests: requestStatus });
});

app.get('/api/request-role/invite-status', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return c.json({ message: 'User not found' }, 404);

  const requestedRole = c.req.query('requestedRole') === 'admin' ? 'admin' : 'composer';
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const normalizedEmail = String(userRow.email || '').trim().toLowerCase();
  if (!normalizedEmail) return c.json({ available: false, requestedRole });

  const inviteRes = await fetch(`${supabaseUrl}/rest/v1/invites?email=ilike.${normalizedEmail}&requested_role=eq.${requestedRole}&select=id,email,requested_role,created_at,used,used_by,used_at&order=created_at.desc&limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const invites = await inviteRes.json();
  const invite = invites[0];

  if (!invite) return c.json({ available: false, requestedRole });

  const usedBy = invite.used_by || null;
  const acceptedByCurrentUser = Boolean(invite.used && usedBy === userRow.id);
  const canAccept = !invite.used || acceptedByCurrentUser;

  return c.json({
    available: true, requestedRole, canAccept, accepted: acceptedByCurrentUser,
    invite: { id: invite.id, email: invite.email, used: Boolean(invite.used), usedBy, usedAt: invite.used_at || null, createdAt: invite.created_at || null },
  });
});

app.post('/api/request-role/accept-invite', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return c.json({ message: 'User not found' }, 404);

  const body = await c.req.json();
  const requestedRole = body?.requestedRole === 'admin' ? 'admin' : 'composer';
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const normalizedEmail = String(userRow.email || '').trim().toLowerCase();
  const inviteRes = await fetch(`${supabaseUrl}/rest/v1/invites?email=ilike.${normalizedEmail}&requested_role=eq.${requestedRole}&select=id,email,used,used_by&order=created_at.desc&limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const invites = await inviteRes.json();
  const invite = invites[0];

  if (!invite) return c.json({ message: `No active ${requestedRole} invite found for your account.` }, 404);
  if (invite.used && invite.used_by && invite.used_by !== userRow.id) return c.json({ message: 'This invite was already accepted by another user.' }, 409);

  const roleRes = await fetch(`${supabaseUrl}/rest/v1/roles?name=eq.${requestedRole}&select=id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const roles = await roleRes.json();
  if (roles[0]?.id) {
    const existingRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userRow.id}&role_id=eq.${roles[0].id}&select=user_id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
    if ((await existingRes.json() || []).length === 0) {
      await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ user_id: userRow.id, role_id: roles[0].id }),
      });
    }
    if (requestedRole === 'composer') {
      const composerRes = await fetch(`${supabaseUrl}/rest/v1/composers?user_id=eq.${userRow.id}&select=id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
      if ((await composerRes.json() || []).length === 0) {
        await fetch(`${supabaseUrl}/rest/v1/composers`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ user_id: userRow.id }),
        });
      }
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userRow.id}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ composer_request: false }),
      });
    }
  }

  const usedAt = new Date().toISOString();
  await fetch(`${supabaseUrl}/rest/v1/invites?id=eq.${invite.id}`, {
    method: 'PATCH',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ used: true, used_by: userRow.id, used_at: usedAt }),
  });

  const updatedRoles = await getUserRoles(c, userRow.id, userRow.email);

  return c.json({
    success: true, message: `${requestedRole} invite accepted successfully.`, requestedRole, roles: updatedRoles,
    invite: { id: invite.id, email: invite.email, used: true, usedBy: userRow.id, usedAt, createdAt: invite.created_at || null },
  });
});

app.post('/api/request-role', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return c.json({ message: 'User not found' }, 404);

  const body = await c.req.json();
  const { requestedRole } = body;

  if (!requestedRole) return c.json({ message: 'requestedRole required' }, 400);
  if (!['composer', 'admin'].includes(requestedRole)) return c.json({ message: 'requestedRole must be "composer" or "admin"' }, 400);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const currentRoles = await getUserRoles(c, userRow.id, userRow.email);
  if (currentRoles.includes(requestedRole)) return c.json({ message: `You already have ${requestedRole} access.`, status: 'approved' }, 409);

  const existingRes = await fetch(`${supabaseUrl}/rest/v1/role_requests?user_id=eq.${userRow.id}&requested_role=eq.${requestedRole}&select=id,status&order=requested_at.desc&limit=1`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const existing = await existingRes.json();

  if (existing[0]?.status === 'pending' || existing[0]?.status === 'approved') {
    if (requestedRole === 'composer' && existing[0].status === 'pending') {
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userRow.id}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ composer_request: true }),
      });
    }
    return c.json({ message: `You already have a ${existing[0].status} ${requestedRole} request.`, requestId: existing[0].id, status: existing[0].status }, 409);
  }

  const createRes = await fetch(`${supabaseUrl}/rest/v1/role_requests`, {
    method: 'POST',
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ user_id: userRow.id, requested_role: requestedRole, status: 'pending', requested_at: new Date().toISOString() }),
  });

  const created = await createRes.json();
  const requestId = created[0]?.id || null;

  if (requestedRole === 'composer') {
    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userRow.id}`, {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ composer_request: true }),
    });
  }

  return c.json({ success: true, message: `${requestedRole} request submitted successfully.`, requestId, status: 'pending' });
});

// ============================================================
// AUTH ENDPOINTS
// ============================================================

app.get('/api/auth/verify', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: 'Invalid token' }, 401);
  return c.json({ user });
});

app.post('/api/auth/sync-user', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const existing = await checkRes.json();

  if (existing.length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        id: user.id, auth_uid: user.id, email: user.email,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      }),
    });
  }

  return c.json({ success: true, user_id: user.id });
});

// ============================================================
// USER ENDPOINTS
// ============================================================

// GET /api/user/roles/:authUid — used by AuthContext.tsx fetchServerRoles
app.get('/api/user/roles/:authUid', async (c) => {
  const authUid = c.req.param('authUid');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const userRes = await fetch(`${supabaseUrl}/rest/v1/users?auth_uid=eq.${authUid}&select=id,email`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const users = await userRes.json();
  if (users.length === 0) return c.json([]);

  const userRow = users[0];
  const roles = await getUserRoles(c, userRow.id, userRow.email);
  return c.json(roles);
});

app.get('/api/users/by-auth-uid/:authUid', async (c) => {
  const authUid = c.req.param('authUid');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/users?auth_uid=eq.${authUid}&select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const users = await response.json();
  if (users.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json(users[0]);
});

app.post('/api/users/ensure', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const checkRes = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const existing = await checkRes.json();

  if (existing.length === 0) {
    const createRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({
        id: user.id, auth_uid: user.id, email: user.email,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      }),
    });
    const created = await createRes.json();
    return c.json(created[0] || { success: true });
  }

  return c.json(existing[0]);
});

app.get('/api/users/:id', async (c) => {
  const userId = c.req.param('id');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const users = await response.json();
  if (users.length === 0) return c.json({ error: 'User not found' }, 404);
  return c.json(users[0]);
});

// PUT /api/account
app.put('/api/account', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);

  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return c.json({ message: 'User row not found' }, 404);

  const body = await c.req.json();
  const updates = {};

  if (body.displayName !== undefined) updates.display_name = body.displayName || null;
  if (body.phone !== undefined) updates.phone = String(body.phone || '').trim().slice(0, 32) || null;
  if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl || null;

  if (Object.keys(updates).length === 0) return c.json({ message: 'No updatable fields provided' }, 400);

  const response = await fetch(`${c.env.SUPABASE_URL}/rest/v1/users?id=eq.${userRow.id}`, {
    method: 'PATCH',
    headers: { 'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(updates),
  });

  const updated = await response.json();
  return c.json(updated[0] || { success: true });
});

// DELETE /api/account
app.delete('/api/account', async (c) => {
  const user = await verifyToken(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);

  const userRow = await getUserFromDb(c, user.id);
  if (!userRow) return c.json({ message: 'User not found' }, 404);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  await fetch(`${supabaseUrl}/rest/v1/composers?user_id=eq.${userRow.id}`, { method: 'DELETE', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userRow.id}`, { method: 'DELETE', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userRow.id}`, { method: 'DELETE', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });

  return c.json({ success: true });
});

// ============================================================
// COMPOSITIONS ENDPOINTS
// ============================================================

app.get('/api/compositions', async (c) => {
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/compositions?is_published=eq.true&select=*&order=created_at.desc`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  return c.json(await response.json());
});

app.get('/api/compositions/:id', async (c) => {
  const id = c.req.param('id');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/compositions?id=eq.${id}&select=*`, {
    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
  });
  const compositions = await response.json();
  if (compositions.length === 0) return c.json({ error: 'Composition not found' }, 404);
  return c.json(compositions[0]);
});

// ============================================================
// ADMIN ROUTES
// ============================================================

// GET /api/admin/bootstrap
app.get('/api/admin/bootstrap', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const [rolesRes, invitesRes, pendingReqRes, usersCountRes, compositionsCountRes, purchasesCountRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/roles?select=id,name`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
    fetch(`${supabaseUrl}/rest/v1/invites?select=id,email,invited_by,created_at,used&order=created_at.desc&limit=50`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
    fetch(`${supabaseUrl}/rest/v1/role_requests?requested_role=eq.composer&status=eq.pending&select=id,user_id,requested_role,status,requested_at&order=requested_at.desc&limit=50`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
    fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' } }),
    fetch(`${supabaseUrl}/rest/v1/compositions?deleted=eq.false&select=id&limit=1`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' } }),
    fetch(`${supabaseUrl}/rest/v1/purchases?select=id&limit=1`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' } }),
  ]);

  const roles = await rolesRes.json();
  const invites = await invitesRes.json();
  const pendingRequests = await pendingReqRes.json();

  const reqUserIds = [...new Set((pendingRequests || []).map(r => r.user_id).filter(Boolean))];
  let requestUsersById = {};
  let requestRolesByUserId = {};
  if (reqUserIds.length > 0) {
    const [usersRes, roleRowsRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/users?id=in.(${reqUserIds.join(',')})&select=id,email,display_name`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
      fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=in.(${reqUserIds.join(',')})&select=user_id,roles(name)`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
    ]);
    const reqUsers = await usersRes.json();
    const reqRoles = await roleRowsRes.json();
    (reqUsers || []).forEach(u => { requestUsersById[u.id] = u; });
    (reqRoles || []).forEach(row => {
      const roleName = row.roles?.name;
      if (!roleName) return;
      if (!requestRolesByUserId[row.user_id]) requestRolesByUserId[row.user_id] = [];
      if (!requestRolesByUserId[row.user_id].includes(roleName)) requestRolesByUserId[row.user_id].push(roleName);
    });
  }

  const formattedRequests = (pendingRequests || []).map(r => {
    const user = requestUsersById[r.user_id] || null;
    return {
      id: r.user_id, request_id: r.id, user_id: r.user_id,
      email: user?.email || null, display_name: user?.display_name || null,
      displayName: user?.display_name || null, requested_role: r.requested_role,
      status: r.status, created_at: r.requested_at,
      roles: requestRolesByUserId[r.user_id] || [],
    };
  });

  return c.json({
    roles: roles || [], invites: invites || [], requests: formattedRequests,
    stats: {
      totalUsers: parseInt(usersCountRes.headers.get('content-range')?.split('/')[1] || '0'),
      totalCompositions: parseInt(compositionsCountRes.headers.get('content-range')?.split('/')[1] || '0'),
      totalTransactions: parseInt(purchasesCountRes.headers.get('content-range')?.split('/')[1] || '0'),
      totalRevenue: 0,
    },
  });
});

app.get('/api/admin/roles', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const res = await fetch(`${c.env.SUPABASE_URL}/rest/v1/roles?select=*&order=id`, {
    headers: { 'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  return c.json(await res.json());
});

app.get('/api/admin/users', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const usersRes = await fetch(`${supabaseUrl}/rest/v1/users?select=*&order=created_at.desc`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const users = await usersRes.json();
  const rolesRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?select=user_id,role_id,roles(name)`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const allRoles = await rolesRes.json();

  const rolesByUser = {};
  (allRoles || []).forEach(r => {
    if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
    if (r.roles?.name) rolesByUser[r.user_id].push(r.roles.name);
  });

  return c.json((users || []).map(u => ({ ...u, computed_roles: rolesByUser[u.id] || [] })));
});

app.post('/api/admin/users/:id/promote-composer', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const userId = c.req.param('id');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const roleRes = await fetch(`${supabaseUrl}/rest/v1/roles?name=eq.composer&select=id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const roles = await roleRes.json();
  if (!roles[0]?.id) return c.json({ error: 'Composer role not found' }, 404);

  const existingRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}&role_id=eq.${roles[0].id}&select=user_id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  if ((await existingRes.json() || []).length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, role_id: roles[0].id }),
    });
  }

  const composerRes = await fetch(`${supabaseUrl}/rest/v1/composers?user_id=eq.${userId}&select=id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  if ((await composerRes.json() || []).length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/composers`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId }),
    });
  }

  return c.json({ success: true });
});

app.post('/api/admin/users/:id/promote-admin', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const userId = c.req.param('id');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const roleRes = await fetch(`${supabaseUrl}/rest/v1/roles?name=eq.admin&select=id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  const roles = await roleRes.json();
  if (!roles[0]?.id) return c.json({ error: 'Admin role not found' }, 404);

  const existingRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}&role_id=eq.${roles[0].id}&select=user_id`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  if ((await existingRes.json() || []).length === 0) {
    await fetch(`${supabaseUrl}/rest/v1/user_roles`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ user_id: userId, role_id: roles[0].id }),
    });
  }

  return c.json({ success: true });
});

app.post('/api/admin/users/:id/suspend', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const userId = c.req.param('id');
  await fetch(`${c.env.SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { 'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ is_active: false }),
  });
  return c.json({ success: true });
});

app.delete('/api/admin/users/:id', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const userId = c.req.param('id');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  await fetch(`${supabaseUrl}/rest/v1/composers?user_id=eq.${userId}`, { method: 'DELETE', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}`, { method: 'DELETE', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });
  await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, { method: 'DELETE', headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } });

  return c.json({ success: true });
});

app.get('/api/admin/compositions', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const res = await fetch(`${c.env.SUPABASE_URL}/rest/v1/compositions?select=*&order=created_at.desc`, {
    headers: { 'apikey': c.env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  return c.json(await res.json());
});

app.get('/api/admin/stats', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  const [usersRes, compsRes, purchasesRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/users?select=id&limit=1`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' } }),
    fetch(`${supabaseUrl}/rest/v1/compositions?select=id&limit=1`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' } }),
    fetch(`${supabaseUrl}/rest/v1/purchases?select=id&limit=1`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Prefer': 'count=exact' } }),
  ]);

  return c.json({
    totalUsers: parseInt(usersRes.headers.get('content-range')?.split('/')[1] || '0'),
    totalCompositions: parseInt(compsRes.headers.get('content-range')?.split('/')[1] || '0'),
    totalTransactions: parseInt(purchasesRes.headers.get('content-range')?.split('/')[1] || '0'),
    totalRevenue: 0,
  });
});

// ============================================================
// FALLBACK
// ============================================================

app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));
app.post('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default { fetch: app.fetch };
