-- Migration 021: Create enrollments table for class applications and admin admission workflow.

CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  music_class VARCHAR(120) NOT NULL,
  skill_level VARCHAR(32) NOT NULL,
  notes TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  admitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_status_created
  ON public.enrollments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrollments_user_id
  ON public.enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_email
  ON public.enrollments(email);

ALTER TABLE public.enrollments DISABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_enrollments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enrollments_updated_at_trigger ON public.enrollments;
CREATE TRIGGER enrollments_updated_at_trigger
BEFORE UPDATE ON public.enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_enrollments_updated_at();

COMMENT ON TABLE public.enrollments IS 'Enrollment requests submitted by members for music classes.';
