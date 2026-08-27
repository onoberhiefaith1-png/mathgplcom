-- Notification & communication engine.
-- One table holds every message (broadcast, system alert, student question,
-- response); a second table holds one row per recipient with read state.
-- Sending is done only through server functions (service_role), so a client
-- can never forge a sender or an audience.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'broadcast'
    check (kind in ('broadcast', 'system', 'student_question', 'response')),
  sender_user_id uuid,
  sender_role text,
  subject text,
  body text not null,
  context jsonb not null default '{}'::jsonb,
  target_path text,
  thread_root_id uuid references public.notifications(id) on delete cascade,
  parent_id uuid references public.notifications(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null,
  read_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, recipient_user_id)
);

create index if not exists notifications_thread_idx on public.notifications (thread_root_id, created_at);
create index if not exists notifications_sender_idx on public.notifications (sender_user_id, created_at desc);
create index if not exists notification_recipients_inbox_idx
  on public.notification_recipients (recipient_user_id, read_at, created_at desc);

grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
grant select, update on public.notification_recipients to authenticated;
grant all on public.notification_recipients to service_role;

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

-- A person sees a message they sent, or a message addressed to them.
drop policy if exists "notifications visible to sender and recipients" on public.notifications;
create policy "notifications visible to sender and recipients"
on public.notifications
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or exists (
    select 1 from public.notification_recipients r
    where r.notification_id = public.notifications.id
      and r.recipient_user_id = auth.uid()
  )
);

drop policy if exists "recipients visible to recipient and sender" on public.notification_recipients;
create policy "recipients visible to recipient and sender"
on public.notification_recipients
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or exists (
    select 1 from public.notifications n
    where n.id = public.notification_recipients.notification_id
      and n.sender_user_id = auth.uid()
  )
);

-- Only the read state of one's own row may be changed from the client.
drop policy if exists "recipient updates own read state" on public.notification_recipients;
create policy "recipient updates own read state"
on public.notification_recipients
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.notification_recipients
  where recipient_user_id = auth.uid()
    and read_at is null
$$;

grant execute on function public.unread_notification_count() to authenticated;

alter table public.notification_recipients replica identity full;
