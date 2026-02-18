import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import admin from 'firebase-admin';
import cors from 'cors';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Enable CORS for browser clients and ngrok forwarders (reflect origin)
app.use(cors({ origin: true, credentials: true }));

// Simple OPTIONS handler for any route (helps with preflight replies)
app.options('*', (req, res) => res.sendStatus(204));

// Supabase config from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role key (has elevated privileges)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Firebase initialization (optional)
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

let firebaseAvailable = false;
if (FIREBASE_SERVICE_ACCOUNT || FIREBASE_SERVICE_ACCOUNT_PATH) {
  try {
    let serviceAccount;
    if (FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    } else {
      serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    firebaseAvailable = true;
    console.log('[firebase] initialized');
  } catch (err) {
    console.error('[firebase] initialization error:', err);
  }
} else {
  console.log('[firebase] no service account provided; Firebase endpoints disabled');
}

/**
 * Internal helper: sync a batch of users to Supabase. Returns { results, errors }
 */
async function syncUsersBatchInternal(users) {
  const results = [];
  const errors = [];

  for (const user of users) {
    try {
      const { firebaseUid, email, displayName, phone, avatarUrl, role } = user;

      if (!firebaseUid || !email) {
        errors.push({ firebaseUid: firebaseUid || 'unknown', message: 'Missing firebaseUid or email' });
        continue;
      }

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('firebase_uid', firebaseUid)
        .maybeSingle();

      let userId;

      if (existingUser) {
        userId = existingUser.id;
        // Update if new data
        if (displayName || phone || avatarUrl) {
          await supabase
            .from('users')
            .update({
              ...(displayName && { display_name: displayName }),
              ...(phone && { phone }),
              ...(avatarUrl && { avatar_url: avatarUrl }),
            })
            .eq('id', userId);
        }
      } else {
        const { data: newUser, error: createErr } = await supabase
          .from('users')
          .insert({
            firebase_uid: firebaseUid,
            email,
            display_name: displayName || null,
            phone: phone || null,
            avatar_url: avatarUrl || null,
            is_active: true,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (createErr) throw createErr;
        userId = newUser.id;
      }

      // Assign role if provided
      if (role) {
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', role)
          .maybeSingle();

        if (roleData) {
          await supabase
            .from('user_roles')
            .upsert({ user_id: userId, role_id: roleData.id });
        }
      }

      results.push({ firebaseUid, email, id: userId, status: 'success' });
    } catch (err) {
      errors.push({ firebaseUid: user.firebaseUid || 'unknown', message: err?.message || 'Unknown error', error: err?.code || 'ERROR' });
    }
  }

  return { results, errors };
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

/**
 * Sync user endpoint
 * POST /api/sync-user
 * 
 * Request body:
 * {
 *   firebaseUid: string,
 *   email: string,
 *   displayName?: string,
 *   phone?: string,
 *   avatarUrl?: string,
 *   role?: 'buyer' | 'composer' | 'admin'
 * }
 */
app.post('/api/sync-user', async (req, res) => {
  try {
    const { firebaseUid, email, displayName, phone, avatarUrl, role } = req.body;

    // Validate required fields
    if (!firebaseUid) {
      return res.status(400).json({ 
        message: 'firebaseUid is required',
        error: 'MISSING_FIREBASE_UID'
      });
    }

    if (!email) {
      return res.status(400).json({ 
        message: 'email is required',
        error: 'MISSING_EMAIL'
      });
    }

    console.log(`[sync-user] Syncing user: ${firebaseUid} (${email})`);

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();

    let userId;

    if (existingUser) {
      // User exists, just update
      console.log(`[sync-user] User ${firebaseUid} already exists with id: ${existingUser.id}`);
      userId = existingUser.id;

      // Update user info if new data provided
      if (displayName || phone || avatarUrl) {
        const { error: updateErr } = await supabase
          .from('users')
          .update({
            ...(displayName && { display_name: displayName }),
            ...(phone && { phone }),
            ...(avatarUrl && { avatar_url: avatarUrl }),
            is_active: true,
          })
          .eq('id', userId);

        if (updateErr) {
          console.error(`[sync-user] Update error for ${userId}:`, updateErr);
          throw updateErr;
        }
      }
    } else {
      // Create new user
      const { data: newUser, error: createErr } = await supabase
        .from('users')
        .insert({
          firebase_uid: firebaseUid,
          email,
          display_name: displayName || null,
          phone: phone || null,
          avatar_url: avatarUrl || null,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createErr) {
        console.error(`[sync-user] Create user error for ${firebaseUid}:`, createErr);
        throw createErr;
      }

      userId = newUser.id;
      console.log(`[sync-user] Created new user ${firebaseUid} with id: ${userId}`);
    }

    // Assign role if provided
    if (role) {
      // Get the role ID
      const { data: roleData, error: roleErr } = await supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .maybeSingle();

      if (roleErr) {
        console.error(`[sync-user] Role fetch error:`, roleErr);
        throw roleErr;
      }

      if (!roleData) {
        console.warn(`[sync-user] Role '${role}' not found in database`);
      } else {
        // Assign role via upsert (idempotent)
        const { error: roleAssignErr } = await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role_id: roleData.id });

        if (roleAssignErr) {
          console.error(`[sync-user] Role assignment error:`, roleAssignErr);
          throw roleAssignErr;
        }

        console.log(`[sync-user] Assigned role '${role}' to user ${userId}`);

        // Create buyer or composer record if needed
        if (role === 'buyer') {
          const { error: buyerErr } = await supabase
            .from('buyers')
            .upsert({ user_id: userId });

          if (buyerErr && buyerErr.code !== 'PGRST116') {
            console.warn(`[sync-user] Buyer record error:`, buyerErr);
          }
        } else if (role === 'composer') {
          const { error: composerErr } = await supabase
            .from('composers')
            .upsert({ user_id: userId });

          if (composerErr && composerErr.code !== 'PGRST116') {
            console.warn(`[sync-user] Composer record error:`, composerErr);
          }
        }
      }
    }

    console.log(`[sync-user] Successfully synced user ${firebaseUid}`);

    return res.json({ 
      id: userId,
      firebaseUid,
      email,
      role: role || null,
      message: 'User synced successfully'
    });
  } catch (error) {
    console.error('[sync-user] Error:', error);

    return res.status(500).json({ 
      message: 'Failed to sync user',
      error: error?.message || 'Internal server error',
      code: error?.code || 'UNKNOWN_ERROR'
    });
  }
});

// Support the non-API path used by the frontend / ngrok: POST /sync-user
app.post('/sync-user', async (req, res) => {
  // Delegate to the same handler logic at /api/sync-user
  // Reuse by calling the main route handler: craft a small proxy call
  try {
    // Forward request to existing handler by calling the logic inline
    const { firebaseUid, email, displayName, phone, avatarUrl, role } = req.body;

    // Basic validation same as /api/sync-user
    if (!firebaseUid) return res.status(400).json({ message: 'firebaseUid is required', error: 'MISSING_FIREBASE_UID' });
    if (!email) return res.status(400).json({ message: 'email is required', error: 'MISSING_EMAIL' });

    // Reuse the same logic: call the supabase-backed sync by delegating to the /api route internals
    // To avoid duplicating large logic, call the /api/sync-user endpoint internally using the supabase client.
    // This mirrors the main handler behavior.

    // Check if user already exists
    const { data: existingUser } = await supabase.from('users').select('id').eq('firebase_uid', firebaseUid).maybeSingle();
    let userId;

    if (existingUser) {
      userId = existingUser.id;
      if (displayName || phone || avatarUrl) {
        const { error: updateErr } = await supabase.from('users').update({ ...(displayName && { display_name: displayName }), ...(phone && { phone }), ...(avatarUrl && { avatar_url: avatarUrl }), is_active: true }).eq('id', userId);
        if (updateErr) throw updateErr;
      }
    } else {
      const { data: newUser, error: createErr } = await supabase.from('users').insert({ firebase_uid: firebaseUid, email, display_name: displayName || null, phone: phone || null, avatar_url: avatarUrl || null, is_active: true, created_at: new Date().toISOString() }).select().single();
      if (createErr) throw createErr;
      userId = newUser.id;
    }

    // Assign role if provided
    if (role) {
      const { data: roleData, error: roleErr } = await supabase.from('roles').select('id').eq('name', role).maybeSingle();
      if (roleErr) throw roleErr;
      if (roleData) {
        const { error: roleAssignErr } = await supabase.from('user_roles').upsert({ user_id: userId, role_id: roleData.id });
        if (roleAssignErr) throw roleAssignErr;
      }
    }

    return res.json({ id: userId, firebaseUid, email, role: role || null, message: 'User synced successfully' });
  } catch (error) {
    console.error('[sync-user - alias] Error:', error);
    return res.status(500).json({ message: 'Failed to sync user', error: error?.message || 'Internal server error', code: error?.code || 'UNKNOWN_ERROR' });
  }
});

/**
 * Sync all users endpoint (useful for batch operations)
 * POST /api/sync-users-batch
 * 
 * Request body:
 * {
 *   users: Array<{
 *     firebaseUid: string,
 *     email: string,
 *     displayName?: string,
 *     phone?: string,
 *     avatarUrl?: string,
 *     role?: string
 *   }>
 * }
 */
app.post('/api/sync-users-batch', async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({ message: 'users must be an array', error: 'INVALID_REQUEST' });
    }

    console.log(`[sync-users-batch] Starting batch sync for ${users.length} users`);

    const { results, errors } = await syncUsersBatchInternal(users);

    console.log(`[sync-users-batch] Completed: ${results.length} successful, ${errors.length} errors`);

    return res.json({ total: users.length, successful: results.length, failed: errors.length, results, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('[sync-users-batch] Error:', error);
    return res.status(500).json({ message: 'Failed to sync users', error: error?.message || 'Internal server error' });
  }
});

/**
 * Trigger sync from Firebase Auth into Supabase
 * POST /api/sync-from-firebase
 * Optional body: { maxResults?: number } to limit number of users fetched (default 1000)
 */
app.post('/api/sync-from-firebase', async (req, res) => {
  try {
    if (!firebaseAvailable) {
      return res.status(400).json({ message: 'Firebase not configured on this server' });
    }

    const { maxResults = 1000 } = req.body || {};

    console.log('[sync-from-firebase] Listing users from Firebase (maxResults=%s)', maxResults);

    const users = [];
    let nextPageToken = undefined;
    let fetched = 0;

    // Fetch users in pages until we reach maxResults or no more users
    do {
      const listResult = await admin.auth().listUsers(1000, nextPageToken);
      for (const fbUser of listResult.users) {
        if (fetched >= maxResults) break;
        users.push({
          firebaseUid: fbUser.uid,
          email: fbUser.email || null,
          displayName: fbUser.displayName || null,
          phone: fbUser.phoneNumber || null,
          avatarUrl: (fbUser.photoURL) ? fbUser.photoURL : null,
        });
        fetched += 1;
      }

      nextPageToken = listResult.pageToken;
    } while (nextPageToken && fetched < maxResults);

    console.log(`[sync-from-firebase] Fetched ${users.length} users, starting sync`);

    const { results, errors } = await syncUsersBatchInternal(users);

    return res.json({ totalFetched: users.length, successful: results.length, failed: errors.length, results, errors: errors.length > 0 ? errors : undefined });
  } catch (err) {
    console.error('[sync-from-firebase] Error:', err);
    return res.status(500).json({ message: 'Failed to sync from Firebase', error: err?.message || 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: err.message || 'Unknown error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Sync server running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📍 Sync user: POST http://localhost:${PORT}/api/sync-user`);
  console.log(`📍 Batch sync: POST http://localhost:${PORT}/api/sync-users-batch`);
  console.log(`\nWaiting for ngrok tunnel...\n`);
});
