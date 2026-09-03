import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Table mapping: endpoint name -> schema.table
const tableMap: Record<string, string> = {
  users: 'public.users',
  composers: 'public.composers',
  compositions: 'public.compositions',
  categories: 'public.categories',
  purchases: 'murekefu.purchases',
  checkouts: 'murekefu.payment_submissions',
  support_tickets: 'public.support_tickets',
  enrollments: 'public.enrollments',
  invites: 'public.invites',
  role_requests: 'public.role_requests',
  admin_emails: 'public.admin_emails',
  file_uploads: 'public.file_uploads',
  payment_submissions: 'murekefu.payment_submissions',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const urlPath = req.url?.replace(/^\/api\//, '') || '';
  const tableName = urlPath.split('/')[0].split('?')[0];
  
  if (urlPath.includes('health') || !tableName) {
    return res.json({ ok: true, service: 'murekefu-backend', version: '1.0.0' });
  }
  
  const fullTable = tableMap[tableName];
  if (!fullTable) {
    return res.status(404).json({ error: 'Not found', table: tableName, available: Object.keys(tableMap) });
  }
  
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from(fullTable).select('*').limit(100);
      if (error) return res.status(500).json({ error: error.message, table: fullTable });
      return res.json(data || []);
    }
    
    if (req.method === 'POST') {
      const { data, error } = await supabase.from(fullTable).insert(req.body).select();
      if (error) return res.status(500).json({ error: error.message, table: fullTable });
      return res.json(data?.[0] || {});
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
