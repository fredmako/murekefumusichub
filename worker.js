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
  const body = await c.req.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
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

app.get('/api/auth/oauth/google', async (c) => {
  const clientId = c.env.VITE_GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID;
  // Always use canonical non-www domain for Google OAuth (must match Google Console exactly)
  const redirectUri = 'https://murekefumusichub.studio/auth/callback';
  if (!clientId) return c.json({ error: 'Google OAuth not configured' }, 500);
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&access_type=offline`;
  return c.json({ url: authUrl });
});

app.post('/api/auth/oauth/google/callback', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { code, redirect_uri } = body;
  if (!code) return c.json({ error: 'Authorization code required' }, 400);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.VITE_GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID || '',
        client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirect_uri || 'https://murekefumusichub.studio/auth/callback',
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[oauth/callback] token exchange failed:', errBody);
      return c.json({ error: 'Google token exchange failed' }, 400);
    }
    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;
    if (!idToken) return c.json({ error: 'No ID token from Google' }, 400);

    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!tokenInfoRes.ok) return c.json({ error: 'Google verification failed' }, 400);
    const tokenInfo = await tokenInfoRes.json();

    const expectedAud = c.env.VITE_GOOGLE_CLIENT_ID || c.env.GOOGLE_CLIENT_ID;
    if (expectedAud && tokenInfo.aud !== expectedAud) return c.json({ error: 'Invalid audience' }, 401);
    if (!tokenInfo.email_verified) return c.json({ error: 'Email not verified' }, 401);

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

// JSON.parse that never throws.
//
// Several tables store JSON as TEXT (users.theme_settings, and various
// *_json columns). A single malformed row must not 500 the whole response —
// return null and let the caller fall back.
function safeParseJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// Shape the user record for API responses.
//
// NEVER spread the raw D1 row: it contains `password_hash`, and a bare
// `{ ...user }` leaked the hash in the /api/auth/refresh response. Always
// project the exact fields allowed out of the Worker.
function publicUser(user, roles) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    phone: user.phone,
    roles: roles || user.roles || [],
  };
}

app.get('/api/auth/me', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const roles = await getUserRoles(c, user.id);
  return c.json({ user: publicUser(user, roles) });
});

// Alias for backward compatibility (some cached frontends call /api/auth/verify)
app.get('/api/auth/verify', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const roles = await getUserRoles(c, user.id);
  return c.json({ user: publicUser(user, roles) });
});

app.post('/api/auth/refresh', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const roles = await getUserRoles(c, user.id);
  const token = await createToken({ sub: user.id, email: user.email, roles }, c.env.JWT_SECRET);
  // NOTE: never `{ ...user }` here — see publicUser() above.
  return c.json({ token, user: publicUser(user, roles) });
});

// Change the signed-in user's password.
app.post('/api/auth/update-password', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }
  const newPassword = String(payload.password || '');
  if (newPassword.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const currentPassword = String(payload.current_password || payload.currentPassword || '');
  if (currentPassword) {
    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) return c.json({ error: 'Current password is incorrect' }, 403);
  }

  const hash = await hashPassword(newPassword);
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();

  return c.json({ success: true, user: publicUser(user, await getUserRoles(c, user.id)) });
});

// Password reset request.
//
// No mail relay is configured on this Worker, so the honest response is to say
// so rather than return 200 and leave the user waiting for an email that will
// never arrive. Wire an email provider (e.g. Resend) and add a reset_tokens
// table, then replace this body with a real token-issuing flow.
app.post('/api/auth/reset-password', async (c) => {
  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) return c.json({ error: 'Email is required' }, 400);

  const user = await getUserByEmail(c, email);
  if (!user || !user.is_active) {
    // Do not reveal whether the account exists.
    return c.json({
      success: false,
      error: 'Password reset is not available yet. Please contact an administrator.',
    }, 503);
  }

  return c.json({
    success: false,
    error: 'Password reset email delivery is not configured. Please contact an administrator.',
  }, 503);
});

// Stateless JWTs cannot be revoked server-side, so logout only acknowledges
// and the client drops the token. It MUST exist: api-client.ts calls
// /api/auth/logout on signOut, and a 404 there used to surface as a confusing
// fetch failure instead of a clean sign-out.
app.post('/api/auth/logout', async (c) => {
  return c.json({ success: true });
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

// Profile lookup by the token's `sub`.
//
// NOTE: AuthContext expects a BARE user object here (`finalUser.display_name`,
// `finalUser.avatar_url`, `finalUser.theme_settings`), NOT a `{ user: ... }`
// wrapper. Returning the wrapper left every field undefined, so the profile
// sync silently produced an empty user. Project through publicUser() so
// password_hash can never leak, and include the theme/phone fields the
// frontend reads.
app.get('/api/users/by-auth-uid/:authUid', async (c) => {
  const authUid = c.req.param('authUid');
  const row = await getUserFromDb(c, authUid);
  if (!row) return c.json({}, 404);
  const roles = await getUserRoles(c, row.id);
  return c.json({
    id: row.id,
    auth_uid: row.id,
    email: row.email,
    display_name: row.display_name,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url,
    theme_settings: row.theme_settings ? safeParseJson(row.theme_settings) : null,
    is_active: row.is_active,
    created_at: row.created_at,
    roles,
  });
});

// Ensure a user row exists for the signed-in identity.
//
// Previously this returned `{ success: true }` without doing anything, so the
// frontend's follow-up "fetch the row back" always 404'd. It now upserts on
// the token's `sub`, which is the same id the users table is keyed by for this
// auth model.
app.post('/api/users/ensure', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }

  // Already present (requireAuth loaded it from D1) — just report it back.
  const roles = await getUserRoles(c, user.id);

  // Ensure the default buyer role exists for brand-new accounts.
  const { results: existingRoles } = await c.env.DB
    .prepare('SELECT role_id FROM user_roles WHERE user_id = ?')
    .bind(user.id)
    .all();
  if (!existingRoles || existingRoles.length === 0) {
    await c.env.DB
      .prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)')
      .bind(user.id, 'role_buyer')
      .run();
  }

  if (payload.display_name && !user.display_name) {
    await c.env.DB
      .prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .bind(payload.display_name, user.id)
      .run();
  }
  if (payload.avatar_url && !user.avatar_url) {
    await c.env.DB
      .prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
      .bind(payload.avatar_url, user.id)
      .run();
  }

  return c.json({
    success: true,
    user: {
      id: user.id,
      auth_uid: user.id,
      email: user.email,
      display_name: user.display_name || payload.display_name || null,
      phone: user.phone ?? null,
      avatar_url: user.avatar_url || payload.avatar_url || null,
      theme_settings: user.theme_settings ? safeParseJson(user.theme_settings) : null,
      roles,
    },
  });
});

app.get('/api/users/:id', async (c) => {
  const row = await getUserFromDb(c, c.req.param('id'));
  if (!row) return c.json({}, 404);
  const roles = await getUserRoles(c, row.id);
  return c.json({ ...publicUser(row, roles), auth_uid: row.id, theme_settings: row.theme_settings ? safeParseJson(row.theme_settings) : null });
});

// Roles as a BARE array.
//
// AuthContext does `const res = await fetch(...); const roles = await res.json();
// if (Array.isArray(roles))` — a `{ roles: [...] }` wrapper fails that
// Array.isArray check and every user silently fell back to ['buyer'], which is
// why admins saw the buyer dashboard. The value is an array, not an object.
app.get('/api/user/roles/:userId', async (c) => {
  const roles = await getUserRoles(c, c.req.param('userId'));
  return c.json(roles);
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

// NOTE: four admin routes (demote-composer, demote-admin, unsuspend,
// role-requests/:userId/reject) were registered twice — an earlier Supabase-era
// block and a later D1 block. Hono matches in registration order, so the FIRST
// copy silently won and the D1 versions below were dead code. The duplicate
// block has been removed so the D1 implementations are the ones that run.

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

// Generic upload endpoint - matches frontend calls to /upload/:bucket
// Also handle /api/upload/:bucket for direct API access
const UPLOAD_BUCKETS = new Set(['compositions', 'thumbnails', 'avatars', 'arrangements']);

app.post('/upload/:bucket', async (c) => {
  const bucket = c.req.param('bucket');
  if (!UPLOAD_BUCKETS.has(bucket)) return c.json({ error: 'Invalid bucket' }, 400);
  return handleUpload(c, bucket);
});

app.post('/api/upload/:bucket', async (c) => {
  const bucket = c.req.param('bucket');
  if (!UPLOAD_BUCKETS.has(bucket)) return c.json({ error: 'Invalid bucket' }, 400);
  return handleUpload(c, bucket);
});

// Upload a file to R2 when the bucket is bound, otherwise fall back to an
// inline data URL.
//
// R2 is not yet enabled on this Cloudflare account (the R2 API returns
// code 10042, "Please enable R2 through the Cloudflare Dashboard"), and enabling
// it is a one-time dashboard action. Everything here is written so that simply
// adding an `r2_buckets` binding to wrangler.jsonc switches storage over with
// no further code change.
//
// Why the fallback exists at all: the previous implementation always built a
// data URL, which (a) cannot serve a PDF from a URL, and (b) inflated every
// upload by ~33% and forced the whole file through JSON.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// base64-encode an ArrayBuffer without spreading it into String.fromCharCode.
// `String.fromCharCode(...new Uint8Array(buf))` passes one argument per byte
// and blows the call stack (RangeError) for any real file — the existing D1
// rows are 135 KB PDFs, well past the limit. Chunked conversion is required.
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000; // 32 KB — safe for apply() argument limits
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function extensionFor(file) {
  const fromName = (file.name || '').split('.').pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return (file.type || 'application/octet-stream').split('/')[1] || 'bin';
}

/**
 * Persist one uploaded file.
 *
 * Returns `{ url, key, storage }` where `url` is an R2 object URL when the
 * bucket is bound, and an inline data URL otherwise. The object key is always
 * recorded in the `files` table so a later migration to R2 can find the
 * metadata even for files uploaded while the fallback was in use.
 */
async function storeUpload(c, user, file, bucketLabel) {
  if (!file) return { error: 'No file provided', status: 400 };

  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `File too large (max ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`,
      status: 400,
    };
  }

  const ext = extensionFor(file);
  const key = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const fileId = generateId();
  const contentType = file.type || 'application/octet-stream';
  const arrayBuffer = await file.arrayBuffer();

  await c.env.DB
    .prepare(
      'INSERT INTO files (id, user_id, file_name, file_type, file_size, bucket) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(fileId, user.id, key, contentType, file.size ?? arrayBuffer.byteLength, bucketLabel)
    .run();

  // Preferred path: R2.
  if (c.env.STORAGE) {
    try {
      await c.env.STORAGE.put(key, arrayBuffer, {
        httpMetadata: { contentType },
      });
      return {
        url: `/api/media/thumbnail/${encodeURIComponent(key)}`,
        fileId,
        fileName: key,
        storage: 'r2',
      };
    } catch (err) {
      // Fall through to the inline fallback rather than losing the upload.
      console.error('[upload] R2 put failed, falling back to inline:', err && err.message);
    }
  }

  const dataUrl = `data:${contentType};base64,${arrayBufferToBase64(arrayBuffer)}`;
  return { url: dataUrl, fileId, fileName: key, storage: 'inline' };
}

async function handleUpload(c, bucket) {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return c.json({ error: 'Invalid content type' }, 400);
    }

    const formData = await c.req.formData();
    const result = await storeUpload(c, user, formData.get('file'), bucket);
    if (result.error) return c.json({ error: result.error }, result.status || 400);

    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: 'Upload failed: ' + err.message }, 500);
  }
}

app.post('/api/upload/work', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return c.json({ error: 'Invalid content type' }, 400);
    }

    const formData = await c.req.formData();
    const type = formData.get('type') || 'composition';
    const result = await storeUpload(
      c,
      user,
      formData.get('file'),
      type === 'arrangement' ? 'arrangements' : 'compositions',
    );
    if (result.error) return c.json({ error: result.error }, result.status || 400);

    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: 'Upload failed: ' + err.message }, 500);
  }
});

// ========== MEDIA ==========
//
// Both routes below are shape-compatible with the Pexels response the frontend
// expects (see src/services/api.ts): { items: [{ src: { large }, alt }] }.
// They source imagery from published compositions rather than Pexels, so when
// there is nothing published they return an EMPTY items array — which the UI
// already treats as "no imagery" and falls back gracefully.

const MEDIA_SELECT = `
  SELECT id, title, thumbnail_r2_key
  FROM compositions
  WHERE is_published = 1 AND deleted = 0
    AND thumbnail_r2_key IS NOT NULL AND thumbnail_r2_key != ''
`;

function toMediaItems(rows) {
  return rows.map((r) => ({
    id: r.id,
    photographer: 'Mureke Fumusi Hub',
    width: null,
    height: null,
    alt: r.title,
    url: null,
    src: {
      large2x: null,
      large: `/api/media/thumbnail/${encodeURIComponent(r.thumbnail_r2_key)}`,
      landscape: null,
      medium: null,
    },
  }));
}

app.get('/api/media/landing-images', async (c) => {
  const limit = Math.min(parseInt(c.req.query('perPage') || '12', 10) || 12, 50);
  try {
    // NOTE: the column is `thumbnail_r2_key`, NOT `thumbnail_url`. Querying a
    // non-existent column is what made this endpoint return a 500.
    const { results } = await c.env.DB
      .prepare(`${MEDIA_SELECT} ORDER BY created_at DESC LIMIT ?`)
      .bind(limit)
      .all();
    return c.json({ source: 'compositions', items: toMediaItems(results || []) });
  } catch (err) {
    console.error('[media] landing-images failed:', err && err.message);
    // Degrade to empty rather than 500 — a hero image failure must not take out
    // the homepage.
    return c.json({ source: 'compositions', items: [], warning: 'media_unavailable' });
  }
});

app.get('/api/media/composition-background', async (c) => {
  const title = c.req.query('title') || '';
  try {
    // If no composition matches the title, fall back to any published
    // thumbnail so a detail page still gets imagery instead of nothing.
    let rows = [];
    if (title) {
      const match = await c.env.DB
        .prepare(`${MEDIA_SELECT} AND title LIKE ? ORDER BY created_at DESC LIMIT 1`)
        .bind(`%${title}%`)
        .all();
      rows = match.results || [];
    }
    if (rows.length === 0) {
      const any = await c.env.DB
        .prepare(`${MEDIA_SELECT} ORDER BY created_at DESC LIMIT 1`)
        .all();
      rows = any.results || [];
    }
    return c.json({ source: 'compositions', items: toMediaItems(rows) });
  } catch (err) {
    console.error('[media] composition-background failed:', err && err.message);
    return c.json({ source: 'compositions', items: [], warning: 'media_unavailable' });
  }
});

// Serve a composition thumbnail by its R2 object key.
//
// NOTE: no R2 bucket binding is configured in wrangler.jsonc today, so this
// returns a JSON 404 rather than an object. The route exists so the URL emitted
// by toMediaItems() is never a dangling 404-from-the-catch-all, and so adding an
// `r2_buckets` binding later makes thumbnails work with no further code change.
app.get('/api/media/thumbnail/*', async (c) => {
  const bucket = c.env.STORAGE;
  if (!bucket) return c.json({ error: 'storage_not_configured' }, 404);
  const key = decodeURIComponent(c.req.param('0') || '');
  if (!key) return c.json({ error: 'missing_key' }, 400);
  try {
    const object = await bucket.get(key);
    if (!object) return c.json({ error: 'not_found' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.etag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(object.body, { status: 200, headers });
  } catch (err) {
    console.error('[media] thumbnail fetch failed:', err && err.message);
    return c.json({ error: 'thumbnail_unavailable' }, 500);
  }
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
app.get('/health', (c) => c.json({ ok: true, service: 'murekefu-music-hub', backend: 'd1' }));

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

// ========== CHECKOUT (manual M-Pesa) ==========
//
// The frontend calls these (src/services/api.ts checkoutService) but the Worker
// had no route, so checkout 404'd. Payments are recorded as `pending` and
// confirmed by an admin — no M-Pesa Daraja call is made here, because the
// B2C/STK push flow needs a till/shortcode this deployment does not have.

app.post('/api/checkout/submit', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }
  const mpesaCode = String(payload.mpesaCode || '').trim();
  const items = Array.isArray(payload.items) ? payload.items : [];

  if (!mpesaCode) return c.json({ error: 'mpesaCode is required' }, 400);
  if (!items.length) return c.json({ error: 'No items provided' }, 400);

  const ids = [...new Set(items.map((i) => i && i.composition_id).filter(Boolean))];
  if (!ids.length) return c.json({ error: 'No composition ids provided' }, 400);

  // Load the real prices from the DB rather than trusting client-sent amounts.
  const placeholders = ids.map(() => '?').join(',');
  const { results: comps } = await c.env.DB
    .prepare(
      `SELECT id, title, price, price_currency, is_published, deleted
       FROM compositions WHERE id IN (${placeholders})`
    )
    .bind(...ids)
    .all();
  const compMap = new Map((comps || []).map((r) => [r.id, r]));

  const unavailable = ids.filter((id) => {
    const r = compMap.get(id);
    return !r || r.deleted === 1 || r.is_published === 0;
  });
  if (unavailable.length) {
    return c.json({ error: 'Not found or not published', composition_ids: unavailable }, 400);
  }

  // Skip what the buyer already owns or already has pending.
  const { results: existing } = await c.env.DB
    .prepare(
      `SELECT composition_id, status FROM purchases
       WHERE buyer_id = ? AND composition_id IN (${placeholders}) AND status IN ('pending','completed')`
    )
    .bind(user.id, ...ids)
    .all();
  const owned = new Set();
  const pending = new Set();
  for (const row of existing || []) {
    if (row.status === 'completed') owned.add(row.composition_id);
    else pending.add(row.composition_id);
  }

  const toInsert = ids.filter((id) => !owned.has(id) && !pending.has(id));
  if (!toInsert.length) {
    return c.json({
      success: true,
      checkoutBatchId: null,
      totalAmount: 0,
      submitted: [],
      skipped: { alreadyPurchased: [...owned], alreadyPending: [...pending] },
    });
  }

  const batchId = crypto.randomUUID();
  const currency = 'KES';
  const submitted = [];
  let total = 0;

  for (const compId of toInsert) {
    const comp = compMap.get(compId);
    const amount = Number(comp.price || 0);
    total += amount;
    const id = crypto.randomUUID();
    const paymentRef = `${batchId}:${id}`;
    await c.env.DB
      .prepare(
        `INSERT INTO purchases (id, buyer_id, composition_id, price_paid, payment_ref, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`
      )
      .bind(id, user.id, compId, amount, paymentRef)
      .run();
    submitted.push({ id, composition_id: compId, amount, status: 'pending' });
  }

  return c.json({
    success: true,
    checkoutBatchId: batchId,
    totalAmount: total,
    currency,
    mpesa: {
      businessName: 'Mureke Fumusi Hub',
      businessNumber: null,
      accountNo: null,
      paymentUrl: null,
      instructions:
        'Send the total to the published M-Pesa number, then enter the confirmation code on the checkout page.',
    },
    submitted,
    skipped: { alreadyPurchased: [...owned], alreadyPending: [...pending] },
  });
});

app.get('/api/checkout/status', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const { results } = await c.env.DB
    .prepare(
      `SELECT p.id, p.composition_id, p.price_paid, p.payment_ref, p.status, p.created_at,
              c.title, c.price_currency
       FROM purchases p
       LEFT JOIN compositions c ON c.id = p.composition_id
       WHERE p.buyer_id = ?
       ORDER BY p.created_at DESC
       LIMIT 100`
    )
    .bind(user.id)
    .all();

  return c.json(results || []);
});

// ========== BUYER PREFERENCES (For-You weighting) ==========

app.put('/api/purchases/preferences', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }
  const categoryId = payload.category_id;
  const weight = Number(payload.weight);

  if (categoryId === undefined || categoryId === null) {
    return c.json({ error: 'category_id is required' }, 400);
  }
  if (!Number.isFinite(weight)) return c.json({ error: 'weight must be a number' }, 400);

  const { results: existing } = await c.env.DB
    .prepare('SELECT id FROM buyer_preferences WHERE user_id = ? AND category_id = ?')
    .bind(user.id, categoryId)
    .all();

  if (existing && existing.length) {
    await c.env.DB
      .prepare('UPDATE buyer_preferences SET weight = ? WHERE id = ?')
      .bind(weight, existing[0].id)
      .run();
  } else {
    await c.env.DB
      .prepare('INSERT INTO buyer_preferences (id, user_id, category_id, weight) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), user.id, categoryId, weight)
      .run();
  }

  return c.json({ success: true, category_id: categoryId, weight });
});

app.get('/api/purchases/preferences', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { results } = await c.env.DB
    .prepare('SELECT * FROM buyer_preferences WHERE user_id = ?')
    .bind(user.id)
    .all();
  return c.json(results || []);
});

// ========== REGISTRATION PAYMENT SUBMISSION ==========

app.post('/api/registration/payments/submit', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }
  const type = String(payload.type || '').trim();
  const paymentRef = String(payload.payment_ref || payload.paymentRef || '').trim();
  const amount = Number(payload.amount);
  const mpesaCode = String(payload.mpesa_code || payload.mpesaCode || '').trim();

  if (!type) return c.json({ error: 'type is required' }, 400);
  if (!paymentRef) return c.json({ error: 'payment_ref is required' }, 400);
  if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: 'amount must be greater than 0' }, 400);
  if (!mpesaCode) return c.json({ error: 'mpesa_code is required' }, 400);

  const id = crypto.randomUUID();
  await c.env.DB
    .prepare(
      `INSERT INTO payment_submissions
         (id, user_id, type, payment_ref, amount, mpesa_code, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
    )
    .bind(id, user.id, type, paymentRef, amount, mpesaCode)
    .run();

  const { results: regs } = await c.env.DB.prepare('SELECT * FROM registration_regulations LIMIT 1').all();

  return c.json({
    success: true,
    message: 'Payment submitted for review.',
    submission: { id, type, payment_ref: paymentRef, amount, mpesa_code: mpesaCode, status: 'pending' },
    regulations: regs && regs[0] ? regs[0] : null,
  });
});

// ========== ROLE INVITE ACCEPTANCE ==========

app.post('/api/request-role/accept-invite', async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  let payload;
  try { payload = await c.req.json(); } catch { payload = {}; }
  const requestedRole = String(payload.requestedRole || 'composer').trim();
  if (!['composer', 'admin'].includes(requestedRole)) {
    return c.json({ error: 'Invalid requestedRole' }, 400);
  }

  const { results: invites } = await c.env.DB
    .prepare('SELECT * FROM invites WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1')
    .bind(user.email)
    .all();

  if (!invites || !invites.length) {
    return c.json({ available: false, requestedRole, accepted: false, message: 'No invite available' });
  }
  const invite = invites[0];

  // Claim the invite atomically: only the first request may flip used=0 -> 1.
  const claim = await c.env.DB
    .prepare('UPDATE invites SET used = 1, used_by = ?, used_at = datetime(\'now\') WHERE id = ? AND used = 0')
    .bind(user.id, invite.id)
    .run();

  if (!claim.meta || claim.meta.changes !== 1) {
    return c.json({ available: false, requestedRole, accepted: false, message: 'Invite already used' });
  }

  const roleId = requestedRole === 'admin' ? 'role_admin' : `role_${requestedRole}`;
  await c.env.DB
    .prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)')
    .bind(user.id, roleId)
    .run();

  await c.env.DB
    .prepare(
      `INSERT INTO role_requests (id, user_id, requested_role, status, requested_at)
       VALUES (?, ?, ?, 'approved', datetime('now'))`
    )
    .bind(crypto.randomUUID(), user.id, requestedRole)
    .run();

  return c.json({
    available: true,
    requestedRole,
    canAccept: false,
    accepted: true,
    message: `Invite accepted. You now have the ${requestedRole} role.`,
    invite: { id: invite.id, email: invite.email, used: true, usedBy: user.id, usedAt: new Date().toISOString() },
  });
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

app.get('/favicon.ico', (c) => {
  return new Response('', { status: 204, headers: { 'Content-Type': 'image/x-icon' } });
});

// ========== CATCH-ALL ==========

app.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    url.searchParams.set('_v', Date.now().toString());
    const freshReq = new Request(url, { headers: c.req.headers, method: c.req.method });
    return await c.env.ASSETS.fetch(freshReq);
  } catch { return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 500 }); }
});

app.get('/admin', async (c) => {
  try {
    return await c.env.ASSETS.fetch(new Request('http://placeholder/index.html'));
  } catch { return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 500 }); }
});

app.get('/auth/callback', async (c) => {
  try {
    return await c.env.ASSETS.fetch(new Request('http://placeholder/index.html'));
  } catch { return new Response('<!doctype html><html><body><div id="root"></div></body></html>', { status: 500 }); }
});

// Catch-all for SPA routing
const SPA_HTML_HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  // No-cache: the SPA shell must never be served from a stale edge cache, or a
  // fixed client-side route keeps 404ing after the route is added.
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

const EMPTY_SPA = '<!doctype html><html><body><div id="root"></div></body></html>';

/**
 * Serve the SPA shell for a client-side route.
 *
 * NOTE: `ASSETS.fetch()` does NOT throw for a missing file — it RETURNS a 404
 * response. A bare `try { return await ASSETS.fetch(req) } catch {}` therefore
 * returns that 404 straight to the browser and the catch fallback is dead code,
 * which is exactly why /login and /marketplace 404'd while the explicitly
 * registered /admin and /auth/callback worked. The status must be checked.
 */
async function serveSpa(c) {
  try {
    const res = await c.env.ASSETS.fetch(new Request('http://placeholder/index.html'));
    if (res.status === 200) {
      return new Response(res.body, { status: 200, headers: SPA_HTML_HEADERS });
    }
  } catch { /* fall through to the bare shell */ }
  return new Response(EMPTY_SPA, { status: 200, headers: SPA_HTML_HEADERS });
}

// Catch-all for SPA routing
app.get('*', async (c) => {
  // Unmatched API paths must 404 as JSON, never as SPA HTML — the frontend
  // calls res.json() on these and an HTML body is a confusing parse error.
  if (c.req.path.startsWith('/api/')) return c.notFound();

  // Real static assets (e.g. /assets/index-*.js) are served as-is, with the
  // long-lived cache header they need.
  try {
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status === 200) {
      const h = new Headers(asset.headers);
      h.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(asset.body, { status: 200, headers: h });
    }
  } catch { /* fall through to the SPA shell */ }

  // Anything else is a client-side route: serve index.html.
  return serveSpa(c);
});

export default { fetch: app.fetch };
