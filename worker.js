import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS middleware
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health endpoint
app.get('/api/health', (c) => {
  return c.json({ ok: true, service: 'murekefu-music-hub' });
});

app.get('/health', (c) => {
  return c.json({ ok: true, service: 'murekefu-music-hub' });
});

// Verify Supabase token and get user
app.get('/api/auth/verify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'No authorization header' }, 401);
  }

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseKey,
      },
    });

    if (!response.ok) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const user = await response.json();
    return c.json({ user });
  } catch (err) {
    return c.json({ error: 'Auth verification failed' }, 500);
  }
});

// Sync user to database (create/update user record)
app.post('/api/auth/sync-user', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {
    return c.json({ error: 'No authorization header' }, 401);
  }

  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    // Get user from Supabase
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseKey,
      },
    });

    if (!userResponse.ok) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    const user = await userResponse.json();

    // Check if user exists in users table
    const checkResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}&select=id`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const existingUsers = await checkResponse.json();

    if (existingUsers.length === 0) {
      // Create user record
      const createResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          id: user.id,
          auth_uid: user.id,
          email: user.email,
          display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Failed to create user:', errorText);
        return c.json({ error: 'Failed to sync user' }, 500);
      }
    }

    return c.json({ success: true, user_id: user.id });
  } catch (err) {
    console.error('Sync user error:', err);
    return c.json({ error: 'Sync failed' }, 500);
  }
});

// Get user profile
app.get('/api/users/:id', async (c) => {
  const userId = c.req.param('id');
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const users = await response.json();
    if (users.length === 0) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(users[0]);
  } catch (err) {
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// Get compositions
app.get('/api/compositions', async (c) => {
  const supabaseUrl = c.env.SUPABASE_URL;
  const supabaseKey = c.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/compositions?is_published=eq.true&select=*&order=created_at.desc`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });

    const compositions = await response.json();
    return c.json(compositions);
  } catch (err) {
    return c.json({ error: 'Failed to fetch compositions' }, 500);
  }
});

// Fallback: serve frontend assets
app.get('*', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

app.post('*', (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
};
