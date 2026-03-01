-- Migration 012: Finalize Supabase Auth mapping on users table
-- Idempotent and safe on partially migrated databases.

-- If legacy firebase_uid exists, convert it to UUID auth_uid where possible.
DO $$
DECLARE
  firebase_col_exists boolean;
  auth_col_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'firebase_uid'
  ) INTO firebase_col_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'auth_uid'
  ) INTO auth_col_exists;

  IF firebase_col_exists AND NOT auth_col_exists THEN
    -- Rename first to preserve data, then cast in-place.
    EXECUTE 'ALTER TABLE public.users RENAME COLUMN firebase_uid TO auth_uid';
  END IF;

  -- Ensure target column exists.
  EXECUTE 'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_uid UUID';

  -- If auth_uid is still text-like from legacy schema, convert it to UUID.
  BEGIN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN auth_uid TYPE UUID USING auth_uid::uuid';
  EXCEPTION
    WHEN others THEN
      -- Keep migration non-destructive if some legacy values are not UUIDs.
      RAISE NOTICE 'Skipping auth_uid type conversion: %', SQLERRM;
  END;

  -- Drop legacy column when both exist.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'firebase_uid'
  ) INTO firebase_col_exists;

  IF firebase_col_exists THEN
    EXECUTE 'ALTER TABLE public.users DROP COLUMN firebase_uid';
  END IF;
END$$;

DROP INDEX IF EXISTS idx_users_firebase_uid;
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON public.users(auth_uid);

COMMENT ON COLUMN public.users.auth_uid IS 'Supabase auth.users.id UUID - links to authentication provider';

DROP POLICY IF EXISTS users_can_view_own_profile ON public.users;
DROP POLICY IF EXISTS users_can_update_own_profile ON public.users;
DROP POLICY IF EXISTS service_role_bypass ON public.users;

CREATE POLICY users_can_view_own_profile
  ON public.users
  FOR SELECT
  USING (auth.uid() = auth_uid);

CREATE POLICY users_can_update_own_profile
  ON public.users
  FOR UPDATE
  USING (auth.uid() = auth_uid)
  WITH CHECK (auth.uid() = auth_uid);

CREATE POLICY service_role_bypass
  ON public.users
  FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS composer_request BOOLEAN DEFAULT FALSE;
