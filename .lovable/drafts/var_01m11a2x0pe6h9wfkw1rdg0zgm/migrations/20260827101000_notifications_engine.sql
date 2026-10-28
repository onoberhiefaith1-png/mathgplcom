-- Structured notification and communication engine.
-- One message row per notification, fanned out to explicit recipients.
-- Students never initiate a broadcast; their only message kind is a question.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('broadcast', 'system', 'student_question', 'response')),
  sender_user_id uuid,
  sender_role text,
  subject text,
  body text not null,
  context jsonb not null default '{}'::jsonb,
  target_path text,
  thread_root_id uuid,
  parent_id uuid references public.notifications(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, recipient_user_id)
);

create index if not exists notifications_thread_idx on public.notifications (thread_root_id, created_at);
create index if not exists notifications_sender_idx on public.notifications (sender_user_id, created_at desc);
create index if not exists notification_recipients_inbox_idx
  on public.notification_recipients (recipient_user_id, created_at desc);
create index if not exists notification_recipients_unread_idx
  on public.notification_recipients (recipient_user_id) where read_at is null;

grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
grant select, insert, update, delete on public.notification_recipients to authenticated;
grant all on public.notification_recipients to service_role;

alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;

-- Am I a recipient of this message? Security definer so the policy on
-- notifications can read the recipient rows without recursion.
create or replace function public.is_notification_recipient(_notification_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.notification_recipients r
    where r.notification_id = _notification_id
      and r.recipient_user_id = _user_id
  )
$$;

grant execute on function public.is_notification_recipient(uuid, uuid) to authenticated, service_role;

-- Unread badge count for the signed-in person.
create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from public.notification_recipients r
  where r.recipient_user_id = auth.uid()
    and r.read_at is null
$$;

grant execute on function public.unread_notification_count() to authenticated, service_role;

-- A message is readable by the person who sent it and by its recipients.
create policy "Read own notifications"
on public.notifications
for select
to authenticated
using (
  sender_user_id = auth.uid()
  or public.is_notification_recipient(id, auth.uid())
);

-- Only recipient rows addressed to me, or belonging to messages I sent.
create policy "Read own recipient rows"
on public.notification_recipients
for select
to authenticated
using (
  recipient_user_id = auth.uid()
  or exists (
    select 1 from public.notifications n
    where n.id = notification_id and n.sender_user_id = auth.uid()
  )
);

-- Marking as read is the only change a recipient may make.
create policy "Mark my notifications read"
on public.notification_recipients
for update
to authenticated
using (recipient_user_id = auth.uid())
with check (recipient_user_id = auth.uid());

-- Sending and fan-out run through server functions on the service role, which
-- resolve the audience from the account's real relationships.
