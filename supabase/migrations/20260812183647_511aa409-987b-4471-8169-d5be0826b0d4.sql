-- ── Pay-as-you-go credit packages (credits only; money is always derived) ──
create table if not exists public.credit_packages (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  credits numeric not null check (credits > 0),
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.credit_packages to authenticated, anon;
grant all on public.credit_packages to service_role;
alter table public.credit_packages enable row level security;
drop policy if exists "Anyone can read active credit packages" on public.credit_packages;
create policy "Anyone can read active credit packages"
  on public.credit_packages for select to authenticated, anon using (active);
drop policy if exists "Platform owners manage credit packages" on public.credit_packages;
create policy "Platform owners manage credit packages"
  on public.credit_packages for all to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'))
  with check (public.has_role(auth.uid(), 'platform_owner'));

insert into public.credit_packages (external_id, credits, label, sort_order) values
  ('credits_20', 20, 'Starter top-up', 1),
  ('credits_50', 50, 'Standard top-up', 2),
  ('credits_100', 100, 'Large top-up', 3),
  ('credits_250', 250, 'Bulk top-up', 4)
on conflict (external_id) do nothing;

-- ── Dated credit batches so credits can expire one year after they arrive ──
create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.credit_wallets(id) on delete cascade,
  cost_unit_id uuid not null references public.cost_units(id) on delete cascade,
  credits numeric not null,
  remaining numeric not null,
  source text not null default 'allocation',
  note text,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 year')
);
create index if not exists credit_grants_unit_idx on public.credit_grants (cost_unit_id, expires_at);
create index if not exists credit_grants_open_idx on public.credit_grants (wallet_id, expires_at) where remaining > 0;
grant select on public.credit_grants to authenticated;
grant all on public.credit_grants to service_role;
alter table public.credit_grants enable row level security;
drop policy if exists "Members can view their own credit grants" on public.credit_grants;
create policy "Members can view their own credit grants"
  on public.credit_grants for select to authenticated
  using (
    public.has_role(auth.uid(), 'platform_owner')
    or exists (select 1 from public.cost_units cu
                where cu.id = credit_grants.cost_unit_id and cu.user_id = auth.uid())
  );

-- Existing balances become one batch each, so nothing is lost by the change.
insert into public.credit_grants (wallet_id, cost_unit_id, credits, remaining, source, note, granted_at, expires_at)
select w.id, w.cost_unit_id, w.balance, w.balance, 'migrated', 'Balance carried into dated batches', now(), now() + interval '1 year'
  from public.credit_wallets w
 where w.balance > 0
   and not exists (select 1 from public.credit_grants g where g.wallet_id = w.id);

-- ── Credits move through batches; the wallet balance mirrors them ──
create or replace function public.adjust_credits(
  _cost_unit_id uuid, _amount numeric, _kind text, _note text default null)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_wallet uuid; v_balance numeric; v_left numeric; r record; v_take numeric;
BEGIN
  v_wallet := public.ensure_credit_wallet(_cost_unit_id);

  IF coalesce(_amount, 0) > 0 THEN
    INSERT INTO public.credit_grants (wallet_id, cost_unit_id, credits, remaining, source, note)
    VALUES (v_wallet, _cost_unit_id, _amount, _amount, coalesce(_kind, 'allocation'), _note);
  ELSIF coalesce(_amount, 0) < 0 THEN
    v_left := -_amount;
    FOR r IN
      SELECT id, remaining FROM public.credit_grants
       WHERE wallet_id = v_wallet AND remaining > 0 AND expires_at > now()
       ORDER BY expires_at ASC, granted_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := least(r.remaining, v_left);
      UPDATE public.credit_grants SET remaining = remaining - v_take WHERE id = r.id;
      v_left := v_left - v_take;
    END LOOP;
  END IF;

  UPDATE public.credit_wallets w
     SET balance = coalesce((
           SELECT sum(g.remaining) FROM public.credit_grants g
            WHERE g.wallet_id = w.id AND g.remaining > 0 AND g.expires_at > now()
         ), 0),
         lifetime_purchased = lifetime_purchased + GREATEST(coalesce(_amount, 0), 0),
         updated_at = now()
   WHERE w.id = v_wallet
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, note)
  VALUES (v_wallet, _cost_unit_id, coalesce(_kind, 'adjustment'), _amount, v_balance, _note);

  RETURN v_balance;
END $function$;

-- ── Nightly sweep: batches older than a year stop counting ──
create or replace function public.expire_credit_grants()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE r record; v_count int := 0; v_balance numeric;
BEGIN
  FOR r IN
    SELECT id, wallet_id, cost_unit_id, remaining FROM public.credit_grants
     WHERE remaining > 0 AND expires_at <= now()
  LOOP
    UPDATE public.credit_grants SET remaining = 0 WHERE id = r.id;

    UPDATE public.credit_wallets w
       SET balance = coalesce((
             SELECT sum(g.remaining) FROM public.credit_grants g
              WHERE g.wallet_id = w.id AND g.remaining > 0 AND g.expires_at > now()
           ), 0),
           updated_at = now()
     WHERE w.id = r.wallet_id
    RETURNING balance INTO v_balance;

    INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, note)
    VALUES (r.wallet_id, r.cost_unit_id, 'expired', -r.remaining, coalesce(v_balance, 0),
            'Credits expired one year after they were added');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $function$;

grant execute on function public.expire_credit_grants() to service_role;

-- ── What a member sees about their own wallet ──
create or replace function public.my_credit_summary()
returns table (balance numeric, next_expiry timestamptz, expiring_credits numeric)
language sql
stable
security definer
set search_path to 'public'
as $function$
  WITH unit AS (
    SELECT cu.id FROM public.cost_units cu
     WHERE cu.user_id = auth.uid() AND cu.owner_kind = 'user' LIMIT 1
  ), open AS (
    SELECT g.remaining, g.expires_at FROM public.credit_grants g
     WHERE g.cost_unit_id = (SELECT id FROM unit) AND g.remaining > 0 AND g.expires_at > now()
  )
  SELECT coalesce((SELECT sum(remaining) FROM open), 0),
         (SELECT min(expires_at) FROM open),
         coalesce((SELECT sum(remaining) FROM open
                    WHERE expires_at = (SELECT min(expires_at) FROM open)), 0);
$function$;

grant execute on function public.my_credit_summary() to authenticated;