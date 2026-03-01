-- Create admin_emails table to manage admin access by email
-- This allows checking email during login to automatically assign admin role
CREATE TABLE IF NOT EXISTS public.admin_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  added_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- Create index on email for faster lookups during login
CREATE INDEX IF NOT EXISTS idx_admin_emails_email ON public.admin_emails(email);
CREATE INDEX IF NOT EXISTS idx_admin_emails_active ON public.admin_emails(is_active);

-- Disable RLS (backend uses service role key which bypasses RLS anyway)
ALTER TABLE public.admin_emails DISABLE ROW LEVEL SECURITY;

-- Insert initial admin emails (customize these with your admin emails)
-- Note: You can add more admin emails here or through the app
INSERT INTO public.admin_emails (email, notes) VALUES
  ('fredrickmakori102@gmail.com', 'Default admin account')
ON CONFLICT (email) DO NOTHING;

-- Create a function to check if an email is admin
CREATE OR REPLACE FUNCTION public.is_admin_email(email_to_check VARCHAR(255))
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_emails
    WHERE LOWER(email) = LOWER(email_to_check) AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.admin_emails IS 'List of emails that automatically get admin role on login or user creation';
COMMENT ON FUNCTION public.is_admin_email(VARCHAR) IS 'Check if an email should have admin privileges';
