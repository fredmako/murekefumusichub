-- Migration 019: Add support ticket assignment and rejection workflow.

ALTER TABLE public.support_chat_threads
  ADD COLUMN IF NOT EXISTS assigned_admin_user_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'support_chat_threads_assigned_admin_user_id_fkey'
      AND table_schema = 'public'
      AND table_name = 'support_chat_threads'
  ) THEN
    ALTER TABLE public.support_chat_threads
      ADD CONSTRAINT support_chat_threads_assigned_admin_user_id_fkey
      FOREIGN KEY (assigned_admin_user_id)
      REFERENCES public.users(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

UPDATE public.support_chat_threads
SET expires_at = COALESCE(
  expires_at,
  created_at + INTERVAL '30 days',
  NOW() + INTERVAL '30 days'
)
WHERE expires_at IS NULL;

-- Convert legacy states so queue and assignment logic are consistent.
UPDATE public.support_chat_threads
SET status = 'pending'
WHERE status = 'open' AND assigned_admin_user_id IS NULL;

UPDATE public.support_chat_threads
SET status = 'active'
WHERE assigned_admin_user_id IS NOT NULL AND status IN ('open', 'pending');

CREATE TABLE IF NOT EXISTS public.support_chat_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_chat_threads(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(thread_id, admin_user_id)
);

CREATE INDEX IF NOT EXISTS idx_support_chat_threads_assigned_admin
  ON public.support_chat_threads(assigned_admin_user_id);
CREATE INDEX IF NOT EXISTS idx_support_chat_threads_status
  ON public.support_chat_threads(status);
CREATE INDEX IF NOT EXISTS idx_support_chat_threads_expires_at
  ON public.support_chat_threads(expires_at);

CREATE INDEX IF NOT EXISTS idx_support_chat_rejections_thread
  ON public.support_chat_rejections(thread_id);
CREATE INDEX IF NOT EXISTS idx_support_chat_rejections_admin
  ON public.support_chat_rejections(admin_user_id);

ALTER TABLE public.support_chat_rejections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_rejections REPLICA IDENTITY FULL;

COMMENT ON TABLE public.support_chat_rejections IS 'Per-admin rejection decisions for support tickets.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'support_chat_rejections'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_rejections;
    END IF;
  END IF;
END
$$;
