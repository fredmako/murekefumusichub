import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const allowedEndpoints: Record<string, string> = {
  compositions: 'compositions',
  composers: 'composers',
  users: 'users',
  categories: 'categories',
  purchases: 'purchases',
  support: 'support_tickets',
  enrollments: 'enrollments',
  invites: 'invites',
  auth: 'auth',
};

async function verifyToken(req: VercelRequest) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { data } = await adminClient.auth.getUser(token);
    return data.user;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = (req.url || '').replace(/^\/api\//, '').split('/')[0].split('?')[0];

  if (!path || path === 'health') {
    return res.json({ ok: true, service: 'murekefu-backend', v: '1.0.0' });
  }

  if (path === 'auth') {
    return handleAuth(req, res);
  }

  const table = allowedEndpoints[path];
  if (!table) {
    return res.status(404).json({ error: 'Not found', available: Object.keys(allowedEndpoints) });
  }

  const user = await verifyToken(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await adminClient.from(table).select('*').limit(100);
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    }

    if (req.method === 'POST') {
      const { data, error } = await adminClient.from(table).insert({ ...req.body, created_by: user.id }).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data?.[0] || {});
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleAuth(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || req.body?.action;
  try {
    if (action === 'signup') {
      const { email, password, full_name, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const { data, error } = await adminClient.auth.signUp({
        email, password,
        options: { data: { full_name, requested_role: role || 'buyer' } },
      });
      if (error) return res.status(400).json({ error: error.message });

      if (data.user) {
        // Auto-confirm the user (free tier workaround)
        await adminClient.auth.admin.updateUserById(data.user.id, {
          email_confirm: true,
          user_metadata: { full_name, requested_role: role || 'buyer' }
        });

        await adminClient.from('users').upsert({ auth_uid: data.user.id, email, full_name: full_name || '' });
        const roleId = role === 'composer' ? 2 : role === 'admin' ? 3 : 1;
        await adminClient.from('user_roles').upsert({ user_id: data.user.id, role_id: roleId });
      }
      return res.json({ user: data.user, session: data.session, message: 'Signed up and confirmed' });
    }

    if (action === 'login') {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const { data, error } = await adminClient.auth.signInWithPassword({ email, password });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ user: data.user, session: data.session });
    }

    if (action === 'logout') {
      await adminClient.auth.signOut();
      return res.json({ ok: true, message: 'Logged out' });
    }

    if (action === 'me') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'No token' });

      const { data, error } = await adminClient.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });

      const { data: profile } = await adminClient.from('users').select('*').eq('auth_uid', data.user.id).single();
      return res.json({ user: data.user, profile });
    }

    return res.status(400).json({ error: 'Unknown auth action' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
