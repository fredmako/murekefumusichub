-- Create invites table for email-based composer invitations
-- Note: Backend uses service role key which bypasses RLS
CREATE TABLE IF NOT EXISTS public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  requested_role VARCHAR(50) NOT NULL DEFAULT 'composer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_used ON public.invites(used);

-- Disable RLS for now (backend uses service role key which bypasses RLS anyway)
ALTER TABLE public.invites DISABLE ROW LEVEL SECURITY;
