import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const urlPath = req.url?.replace(/^\/api\//, '') || '';
  const tableName = urlPath.split('/')[0].split('?')[0];
  
  if (urlPath.includes('health') || !tableName) {
    return res.json({ ok: true, service: 'murekefu-backend', version: '1.0.0' });
  }
  
  const table = tableMap[tableName];
  if (!table) {
    return res.status(404).json({ error: 'Not found', table: tableName, available: Object.keys(tableMap) });
  }
  
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from(table).select('*').limit(100);
      if (error) return res.status(500).json({ error: error.message, table });
      return res.json(data || []);
    }
    
    if (req.method === 'POST') {
      const { data, error } = await supabase.from(table).insert(req.body).select();
      if (error) return res.status(500).json({ error: error.message, table });
      return res.json(data?.[0] || {});
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
