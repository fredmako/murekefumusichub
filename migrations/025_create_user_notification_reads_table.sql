create table if not exists public.user_notification_reads (
  user_id uuid not null references public.users(id) on delete cascade,
  notification_id text not null,
  read_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, notification_id)
);

create index if not exists idx_user_notification_reads_user_id
  on public.user_notification_reads (user_id);

create index if not exists idx_user_notification_reads_read_at
  on public.user_notification_reads (read_at desc);
