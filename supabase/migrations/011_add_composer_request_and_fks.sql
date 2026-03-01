-- Migration 011: Add composer_request flag to users and ensure composer->user relationship

-- Add composer_request column to users so the frontend can display pending state
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS composer_request BOOLEAN DEFAULT FALSE;

-- Add index to speed up lookups (used by admin notifications/users queries)
CREATE INDEX IF NOT EXISTS idx_users_composer_request ON public.users(composer_request);

-- Ensure foreign key exists between composers.user_id -> users.id
-- (some environments may have lost the constraint; recreate it safely)
DO $$
BEGIN
  -- Clean orphan composer rows before adding FK.
  DELETE FROM public.composers c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = c.user_id
  );

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'composers'
      AND kcu.column_name = 'user_id'
  ) THEN
    ALTER TABLE public.composers
      ADD CONSTRAINT composers_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Add index on composers.user_id in case it was missing
CREATE INDEX IF NOT EXISTS idx_composers_user_id ON public.composers(user_id);

-- Comments for clarity
COMMENT ON COLUMN public.users.composer_request IS 'Flag set when a user has requested composer access and is awaiting approval';

-- No RLS changes necessary since composer_request is not sensitive
