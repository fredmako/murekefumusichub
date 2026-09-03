import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Admin client for service-role ops and auth verification
const adminClient = createClient(supabaseUrl, supabaseServiceKey);

const tableMap: Record<string, string> = {
  users: 'users',
  composers: 'composers',
  compositions: 'compositions',
  categories: 'categories',
  purchases: 'purchases',
  checkouts: 'payment_submissions',
  support_tickets: 'support_tickets',
  enrollments: 'enrollments',
  invites: 'invites',
  role_requests: 'role_requests',
  admin_emails: 'admin_emails',
  file_uploads: 'file_uploads',
  payment_submissions: 'payment_submissions',
};

// Verify Supabase JWT and return user info
async function verifyAuth(req: VercelRequest): Promise<{ user: User | null; error: string | null }> {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null, error: 'No token provided' };
  }

  try {
    const { data, error } = await adminClient.auth.getUser(token);
    
    if (error || !data.user) {
      return { user: null, error: error?.message || 'Invalid token' };
    }

    return { user: data.user, error: null };
  } catch (err: any) {
    return { user: null, error: err.message };
  }
}

// Check if user has a specific role
async function hasRole(userId: string, role: string): Promise<boolean> {
  const { data } = await adminClient
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId)
    .single();
  
  if (!data) return false;
  
  // Map role ID to role name
  const roleMap: Record<number, string> = { 1: 'buyer', 2: 'composer', 3: 'admin' };
  return roleMap[data.role_id] === role;
}

// Check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, 'admin');
}

// Check if user is composer
async function isComposer(userId: string): Promise<boolean> {
  return hasRole(userId, 'composer');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urlPath = (req.url || '').replace(/^\\/api\\//, '');
  const tableName = urlPath.split('/')[0].split('?')[0];

  // Health check - no auth required
  if (urlPath.includes('health') || !tableName) {
    return res.json({ ok: true, service: 'murekefu-backend', version: '1.0.0' });
  }

  // Auth endpoints (login, signup, etc.)
  if (tableName === 'auth') {
    return handleAuth(req, res);
  }

  // Verify authentication for all data endpoints
  const { user, error: authError } = await verifyAuth(req);
  
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized', details: authError });
  }

  const table = tableMap[tableName];
  if (!table) {
    return res.status(404).json({ 
      error: 'Not found', 
      table: tableName, 
      available: Object.keys(tableMap) 
    });
  }

  try {
    // GET - Read operations
    if (req.method === 'GET') {
      // Users can only see their own profile (unless admin)
      if (tableName === 'users') {
        const admin = await isAdmin(user.id);
        if (!admin) {
          const { data, error } = await adminClient
            .from('users')
            .select('*')
            .eq('auth_uid', user.id)
            .single();
          if (error) return res.status(500).json({ error: error.message });
          return res.json(data ? [data] : []);
        }
      }

      const { data, error } = await adminClient.from(table).select('*').limit(100);
      if (error) return res.status(500).json({ error: error.message, table });
      return res.json(data || []);
    }

    // POST - Create operations
    if (req.method === 'POST') {
      const insertData: Record<string, any> = {
        ...req.body,
        created_by: user.id,
      };

      // Set user-owned fields based on table
      if (tableName === 'users') {
        insertData.auth_uid = user.id;
        insertData.email = user.email;
      } else if (tableName === 'purchases') {
        insertData.buyer_id = user.id;
      } else if (tableName === 'compositions') {
        // Check if user is a composer
        const composer = await isComposer(user.id);
        if (!composer) {
          return res.status(403).json({ error: 'Only composers can create compositions' });
        }
        insertData.composer_id = user.id;
      } else if (tableName === 'composers') {
        insertData.user_id = user.id;
      }

      // Admin-only tables
      const adminOnlyTables = ['admin_emails', 'categories', 'role_requests'];
      if (adminOnlyTables.includes(tableName)) {
        const admin = await isAdmin(user.id);
        if (!admin) {
          return res.status(403).json({ error: 'Admin access required' });
        }
      }

      const { data, error } = await adminClient.from(table).insert(insertData).select();
      if (error) return res.status(500).json({ error: error.message, table });
      return res.status(201).json(data?.[0] || {});
    }

    // PUT/PATCH - Update operations
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const admin = await isAdmin(user.id);
      
      if (!admin) {
        // Users can only update their own records
        const { data: existing } = await adminClient
          .from(table)
          .select('*')
          .eq('user_id', user.id)
          .eq('id', req.body.id)
          .single();
        
        if (!existing) {
          return res.status(403).json({ error: 'Can only update your own records' });
        }
      }

      const { data, error } = await adminClient
        .from(table)
        .update(req.body)
        .eq('id', req.body.id)
        .select();
      
      if (error) return res.status(500).json({ error: error.message, table });
      return res.json(data?.[0] || {});
    }

    // DELETE - Delete operations (admin only)
    if (req.method === 'DELETE') {
      const admin = await isAdmin(user.id);
      if (!admin) {
        return res.status(403).json({ error: 'Admin access required for deletion' });
      }

      const { error } = await adminClient
        .from(table)
        .delete()
        .eq('id', req.query.id);
      
      if (error) return res.status(500).json({ error: error.message, table });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// Handle authentication endpoints
async function handleAuth(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || req.body?.action;

  try {
    switch (action) {
      case 'signup': {
        const { email, password, full_name, role } = req.body;
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }

        const { data, error } = await adminClient.auth.signUp({
          email,
          password,
          options: {
            data: { full_name, requested_role: role || 'buyer' },
          },
        });

        if (error) return res.status(400).json({ error: error.message });
        
        // Create user profile
        if (data.user) {
          await adminClient.from('users').upsert({
            auth_uid: data.user.id,
            email,
            full_name: full_name || '',
          });

          // Assign role
          const roleId = role === 'composer' ? 2 : role === 'admin' ? 3 : 1;
          await adminClient.from('user_roles').upsert({
            user_id: data.user.id,
            role_id: roleId,
          });
        }

        return res.json({ 
          user: data.user, 
          session: data.session,
          message: 'Signed up successfully. Check email to confirm.' 
        });
      }

      case 'login': {
        const { email, password } = req.body;
        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password required' });
        }

        const { data, error } = await adminClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) return res.status(400).json({ error: error.message });

        // Get user profile
        const { data: profile } = await adminClient
          .from('users')
          .select('*')
          .eq('auth_uid', data.user.id)
          .single();

        // Get user roles
        const { data: roles } = await adminClient
          .from('user_roles')
          .select('role_id')
          .eq('user_id', data.user.id);

        return res.json({ 
          user: data.user, 
          session: data.session,
          profile,
          roles: roles || []
        });
      }

      case 'logout': {
        const { error } = await adminClient.auth.signOut();
        if (error) return res.status(400).json({ error: error.message });
        return res.json({ ok: true, message: 'Logged out' });
      }

      case 'me': {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        
        if (!token) {
          return res.status(401).json({ error: 'No token' });
        }

        const { data, error } = await adminClient.auth.getUser(token);
        if (error || !data.user) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        // Get user profile
        const { data: profile } = await adminClient
          .from('users')
          .select('*')
          .eq('auth_uid', data.user.id)
          .single();

        // Get user roles
        const { data: roles } = await adminClient
          .from('user_roles')
          .select('role_id')
          .eq('user_id', data.user.id);

        return res.json({ user: data.user, profile, roles: roles || [] });
      }

      default:
        return res.status(400).json({ error: 'Unknown auth action' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
