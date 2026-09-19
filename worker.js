// Murekefu Music Hub Worker - Cloudflare D1 + Custom JWT Auth
import { Hono } from 'hono';

const app = new Hono();

// ========== HELPERS ==========

function base64url(input) {
  if (typeof input === 'string') {
    return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  const binary = Array.from(input).map(b => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'murekefu-salt-2026');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password, storedHash) {
  const hash = await hashPassword(password);
  return hash === storedHash;
}

async function createToken(payload, secret, expiresIn = 86400) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresIn };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signingInput = `${encodedHeader}.${encodedBody}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const encodedSig = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${signingInput}.${encodedSig}`;
}

async function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function generateId() {
  return crypto.randomUUID();
}

async function getUserByEmail(c, email) {
  const { results } = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).all();
  return results[0] || null;
}

async function getUserFromDb(c, id) {
  const { results } = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).all();
  return results[0] || null;
}

async function getUserRoles(c, userId) {
  const { results: userResults } = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).all();
  const userEmail = userResults[0]?.email;

  const { results } = await c.env.DB.prepare(
    'SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = ?'
  ).bind(userId).all();

  const roles = ['buyer'];
  results.forEach(r => {
    if (r.name && !roles.includes(r.name)) roles.push(r.name);
  });

  if (userEmail) {
    const { results: adminResults } = await c.env.DB.prepare(
      'SELECT id FROM admin_emails WHERE email = ? AND is_active = 1'
    ).bind(userEmail).all();
    if (adminResults.length > 0 && !roles.includes('admin')) {
      roles.push('admin');
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)'
      ).bind(userId, 'role_admin').run();
    }
  }
  return roles;
}

async function requireAuth(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return null;
  const user = await getUserFromDb(c, payload.sub);
  if (!user) return null;
  const roles = await getUserRoles(c, user.id);
  return { ...user, roles };
}

async function requireAdmin(c) {
  const user = await requireAuth(c);
  if (!user) return { error: 'Unauthorized', status: 401 };
  if (!user.roles.includes('admin')) return { error: 'Admin access required', status: 403 };
  return user;
}

const ASSIGNABLE_ROLES = new Set(['buyer', 'learner', 'composer', 'admin']);

async function assignRole(c, userId, roleName) {
  if (!ASSIGNABLE_ROLES.has(roleName)) return false;
  const { results } = await c.env.DB.prepare('SELECT id FROM roles WHERE name = ?').bind(roleName).all();
  if (!results[0]) return false;
  await c.env.DB.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(userId, results[0].id).run();
  return true;
}

async function removeRole(c, userId, roleName) {
  if (!ASSIGNABLE_ROLES.has(roleName) || roleName === 'buyer') return false;
  await c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = (SELECT id FROM roles WHERE name = ?)').bind(userId, roleName).run();
  return true;
}

// ========== AUTH ROUTES ==========

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password || password.length < 6) return c.json({ error: 'Email and password (6+ chars) required' }, 400);
  const existing = await getUserByEmail(c, email);
  if (existing) return c.json({ error: 'Email already registered' }, 409);
  const id = generateId();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)').bind(id, email, passwordHash, body.displayName || null).run();
  await c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, 'role_buyer').run();
  const token = await createToken({ sub: id, email, roles: ['buyer'] }, c.env.JWT_SECRET);
  return c.json({ token, user: { id, email, display_name: body.displayName, roles: ['buyer'] } });
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);
  const user = await getUserByEmail(c, email);
  if (!user || !user.password_hash) return c.json({ error: 'Invalid credentials' }, 401);
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);
  const roles = await getUserRoles(c, user.id);
  const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
  return c.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, roles } });
});

app.post('/api/auth/oauth/google', async (c) => {
  const body = await c.req.json();
  const { idToken } = body;
  if (!idToken) return c.json({ error: 'ID token required' }, 400);

  try {
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!tokenInfoRes.ok) {
      return c.json({ error: 'Google verification failed' }, 400);
    }
    const tokenInfo = await tokenInfoRes.json();

    const clientId = c.env.VITE_GOOGLE_CLIENT_ID;
    if (clientId && tokenInfo.aud !== clientId) {
      return c.json({ error: 'Invalid audience' }, 401);
    }

    if (!tokenInfo.email_verified) {
      return c.json({ error: 'Email not verified' }, 401);
    }

    const email = tokenInfo.email;
    const displayName = tokenInfo.name || null;
    const picture = tokenInfo.picture || null;

    let user = await getUserByEmail(c, email);
    if (!user) {
      const id = generateId();
      await c.env.DB.prepare('INSERT INTO users (id, email, display_name, avatar_url, email_verified) VALUES (?, ?, ?, ?, ?)')
        .bind(id, email, displayName, picture, 1).run();
      await c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)').bind(id, 'role_buyer').run();
      user = await getUserFromDb(c, id);
    }

    const roles = await getUserRoles(c, user.id);
    const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
    return c.json({ token, user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, roles } });
  } catch (e) {
    return c.json({ error: 'Google verification failed' }, 400);
  }
});

app.get('/api/auth/me', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url, phone: user.phone, roles: user.roles } });
});

app.post('/api/auth/refresh', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const roles = await getUserRoles(c, user.id);
  const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
  return c.json({ token, user: { ...user, roles } });
});

// ========== ROLE REQUESTS ==========

app.post('/api/request-role', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const { requestedRole } = body;
  if (!['learner', 'composer'].includes(requestedRole)) return c.json({ error: 'Unsupported role' }, 400);
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO role_requests (id, user_id, requested_role, status, requested_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, user.id, requestedRole, 'pending', new Date().toISOString()).run();
  return c.json({ success: true, requestId: id });
});

app.get('/api/request-role/status', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  // The account page requests the aggregate status without a role query parameter.
  // Return the shape it consumes, while still supporting a role-specific lookup.
  const requestedRole = c.req.query('requestedRole');
  const allowedRoles = ['composer', 'admin'];
  if (requestedRole && !allowedRoles.includes(requestedRole)) {
    return c.json({ error: 'Unsupported role' }, 400);
  }

  try {
    const query = requestedRole
      ? 'SELECT * FROM role_requests WHERE user_id = ? AND requested_role = ? ORDER BY requested_at DESC LIMIT 1'
      : 'SELECT * FROM role_requests WHERE user_id = ? ORDER BY requested_at DESC';
    const params = requestedRole ? [user.id, requestedRole] : [user.id];
    const { results } = await c.env.DB.prepare(query).bind(...params).all();

    if (requestedRole) return c.json({ request: results[0] || null });

    const latest = {};
    for (const row of results || []) {
      if (row.requested_role && !latest[row.requested_role]) latest[row.requested_role] = row;
    }
    return c.json({
      roles: await getUserRoles(c, user.id),
      requests: {
        composer: latest.composer?.status || 'none',
        admin: latest.admin?.status || 'none',
      },
    });
  } catch (error) {
    console.error('[request-role/status]', error);
    return c.json({ error: 'Unable to load role request status' }, 500);
  }
});

app.get('/api/request-role/invite-status', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const requestedRole = c.req.query('requestedRole') || 'composer';
  const { results: invites } = await c.env.DB.prepare(
    'SELECT * FROM invites WHERE email = ? AND used = 0'
  ).bind(user.email).all();
  if (invites.length > 0) {
    return c.json({ available: true, requestedRole, canAccept: true, invite: invites[0] });
  }
  return c.json({ available: false, requestedRole });
});

// ========== USERS ==========

app.get('/api/users/by-auth-uid/:authUid', async (c) => {
  const user = await getUserFromDb(c, c.req.param('authUid'));
  return c.json(user || {});
});

app.post('/api/users/ensure', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ success: true });
});

app.get('/api/users/:id', async (c) => {
  const user = await getUserFromDb(c, c.req.param('id'));
  return c.json(user || {});
});

app.get('/api/user/roles/:userId', async (c) => {
  const roles = await getUserRoles(c, c.req.param('userId'));
  return c.json({ roles });
});

// ========== ACCOUNT ==========

app.put('/api/account', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const body = await c.req.json();
  const { themeSettings, displayName, phone } = body;
  
  if (displayName !== undefined || phone !== undefined || themeSettings !== undefined) {
    await c.env.DB.prepare(
      'UPDATE users SET display_name = COALESCE(?, display_name), phone = COALESCE(?, phone), theme_settings = COALESCE(?, theme_settings) WHERE id = ?'
    ).bind(displayName, phone, themeSettings ? JSON.stringify(themeSettings) : null, user.id).run();
  }
  
  const updated = await getUserFromDb(c, user.id);
  
  return c.json({ 
    user: updated,
    theme_settings: updated?.theme_settings ? JSON.parse(updated.theme_settings) : themeSettings 
  });
});

// ========== COMPOSITIONS ==========

app.get('/api/compositions', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM compositions WHERE deleted = 0 ORDER BY created_at DESC LIMIT 100').all();
  return c.json(results);
});

app.get('/api/compositions/:id', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM compositions WHERE id = ?').bind(c.req.param('id')).all();
  return c.json(results[0] || {});
});

app.get('/api/compositions/composer/:composerId', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM compositions WHERE composer_id = ? AND deleted = 0 ORDER BY created_at DESC').bind(c.req.param('composerId')).all();
  return c.json(results);
});

app.post('/api/compositions', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO compositions (id, composer_id, title, description, category_id, price, file_url, thumbnail_url, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user.id, body.title, body.description || null, body.category_id || null, body.price || 0, body.file_url || null, body.thumbnail_url || null, body.is_published ? 1 : 0).run();
  return c.json({ success: true, id });
});

app.put('/api/compositions/:id', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE compositions SET title = ?, description = ?, category_id = ?, price = ?, file_url = ?, thumbnail_url = ?, is_published = ? WHERE id = ? AND composer_id = ?'
  ).bind(body.title, body.description || null, body.category_id || null, body.price || 0, body.file_url || null, body.thumbnail_url || null, body.is_published ? 1 : 0, c.req.param('id'), user.id).run();
  return c.json({ success: true });
});

app.delete('/api/compositions/:id', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('UPDATE compositions SET deleted = 1 WHERE id = ? AND composer_id = ?').bind(c.req.param('id'), user.id).run();
  return c.json({ success: true });
});

// ========== ARRANGEMENTS ==========

app.get('/api/arrangements', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM arrangements WHERE deleted = 0 ORDER BY created_at DESC LIMIT 100').all();
  return c.json(results);
});

app.get('/api/arrangements/:id', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM arrangements WHERE id = ?').bind(c.req.param('id')).all();
  return c.json(results[0] || {});
});

app.post('/api/arrangements', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO arrangements (id, arranger_id, title, description, category_id, price, file_url, thumbnail_url, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, user.id, body.title, body.description || null, body.category_id || null, body.price || 0, body.file_url || null, body.thumbnail_url || null, body.is_published ? 1 : 0).run();
  return c.json({ success: true, id });
});

app.put('/api/arrangements/:id', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE arrangements SET title = ?, description = ?, category_id = ?, price = ?, file_url = ?, thumbnail_url = ?, is_published = ? WHERE id = ? AND arranger_id = ?'
  ).bind(body.title, body.description || null, body.category_id || null, body.price || 0, body.file_url || null, body.thumbnail_url || null, body.is_published ? 1 : 0, c.req.param('id'), user.id).run();
  return c.json({ success: true });
});

app.delete('/api/arrangements/:id', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await c.env.DB.prepare('UPDATE arrangements SET deleted = 1 WHERE id = ? AND arranger_id = ?').bind(c.req.param('id'), user.id).run();
  return c.json({ success: true });
});

// ========== CATEGORIES ==========

app.get('/api/categories', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM categories ORDER BY name').all();
  return c.json(results);
});

// ========== PURCHASES ==========

app.get('/api/purchases', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB.prepare('SELECT * FROM purchases WHERE buyer_id = ? ORDER BY created_at DESC').bind(user.id).all();
  return c.json(results);
});

app.get('/api/purchases/recommendations', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ recommendations: [] });
  const limit = parseInt(c.req.query('limit') || '6');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM compositions WHERE is_published = 1 AND deleted = 0 ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all();
  return c.json({ recommendations: results });
});

app.post('/api/purchases', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO purchases (id, buyer_id, composition_id, price_paid, payment_ref) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, user.id, body.composition_id, body.price || 0, body.payment_ref || null).run();
  return c.json({ success: true, id });
});

// ========== ENROLLMENTS ==========

app.get('/api/enrollments/my', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const limit = parseInt(c.req.query('limit') || '24');
  const { results } = await c.env.DB.prepare('SELECT * FROM enrollments WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').bind(user.id, limit).all();
  return c.json(results);
});

app.post('/api/enrollments', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO enrollments (id, user_id, composition_id, status) VALUES (?, ?, ?, ?)'
  ).bind(id, user.id, body.composition_id || null, 'pending').run();
  return c.json({ success: true, id });
});

// ========== REGISTRATION ==========

app.get('/api/registration/regulations', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM registration_regulations LIMIT 1'
  ).all();
  
  if (results.length > 0) {
    return c.json(results[0]);
  }
  
  return c.json({
    enrollmentFee: 0,
    composerRequestFee: 0,
    bankName: 'I&M Bank',
    bankAccountNumber: '0030 7335 5161 50',
    accountName: 'Murekefu Music Hub'
  });
});

app.get('/api/registration/payments/my', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  
  const type = c.req.query('type');
  let query = 'SELECT * FROM payment_submissions WHERE user_id = ?';
  const params = [user.id];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY submitted_at DESC';
  try {
    const { results } = await c.env.DB.prepare(query).bind(...params).all();
    return c.json(results || []);
  } catch (error) {
    console.error('[registration/payments/my]', error);
    return c.json({ error: 'Unable to load payment submissions' }, 500);
  }
});

// ========== SUPPORT ==========

app.get('/api/support/inbox', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const limit = parseInt(c.req.query('limit') || '100');
  const isAdmin = user.roles.includes('admin');
  let query = 'SELECT * FROM support_threads';
  const params = [];
  if (!isAdmin) { query += ' WHERE requester_user_id = ?'; params.push(user.id); }
  query += ' ORDER BY updated_at DESC LIMIT ?'; params.push(limit);
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ threads: results });
});

app.post('/api/support/threads', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO support_threads (id, requester_user_id, subject, context, status) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, user.id, body.subject || 'Support Request', body.context || null, 'open').run();
  if (body.message) {
    const msgId = generateId();
    await c.env.DB.prepare(
      'INSERT INTO support_messages (id, thread_id, sender_user_id, sender_role, message) VALUES (?, ?, ?, ?, ?)'
    ).bind(msgId, id, user.id, 'member', body.message).run();
  }
  return c.json({ success: true, threadId: id });
});

app.get('/api/support/threads/:id/messages', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const threadId = c.req.param('id');
  const { results: threads } = await c.env.DB.prepare(
    'SELECT * FROM support_threads WHERE id = ? LIMIT 1'
  ).bind(threadId).all();
  const thread = threads[0];
  if (!thread) return c.json({ message: 'That item could not be found. Please refresh and try again.' }, 404);
  const isAdmin = user.roles.includes('admin');
  if (!isAdmin && thread.requester_user_id !== user.id) return c.json({ message: 'Forbidden' }, 403);
  const { results: messages } = await c.env.DB.prepare(
    'SELECT * FROM support_messages WHERE thread_id = ? ORDER BY created_at ASC'
  ).bind(threadId).all();
  return c.json({ thread, messages: messages || [], admin: isAdmin, actorRole: isAdmin ? 'admin' : 'member' });
});

app.post('/api/support/threads/:id/messages', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const threadId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const message = String(body.message || '').trim();
  if (!message) return c.json({ message: 'Message is required' }, 400);
  const { results: threads } = await c.env.DB.prepare(
    'SELECT * FROM support_threads WHERE id = ? LIMIT 1'
  ).bind(threadId).all();
  const thread = threads[0];
  if (!thread) return c.json({ message: 'That item could not be found. Please refresh and try again.' }, 404);
  const isAdmin = user.roles.includes('admin');
  if (!isAdmin && thread.requester_user_id !== user.id) return c.json({ message: 'Forbidden' }, 403);
  const messageId = generateId();
  const senderRole = isAdmin ? 'admin' : 'member';
  await c.env.DB.prepare(
    'INSERT INTO support_messages (id, thread_id, sender_user_id, sender_role, message) VALUES (?, ?, ?, ?, ?)'
  ).bind(messageId, threadId, user.id, senderRole, message).run();
  await c.env.DB.prepare(
    "UPDATE support_threads SET updated_at = datetime('now'), is_admin_unread = ? WHERE id = ?"
  ).bind(isAdmin ? 0 : 1, threadId).run();
  const { results: saved } = await c.env.DB.prepare(
    'SELECT * FROM support_messages WHERE id = ? LIMIT 1'
  ).bind(messageId).all();
  const { results: updated } = await c.env.DB.prepare(
    'SELECT * FROM support_threads WHERE id = ? LIMIT 1'
  ).bind(threadId).all();
  return c.json({ success: true, thread: updated[0], message: saved[0], senderRole });
});

app.post('/api/support/threads/:id/read', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ message: 'Unauthorized' }, 401);
  const threadId = c.req.param('id');
  const { results: threads } = await c.env.DB.prepare(
    'SELECT * FROM support_threads WHERE id = ? LIMIT 1'
  ).bind(threadId).all();
  const thread = threads[0];
  if (!thread) return c.json({ message: 'That item could not be found. Please refresh and try again.' }, 404);
  const isAdmin = user.roles.includes('admin');
  if (!isAdmin && thread.requester_user_id !== user.id) return c.json({ message: 'Forbidden' }, 403);
  if (isAdmin) {
    await c.env.DB.prepare('UPDATE support_threads SET is_admin_unread = 0 WHERE id = ?').bind(threadId).run();
  }
  const { results: updated } = await c.env.DB.prepare(
    'SELECT * FROM support_threads WHERE id = ? LIMIT 1'
  ).bind(threadId).all();
  return c.json({ success: true, thread: updated[0], admin: isAdmin, actorRole: isAdmin ? 'admin' : 'member' });
});

// ========== ADMIN SUPPORT ==========

app.get('/api/support/admin/tickets', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query('limit') || '200');
  const { results } = await c.env.DB.prepare('SELECT * FROM support_threads ORDER BY updated_at DESC LIMIT ?').bind(limit).all();
  return c.json({ tickets: results });
});

app.get('/api/support/admin/threads', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query('limit') || '200');
  const state = c.req.query('state');
  let query = 'SELECT * FROM support_threads';
  const params = [];
  if (state && state !== 'all') {
    query += ' WHERE status = ?';
    params.push(state);
  }
  query += ' ORDER BY updated_at DESC LIMIT ?';
  params.push(limit);
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ threads: results });
});

// ========== ADMIN ==========

app.get('/api/admin/bootstrap', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results: roles } = await c.env.DB.prepare('SELECT * FROM roles').all();
  const { results: invites } = await c.env.DB.prepare('SELECT * FROM invites ORDER BY created_at DESC LIMIT 50').all();
  const { results: requests } = await c.env.DB.prepare("SELECT * FROM role_requests WHERE status = 'pending' ORDER BY requested_at DESC LIMIT 50").all();
  return c.json({ roles: roles || [], invites: invites || [], requests: requests || [], stats: { totalUsers: 0, totalCompositions: 0, totalTransactions: 0, totalRevenue: 0 } });
});

app.get('/api/admin/users', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results } = await c.env.DB.prepare('SELECT id, email, display_name, avatar_url, is_active, created_at FROM users ORDER BY created_at DESC').all();
  const { results: userRoles } = await c.env.DB.prepare('SELECT ur.user_id, r.id AS role_id, r.name AS role_name FROM user_roles ur JOIN roles r ON r.id = ur.role_id').all();
  const roleMap = new Map();
  (userRoles || []).forEach(row => {
    if (!roleMap.has(row.user_id)) roleMap.set(row.user_id, []);
    roleMap.get(row.user_id).push(row.role_name);
  });
  return c.json({ users: (results || []).map(u => ({ ...u, roles: roleMap.get(u.id) || ['buyer'] })), userRoles: userRoles || [] });
});

app.get('/api/admin/compositions', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results } = await c.env.DB.prepare('SELECT * FROM compositions ORDER BY created_at DESC').all();
  return c.json(results);
});

app.get('/api/admin/transactions', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query('limit') || '50');
  const { results } = await c.env.DB.prepare('SELECT * FROM purchases ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return c.json({ transactions: results });
});

app.get('/api/admin/enrollments', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query('limit') || '100');
  const status = c.req.query('status');
  let query = 'SELECT * FROM enrollments'; const params = [];
  if (status && status !== 'all') { query += ' WHERE status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT ?'; params.push(limit);
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ enrollments: results });
});

app.get('/api/admin/stats', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const { results: uc } = await c.env.DB.prepare('SELECT COUNT(*) as count FROM users').all();
  const { results: cc } = await c.env.DB.prepare('SELECT COUNT(*) as count FROM compositions WHERE deleted = 0').all();
  const { results: pc } = await c.env.DB.prepare('SELECT COUNT(*) as count FROM purchases').all();
  return c.json({ totalUsers: uc[0]?.count || 0, totalCompositions: cc[0]?.count || 0, totalTransactions: pc[0]?.count || 0, totalRevenue: 0 });
});

// GET /admin/invites — D1 implementation
app.get('/api/admin/invites', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM invites ORDER BY created_at DESC LIMIT 50'
  ).all();
  return c.json(results || []);
});

// POST /admin/invites — D1 implementation
app.post('/api/admin/invites', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!email) return c.json({ error: 'Email is required' }, 400);
  const invitedBy = body.invited_by || auth.user?.id;
  if (!invitedBy) return c.json({ error: 'Inviting admin could not be identified' }, 400);
  const id = crypto.randomUUID();
  try {
    await c.env.DB.prepare(
      'INSERT INTO invites (id, email, invited_by, requested_role, created_at, used) VALUES (?, ?, ?, ?, ?, 0)'
    ).bind(id, email, invitedBy, body.requested_role || 'composer', new Date().toISOString()).run();
    const { results } = await c.env.DB.prepare('SELECT * FROM invites WHERE id = ?').bind(id).all();
    return c.json(results?.[0] || { id, email, invited_by: invitedBy, requested_role: body.requested_role || 'composer', used: 0 }, 201);
  } catch (err) {
    if (String(err?.message || err).toLowerCase().includes('unique')) {
      return c.json({ error: 'An invite already exists for this email' }, 409);
    }
    return c.json({ error: 'Failed to create invite' }, 500);
  }
});

// DELETE /admin/invites/:email — D1 implementation
app.delete('/api/admin/invites/:email', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const email = decodeURIComponent(c.req.param('email') || '').trim().toLowerCase();
  await c.env.DB.prepare('DELETE FROM invites WHERE email = ?').bind(email).run();
  return c.json({ success: true });
});

// GET /admin/composer-requests — D1 implementation
app.get('/api/admin/composer-requests', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM role_requests WHERE status = 'pending' ORDER BY requested_at DESC LIMIT 50"
  ).all();
  return c.json({ requests: results || [] });
});

// POST /admin/users/:id/demote-composer — D1 implementation
app.post('/api/admin/users/:id/demote-composer', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const userId = c.req.param('id');
  await c.env.DB.prepare(
    "DELETE FROM user_roles WHERE user_id = ? AND role_id = (SELECT id FROM roles WHERE name = 'composer')"
  ).bind(userId).run();
  return c.json({ success: true });
});

// POST /admin/users/:id/demote-admin — D1 implementation
app.post('/api/admin/users/:id/demote-admin', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const userId = c.req.param('id');
  if (userId === auth.user?.id) return c.json({ error: 'You cannot remove your own admin role' }, 400);
  await c.env.DB.prepare(
    "DELETE FROM user_roles WHERE user_id = ? AND role_id = (SELECT id FROM roles WHERE name = 'admin')"
  ).bind(userId).run();
  return c.json({ success: true });
});

// POST /admin/users/:id/unsuspend — D1 implementation
app.post('/api/admin/users/:id/unsuspend', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);
  const userId = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET is_active = 1 WHERE id = ?').bind(userId).run();
  return c.json({ success: true });
});

// POST /admin/role-requests/:userId/reject
app.post('/api/admin/role-requests/:userId/reject', async (c) => {
  const auth = await requireAdmin(c);
  if (auth.error) return c.json({ error: auth.error }, auth.status);

  const userId = c.req.param('userId');
  await c.env.DB.prepare("UPDATE role_requests SET status = 'rejected' WHERE user_id = ? AND status = 'pending'").bind(userId).run();
  return c.json({ success: true });
});

app.post('/api/admin/role-requests/:userId/accept', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('userId');
  const body = await c.req.json().catch(() => ({}));
  const requestedRole = body.requestedRole || 'composer';
  if (!['learner', 'composer'].includes(requestedRole)) return c.json({ error: 'Unsupported role' }, 400);
  if (!await assignRole(c, userId, requestedRole)) return c.json({ error: 'Role not configured' }, 500);
  await c.env.DB.prepare("UPDATE role_requests SET status = 'approved' WHERE user_id = ? AND requested_role = ? AND status = 'pending'").bind(userId, requestedRole).run();
  return c.json({ success: true });
});

app.post('/api/admin/role-requests/:userId/reject', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('userId');
  await c.env.DB.prepare("UPDATE role_requests SET status = 'rejected' WHERE user_id = ? AND status = 'pending'").bind(userId).run();
  return c.json({ success: true });
});

app.post('/api/admin/users/:id/promote-composer', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  await assignRole(c, userId, 'composer');
  return c.json({ success: true });
});

app.post('/api/admin/users/:id/promote-admin', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  await assignRole(c, userId, 'admin');
  return c.json({ success: true });
});

app.post('/api/admin/users/:id/demote-composer', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  await removeRole(c, userId, 'composer');
  return c.json({ success: true });
});

app.post('/api/admin/users/:id/demote-admin', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  if (userId === admin.id) return c.json({ error: 'You cannot remove your own admin role' }, 400);
  await removeRole(c, userId, 'admin');
  return c.json({ success: true });
});

app.post('/api/admin/users/:id/roles', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  const body = await c.req.json();
  const roleName = String(body.role || '').trim().toLowerCase();
  if (!ASSIGNABLE_ROLES.has(roleName)) return c.json({ error: 'Unsupported role' }, 400);
  if (!await assignRole(c, userId, roleName)) return c.json({ error: 'Role not configured' }, 500);
  return c.json({ success: true, roles: await getUserRoles(c, userId) });
});

app.delete('/api/admin/users/:id/roles/:role', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  const roleName = String(c.req.param('role') || '').trim().toLowerCase();
  if (userId === admin.id && roleName === 'admin') return c.json({ error: 'You cannot remove your own admin role' }, 400);
  if (!await removeRole(c, userId, roleName)) return c.json({ error: 'Unsupported role' }, 400);
  return c.json({ success: true, roles: await getUserRoles(c, userId) });
});

app.post('/api/admin/users/:id/suspend', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(userId).run();
  return c.json({ success: true });
});

app.post('/api/admin/users/:id/unsuspend', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  await c.env.DB.prepare('UPDATE users SET is_active = 1 WHERE id = ?').bind(userId).run();
  return c.json({ success: true });
});

app.delete('/api/admin/users/:id', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const userId = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?').bind(userId).run();
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return c.json({ success: true });
});

// ========== UPLOAD ==========

app.post('/api/upload/work', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const contentType = c.req.header('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file');
      const type = formData.get('type') || 'composition';

      if (!file) {
        return c.json({ error: 'No file provided' }, 400);
      }

      const fileExt = file.name.split('.').pop() || 'bin';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const fileId = generateId();
      await c.env.DB.prepare(
        'INSERT INTO files (id, user_id, file_name, file_type, file_size, bucket) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(fileId, user.id, fileName, file.type || 'application/octet-stream', file.size, type === 'arrangement' ? 'arrangements' : 'compositions').run();

      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const dataUrl = `data:${file.type || 'application/octet-stream'};base64,${base64}`;

      return c.json({ success: true, url: dataUrl, fileId, fileName });
    }

    return c.json({ error: 'Invalid content type' }, 400);
  } catch (err) {
    return c.json({ error: 'Upload failed: ' + err.message }, 500);
  }
});

// ========== MEDIA ==========

app.get('/api/media/landing-images', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM compositions WHERE is_published = 1 AND deleted = 0 AND thumbnail_url IS NOT NULL ORDER BY created_at DESC LIMIT 12'
  ).all();
  return c.json({ items: results.map(r => ({ src: { large: r.thumbnail_url }, alt: r.title })) });
});

app.get('/api/media/composition-background', async (c) => {
  const title = c.req.query('title') || 'music';
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM compositions WHERE is_published = 1 AND deleted = 0 AND thumbnail_url IS NOT NULL AND title LIKE ? ORDER BY created_at DESC LIMIT 1'
  ).bind(`%${title}%`).all();
  return c.json({ items: results.map(r => ({ src: { large: r.thumbnail_url }, alt: r.title })) });
});

app.post('/api/upload/community', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json({ success: true, url: '', path: '' });
});

// ========== ADMIN: PAYMENT SUBMISSIONS ==========

app.get('/api/admin/payment-submissions', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query('limit') || '200');
  const { results } = await c.env.DB.prepare('SELECT * FROM payment_submissions ORDER BY submitted_at DESC LIMIT ?').bind(limit).all();
  return c.json(results || []);
});

app.get('/api/admin/purchases', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const limit = parseInt(c.req.query('limit') || '200');
  const { results } = await c.env.DB.prepare('SELECT * FROM purchases ORDER BY created_at DESC LIMIT ?').bind(limit).all();
  return c.json(results || []);
});

// ========== ADMIN: REPORTS CRUD ==========

app.post('/api/admin/reports', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO reports (id, reported_by, composition_id, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.reported_by, body.composition_id, body.reason, body.details || null, 'pending', new Date().toISOString()).run();
  return c.json({ id, success: true });
});

app.get('/api/admin/reports', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const status = c.req.query('status');
  let query = 'SELECT * FROM reports';
  const params = [];
  if (status && status !== 'all') { query += ' WHERE status = ?'; params.push(status); }
  query += ' ORDER BY created_at DESC LIMIT 200';
  const { results } = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(results || []);
});

app.patch('/api/admin/reports/:id', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);
  const reportId = c.req.param('id');
  const body = await c.req.json();
  const updates = [];
  const params = [];
  if (body.admin_notes !== undefined) { updates.push('admin_notes = ?'); params.push(body.admin_notes); }
  if (body.status !== undefined) { updates.push('status = ?'); params.push(body.status); }
  if (updates.length > 0) {
    updates.push('resolved_at = ?'); params.push(new Date().toISOString());
    params.push(reportId);
    await c.env.DB.prepare(`UPDATE reports SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }
  if (body.resolve_composition) {
    const { results } = await c.env.DB.prepare('SELECT composition_id FROM reports WHERE id = ?').bind(reportId).all();
    if (results[0]?.composition_id) {
      await c.env.DB.prepare('UPDATE compositions SET deleted = 1 WHERE id = ?').bind(results[0].composition_id).run();
    }
  }
  return c.json({ success: true });
});

// ========== HEALTH & SEO ==========

app.get('/api/health', (c) => c.json({ ok: true, service: 'murekefu-music-hub', backend: 'd1' }));

// ========== GOOGLE SEARCH ==========

async function getGoogleAccessToken(serviceAccount) {
  const { client_email, private_key } = serviceAccount;
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaim = base64url(JSON.stringify(claim));
  const signingInput = `${encodedHeader}.${encodedClaim}`;

  const keyData = atob(private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\n/g, ''));
  const keyArray = new Uint8Array(keyData.length);
  for (let i = 0; i < keyData.length; i++) {
    keyArray[i] = keyData.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyArray.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(String.fromCharCode(...new Uint8Array(sig)))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  return data.access_token;
}

app.post('/api/seo/submit-url', async (c) => {
  const admin = await requireAdmin(c);
  if (admin.error) return c.json({ error: admin.error }, admin.status);

  const body = await c.req.json();
  const url = body.url;
  if (!url) return c.json({ error: 'URL required' }, 400);

  try {
    const serviceAccount = JSON.parse(c.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });

    if (!res.ok) {
      const err = await res.json();
      return c.json({ error: 'Indexing failed', details: err }, 400);
    }

    return c.json({ success: true, url });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// Sitemap.xml - dynamic with all pages
app.get('/sitemap.xml', async (c) => {
  const baseUrl = 'https://murekefumusichub.fredrickmakori102.workers.dev';
  
  const { results: compositions } = await c.env.DB.prepare(
    'SELECT id FROM compositions WHERE deleted = 0 AND is_published = 1 ORDER BY created_at DESC LIMIT 1000'
  ).all();

  const { results: arrangements } = await c.env.DB.prepare(
    'SELECT id FROM arrangements WHERE deleted = 0 AND is_published = 1 ORDER BY created_at DESC LIMIT 1000'
  ).all();

  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/marketplace', priority: '0.9', changefreq: 'daily' },
    { url: '/my-compositions', priority: '0.8', changefreq: 'weekly' },
    { url: '/my-arrangements', priority: '0.8', changefreq: 'weekly' },
    { url: '/enroll', priority: '0.7', changefreq: 'weekly' },
    { url: '/help', priority: '0.6', changefreq: 'monthly' },
    { url: '/about', priority: '0.5', changefreq: 'monthly' },
    { url: '/contact', priority: '0.5', changefreq: 'monthly' },
    { url: '/privacy-policy', priority: '0.3', changefreq: 'monthly' },
  ];

  let urlEntries = staticPages.map(p => `
  <url>
    <loc>${baseUrl}${p.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n');

  if (compositions) {
    compositions.forEach(comp => {
      urlEntries += `
  <url>
    <loc>${baseUrl}/marketplace/${comp.id}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });
  }

  if (arrangements) {
    arrangements.forEach(arr => {
      urlEntries += `
  <url>
    <loc>${baseUrl}/my-arrangements/${arr.id}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });
  }

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`, {
    status: 200,
    headers: { 'Content-Type': 'application/xml' },
  });
});

// Robots.txt
app.get('/robots.txt', (c) => {
  return new Response(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /auth/

Sitemap: https://murekefumusichub.fredrickmakori102.workers.dev/sitemap.xml`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
});

// ========== CATCH-ALL ==========

app.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    url.searchParams.set('_v', Date.now().toString());
    const freshReq = new Request(url, { headers: c.req.headers, method: c.req.method });
    const res = await c.env.ASSETS.fetch(freshReq);
    let html = await res.text();
    html = html.replace(/(src="[^"]*index-[A-Za-z0-9_]+\.js")/, (match) => match.replace('.js', '.js?v=' + Date.now()));
    html = html.replace(/<link[^>]*rel=["']icon["'][^>]*href=["']\/favicon\.ico["'][^>]*\/?>/gi, '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🎵%3C/text%3E%3C/svg%3E" />');
    return new Response(html, { status: res.status, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
  } catch { return c.env.ASSETS.fetch(c.req.raw); }
});

app.get('/admin', async (c) => {
  try {
    const res = await c.env.ASSETS.fetch(new Request('http://placeholder/index.html'));
    let html = await res.text();
    html = html.replace(/(src="[^"]*index-[A-Za-z0-9_]+\.js")/, (match) => match.replace('.js', '.js?v=' + Date.now()));
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
  } catch { return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 200 }); }
});

app.get('/auth/callback', async (c) => {
  try {
    const res = await c.env.ASSETS.fetch(new Request('http://placeholder/index.html'));
    let html = await res.text();
    html = html.replace(/(src="[^"]*index-[A-Za-z0-9_]+\.js")/, (match) => match.replace('.js', '.js?v=' + Date.now()));
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
  } catch { return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 200 }); }
});

// Catch-all for SPA routing
app.get('*', async (c) => {
  if (c.req.url.includes('/favicon.ico')) {
    const assetRes = await c.env.ASSETS.fetch(new Request('http://placeholder/assets/system-logo-cutout-BEqeFQzS.png'));
    if (assetRes.status === 200) {
      return new Response(assetRes.body, { status: 200, headers: { 'Content-Type': 'image/png' } });
    }
  }
  if (c.req.path.startsWith('/api/')) return c.notFound();
  
  const assetRes = await c.env.ASSETS.fetch(c.req.raw);
  if (assetRes.status === 200) {
    const newHeaders = new Headers(assetRes.headers);
    newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return new Response(assetRes.body, { status: 200, headers: newHeaders });
  }
  
  try {
    const res = await c.env.ASSETS.fetch(new Request('http://placeholder/index.html'));
    let html = await res.text();
    html = html.replace(/(src="[^"]*index-[A-Za-z0-9_]+\.js")/, (match) => match.replace('.js', '.js?v=' + Date.now()));
    return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-cache, no-store, must-revalidate' } });
  } catch {
    return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 200 });
  }
});

export default { fetch: app.fetch };
