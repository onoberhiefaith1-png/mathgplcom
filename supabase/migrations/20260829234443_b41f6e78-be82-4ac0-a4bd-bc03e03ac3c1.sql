-- Professional notification layer: categories, opt-in responses, attachments,
-- audience record, recipient count and response tracking. Additive only.

alter table public.notifications
  add column if not exists category text not null default 'announcement',
  add column if not exists allow_responses boolean not null default true,
  add column if not exists attachment jsonb,
  add column if not exists audience jsonb,
  add column if not exists recipient_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'notifications_category_check'
  ) then
    alter table public.notifications
      add constraint notifications_category_check check (
        category in (
          'announcement','important','class','assignment',
          'course','system','event','reminder','update'
        )
      );
  end if;
end $$;

alter table public.notification_recipients
  add column if not exists responded_at timestamptz;

create index if not exists notifications_category_idx
  on public.notifications (category, created_at desc);
create index if not exists notification_recipients_responded_idx
  on public.notification_recipients (notification_id) where responded_at is not null;

-- Engagement for one notification. Readable by its sender or an administrator.
create or replace function public.notification_engagement(_notification_id uuid)
returns table (recipients integer, read_count integer, responded_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _sender uuid;
begin
  select sender_user_id into _sender from public.notifications where id = _notification_id;
  if _sender is null then
    return;
  end if;
  if _sender <> auth.uid()
     and not public.has_role(auth.uid(), 'platform_owner')
     and not public.has_role(auth.uid(), 'co_admin') then
    return;
  end if;

  return query
  select
    count(*)::int,
    count(*) filter (where r.read_at is not null)::int,
    count(*) filter (where r.responded_at is not null)::int
  from public.notification_recipients r
  where r.notification_id = _notification_id;
end $$;

grant execute on function public.notification_engagement(uuid) to authenticated, service_role;