-- Migration 023: Add composition verification workflow for admin review

ALTER TABLE public.compositions
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_compositions_is_verified
  ON public.compositions(is_verified);

CREATE INDEX IF NOT EXISTS idx_compositions_verified_at
  ON public.compositions(verified_at DESC);

COMMENT ON COLUMN public.compositions.is_verified IS
  'Whether this composition has been reviewed and verified by an admin.';
COMMENT ON COLUMN public.compositions.verified_at IS
  'Timestamp when the composition was last marked verified.';
COMMENT ON COLUMN public.compositions.verified_by IS
  'Admin user ID that last verified the composition.';
COMMENT ON COLUMN public.compositions.verification_notes IS
  'Optional admin notes captured during verification/unverification.';
