-- Consent-based support access: staff can let a platform administrator
-- enter their account without sharing a password, and can revoke that
-- permission at any time. Applied by Lovable; do not apply from a local client.

create table if not exists public.support_access_grants (
  user_id uuid primary key,
  allowed boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.support_access_requests (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  admin_user_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'allowed', 'denied', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint support_access_requests_not_self check (target_user_id <> admin_user_id)
);

create unique index if not exists support_access_requests_one_pending
  on public.support_access_requests (target_user_id, admin_user_id)
  where status = 'pending';

create index if not exists support_access_requests_target_idx
  on public.support_access_requests (target_user_id, created_at desc);

create table if not exists public.support_access_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  target_user_id uuid not null,
  entered_at timestamptz not null default now()
);

create index if not exists support_access_log_target_idx
  on public.support_access_log (target_user_id, entered_at desc);

grant select, insert, update on public.support_access_grants to authenticated;
grant all on public.support_access_grants to service_role;

grant select, insert, update on public.support_access_requests to authenticated;
grant all on public.support_access_requests to service_role;

grant select on public.support_access_log to authenticated;
grant all on public.support_access_log to service_role;

alter table public.support_access_grants enable row level security;
alter table public.support_access_requests enable row level security;
alter table public.support_access_log enable row level security;

-- Grants: the account holder reads and writes only their own row.
-- Platform administrators may read status, never write a grant for someone else.
drop policy if exists "Users read own support access grant" on public.support_access_grants;
create policy "Users read own support access grant"
  on public.support_access_grants
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner'::public.app_role)
    or public.has_role(auth.uid(), 'co_admin'::public.app_role)
  );

drop policy if exists "Users insert own support access grant" on public.support_access_grants;
create policy "Users insert own support access grant"
  on public.support_access_grants
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own support access grant" on public.support_access_grants;
create policy "Users update own support access grant"
  on public.support_access_grants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Requests: the target reads and answers their own; admins insert and read status.
drop policy if exists "Users and admins read support access requests" on public.support_access_requests;
create policy "Users and admins read support access requests"
  on public.support_access_requests
  for select
  to authenticated
  using (
    target_user_id = auth.uid()
    or admin_user_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner'::public.app_role)
    or public.has_role(auth.uid(), 'co_admin'::public.app_role)
  );

drop policy if exists "Admins insert support access requests" on public.support_access_requests;
create policy "Admins insert support access requests"
  on public.support_access_requests
  for insert
  to authenticated
  with check (
    admin_user_id = auth.uid()
    and target_user_id <> auth.uid()
    and status = 'pending'
    and (
      public.has_role(auth.uid(), 'platform_owner'::public.app_role)
      or public.has_role(auth.uid(), 'co_admin'::public.app_role)
    )
  );

drop policy if exists "Targets respond to support access requests" on public.support_access_requests;
create policy "Targets respond to support access requests"
  on public.support_access_requests
  for update
  to authenticated
  using (target_user_id = auth.uid() and status = 'pending')
  with check (target_user_id = auth.uid() and status in ('allowed', 'denied'));

drop policy if exists "Admins cancel support access requests" on public.support_access_requests;
create policy "Admins cancel support access requests"
  on public.support_access_requests
  for update
  to authenticated
  using (
    admin_user_id = auth.uid()
    and status = 'pending'
    and (
      public.has_role(auth.uid(), 'platform_owner'::public.app_role)
      or public.has_role(auth.uid(), 'co_admin'::public.app_role)
    )
  )
  with check (admin_user_id = auth.uid() and status = 'cancelled');

-- Log: visible to the person who was entered, and to platform administrators.
-- Inserts are service-role only (no authenticated insert policy).
drop policy if exists "Targets and admins read support access log" on public.support_access_log;
create policy "Targets and admins read support access log"
  on public.support_access_log
  for select
  to authenticated
  using (
    target_user_id = auth.uid()
    or public.has_role(auth.uid(), 'platform_owner'::public.app_role)
    or public.has_role(auth.uid(), 'co_admin'::public.app_role)
  );

-- Keep grant and request rows in sync without relying on the client.
create or replace function public.sync_support_access_from_grant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.allowed
     and (tg_op = 'INSERT' or old.allowed is distinct from new.allowed) then
    update public.support_access_requests
       set status = 'allowed',
           responded_at = now()
     where target_user_id = new.user_id
       and status = 'pending';
  elsif not new.allowed
        and tg_op = 'UPDATE'
        and old.allowed is distinct from new.allowed then
    update public.support_access_requests
       set status = 'cancelled',
           responded_at = now()
     where target_user_id = new.user_id
       and status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists support_access_grants_sync on public.support_access_grants;
create trigger support_access_grants_sync
  after insert or update of allowed on public.support_access_grants
  for each row
  execute function public.sync_support_access_from_grant();

create or replace function public.sync_support_access_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'allowed'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.support_access_grants (user_id, allowed, updated_at)
    values (new.target_user_id, true, now())
    on conflict (user_id) do update
      set allowed = true,
          updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists support_access_requests_sync on public.support_access_requests;
create trigger support_access_requests_sync
  after insert or update of status on public.support_access_requests
  for each row
  execute function public.sync_support_access_from_request();

do $$
begin
  begin
    alter publication supabase_realtime add table public.support_access_grants;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;