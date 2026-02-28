-- Migration 012: Migrate from Firebase UID to Supabase Auth
-- This migration replaces firebase_uid with proper Supabase auth integration

-- Step 1: Convert firebase_uid from varchar to UUID and rename
ALTER TABLE users 
  ALTER COLUMN firebase_uid TYPE uuid USING firebase_uid::uuid,
  RENAME COLUMN firebase_uid TO auth_uid;

-- Step 2: Drop old indexes that reference firebase_uid
DROP INDEX IF EXISTS idx_users_firebase_uid;

-- Step 3: Create new index on auth_uid
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users(auth_uid);

-- Step 4: Update column comments
COMMENT ON COLUMN users.auth_uid IS 'Supabase auth.users.id UUID - links to authentication provider';

-- Step 5: Drop old RLS policies
DROP POLICY IF EXISTS users_can_view_own_profile ON users;
DROP POLICY IF EXISTS users_can_update_own_profile ON users;
DROP POLICY IF EXISTS service_role_bypass ON users;

-- Step 6: Create new RLS policies that work with Supabase auth UUIDs
CREATE POLICY users_can_view_own_profile
  ON users
  FOR SELECT
  USING (auth.uid() = auth_uid);

CREATE POLICY users_can_update_own_profile
  ON users
  FOR UPDATE
  USING (auth.uid() = auth_uid)
  WITH CHECK (auth.uid() = auth_uid);

CREATE POLICY service_role_bypass
  ON users
  FOR ALL
  USING (auth.role() = 'service_role');

-- Step 7: Add constraint that auth_uid must be valid UUID (not null)
ALTER TABLE users
  ALTER COLUMN auth_uid SET NOT NULL,
  ADD CONSTRAINT auth_uid_not_empty CHECK (auth_uid != '00000000-0000-0000-0000-000000000000'::uuid);

-- Step 8: Add is_active column if not exists
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Step 9: Add phone column if not exists  
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Step 10: Add composer_request flag if not exists
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS composer_request BOOLEAN DEFAULT FALSE;
