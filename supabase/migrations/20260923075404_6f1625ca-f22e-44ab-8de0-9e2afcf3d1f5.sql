create table if not exists public.aura_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  path text not null unique,
  name text not null,
  mime text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.aura_attachments to authenticated;
grant all on public.aura_attachments to service_role;

alter table public.aura_attachments enable row level security;

drop policy if exists "aura attachments owner" on public.aura_attachments;
create policy "aura attachments owner"
  on public.aura_attachments for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create index if not exists aura_attachments_owner_idx
  on public.aura_attachments (owner_id, created_at desc);

drop policy if exists "aura attachments read own" on storage.objects;
create policy "aura attachments read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'aura-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "aura attachments insert own" on storage.objects;
create policy "aura attachments insert own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'aura-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "aura attachments update own" on storage.objects;
create policy "aura attachments update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'aura-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "aura attachments delete own" on storage.objects;
create policy "aura attachments delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'aura-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );