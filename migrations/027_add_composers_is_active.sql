-- Migration 027: Add activation flag to composers
-- Enables deactivation/reactivation of composer access.

ALTER TABLE public.composers
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE public.composers
  SET is_active = TRUE
  WHERE is_active IS NULL;

CREATE INDEX IF NOT EXISTS idx_composers_is_active
  ON public.composers(is_active);

COMMENT ON COLUMN public.composers.is_active IS 'Active composer flag for enabling/disabling access.';
