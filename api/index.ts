import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const allowedTables = ['users', 'accounts', 'compositions', 'categories', 'purchases', 'checkouts', 'support_tickets', 'community_posts', 'notifications', 'enrollments', 'registrations', 'media', 'uploads', 'user_roles', 'role_requests'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract path from query or URL
  const urlPath = req.url?.replace(/^\/api\//, '') || '';
  const tableName = urlPath.split('/')[0].split('?')[0];
  
  if (urlPath.includes('health') || !tableName) {
    return res.json({ ok: true, service: 'murekefu-backend', version: '1.0.0' });
  }
  
  if (!allowedTables.includes(tableName)) {
    return res.status(404).json({ error: 'Not found', table: tableName });
  }
  
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from(tableName).select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data || []);
    }
    
    if (req.method === 'POST') {
      const { data, error } = await supabase.from(tableName).insert(req.body).select();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data?.[0] || {});
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
