-- Migration 016: Switch default theme preset to emerald

-- Update users currently on aurora (or missing preset) to emerald.
UPDATE public.users
SET theme_settings = jsonb_set(
  COALESCE(theme_settings, '{}'::jsonb),
  '{preset}',
  '"emerald"'::jsonb,
  true
)
WHERE COALESCE(theme_settings->>'preset', '') IN ('', 'aurora');

-- Ensure future rows default to emerald.
ALTER TABLE public.users
  ALTER COLUMN theme_settings SET DEFAULT '{"preset":"emerald"}'::jsonb;

COMMENT ON COLUMN public.users.theme_settings IS
  'Per-user UI settings persisted as JSON (e.g., {"preset":"emerald"}).';
