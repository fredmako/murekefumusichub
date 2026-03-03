-- Migration 018: Create realtime support chat tables.

CREATE TABLE IF NOT EXISTS public.support_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject VARCHAR(160) NOT NULL DEFAULT 'Support Request',
  context VARCHAR(120) NOT NULL DEFAULT 'dashboard',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  is_admin_unread BOOLEAN NOT NULL DEFAULT TRUE,
  is_user_unread BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_preview VARCHAR(500),
  last_sender_role VARCHAR(20),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.support_chat_threads(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  sender_role VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_threads_requester
  ON public.support_chat_threads(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_support_chat_threads_admin_unread
  ON public.support_chat_threads(is_admin_unread);
CREATE INDEX IF NOT EXISTS idx_support_chat_threads_user_unread
  ON public.support_chat_threads(is_user_unread);
CREATE INDEX IF NOT EXISTS idx_support_chat_threads_last_message_at
  ON public.support_chat_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_chat_threads_deleted
  ON public.support_chat_threads(deleted_by_admin);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_thread
  ON public.support_chat_messages(thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_chat_messages_sender
  ON public.support_chat_messages(sender_user_id);

ALTER TABLE public.support_chat_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_chat_messages DISABLE ROW LEVEL SECURITY;

ALTER TABLE public.support_chat_threads REPLICA IDENTITY FULL;
ALTER TABLE public.support_chat_messages REPLICA IDENTITY FULL;

-- Keep updated_at current on thread updates.
CREATE OR REPLACE FUNCTION public.update_support_chat_threads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_chat_threads_updated_at_trigger ON public.support_chat_threads;
CREATE TRIGGER support_chat_threads_updated_at_trigger
BEFORE UPDATE ON public.support_chat_threads
FOR EACH ROW
EXECUTE FUNCTION public.update_support_chat_threads_updated_at();

COMMENT ON TABLE public.support_chat_threads IS 'Support chat conversations between users and admins.';
COMMENT ON TABLE public.support_chat_messages IS 'Messages exchanged inside support chat threads.';

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
        AND tablename = 'support_chat_threads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_threads;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'support_chat_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chat_messages;
    END IF;
  END IF;
END
$$;
