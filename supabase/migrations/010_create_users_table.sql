-- Migration 010: Create/normalize users table for Supabase Auth
-- Safe to run on existing databases.

-- Ensure users table exists
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_uid UUID,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  phone VARCHAR(20),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Ensure required columns exist on older tables
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_uid UUID;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON public.users(auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- Comments
COMMENT ON TABLE public.users IS 'Core user account information linked to Supabase auth.users';
COMMENT ON COLUMN public.users.id IS 'Unique Supabase UUID identifier';
COMMENT ON COLUMN public.users.auth_uid IS 'Supabase auth.users.id UUID';
COMMENT ON COLUMN public.users.email IS 'User email address (unique)';
COMMENT ON COLUMN public.users.display_name IS 'User display name for marketplace';
COMMENT ON COLUMN public.users.avatar_url IS 'URL to user avatar image in Supabase Storage';
COMMENT ON COLUMN public.users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN public.users.updated_at IS 'Last updated timestamp';
COMMENT ON COLUMN public.users.deleted IS 'Soft delete flag - false = active, true = deleted';
COMMENT ON COLUMN public.users.is_active IS 'Active account flag';

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Refresh policies safely
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

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at_trigger ON public.users;
CREATE TRIGGER users_updated_at_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_users_updated_at();
