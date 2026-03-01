-- Create composers table with proper relationships
-- This table registers approved composers and relates to users and compositions
CREATE TABLE IF NOT EXISTS public.composers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_composers_user_id ON public.composers(user_id);
CREATE INDEX IF NOT EXISTS idx_composers_created_at ON public.composers(created_at DESC);

-- Disable RLS (backend uses service role key)
ALTER TABLE public.composers DISABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.composers IS 'Stores approved composers. One-to-one relationship with users table.';
COMMENT ON COLUMN public.composers.user_id IS 'Foreign key to users table. Unique constraint ensures each user has at most one composer record.';
COMMENT ON COLUMN public.composers.created_at IS 'Timestamp when composer was approved/created.';
COMMENT ON COLUMN public.composers.updated_at IS 'Timestamp of last update.';
