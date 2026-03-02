-- Migration 015: Add users.theme_settings for saved UI theme preferences
-- Required by frontend AuthContext and account update endpoints.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS theme_settings JSONB;

UPDATE public.users
SET theme_settings = '{"preset":"aurora"}'::jsonb
WHERE theme_settings IS NULL;

ALTER TABLE public.users
  ALTER COLUMN theme_settings SET DEFAULT '{"preset":"aurora"}'::jsonb;

COMMENT ON COLUMN public.users.theme_settings IS
  'Per-user UI settings persisted as JSON (e.g., {"preset":"aurora"}).';
