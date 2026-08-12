-- 1. Proper home for the provider customer reference
alter table public.subscriptions add column if not exists provider_customer_id text;
update public.subscriptions
   set provider_customer_id = region
 where provider = 'paddle' and provider_customer_id is null and region like 'ctm_%';

-- 2. Webhook idempotency ledger
create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paddle',
  event_id text not null,
  event_type text not null,
  environment text not null default 'sandbox',
  status text not null default 'processed',
  error text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);
grant all on public.payment_events to service_role;
alter table public.payment_events enable row level security;
create policy "Platform owners can read payment events"
  on public.payment_events for select to authenticated
  using (public.has_role(auth.uid(), 'platform_owner'));

-- 3. Credit top-ups bought by members
alter table public.credit_purchases add column if not exists cost_unit_id uuid references public.cost_units(id) on delete set null;
alter table public.credit_purchases add column if not exists user_id uuid;
alter table public.credit_purchases add column if not exists provider text;
alter table public.credit_purchases add column if not exists provider_ref text;
create unique index if not exists credit_purchases_provider_ref_key
  on public.credit_purchases (provider, provider_ref) where provider_ref is not null;
grant select on public.credit_purchases to authenticated;
grant all on public.credit_purchases to service_role;
alter table public.credit_purchases enable row level security;
drop policy if exists "Members can view their own top-ups" on public.credit_purchases;
create policy "Members can view their own top-ups"
  on public.credit_purchases for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'platform_owner'));

-- 4. Activation keeps the customer reference on the new row
create or replace function public.paddle_activate_paid_plan(
  _user_id uuid, _plan_key text, _provider_sub_id text,
  _amount numeric default null, _period_end timestamptz default null, _customer_id text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_org uuid; v_sub uuid; v_customer text;
BEGIN
  SELECT active_org_id INTO v_org FROM public.profiles WHERE user_id = _user_id;

  SELECT coalesce(_customer_id, s.provider_customer_id) INTO v_customer
    FROM public.subscriptions s
   WHERE s.provider_subscription_id = _provider_sub_id
   ORDER BY s.period_start DESC LIMIT 1;

  v_sub := public.activate_subscription(
    _user_id, _plan_key, v_org, 'paddle', _provider_sub_id, _amount,
    greatest(coalesce(extract(day from (coalesce(_period_end, now() + interval '30 days') - now()))::int, 30), 1)
  );

  UPDATE public.subscriptions
     SET period_end = coalesce(_period_end, period_end),
         payment_state = 'ok',
         cancel_at = NULL,
         scheduled_plan_id = NULL,
         provider_customer_id = coalesce(_customer_id, v_customer),
         updated_at = now()
   WHERE id = v_sub;

  RETURN v_sub;
END $function$;

-- 5. Top-up credits, applied exactly once per payment
create or replace function public.paddle_record_topup(
  _user_id uuid, _provider_ref text, _credits numeric,
  _amount numeric, _currency text default 'GBP')
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_org uuid; v_unit uuid;
BEGIN
  IF _provider_ref IS NULL OR coalesce(_credits, 0) <= 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.credit_purchases
              WHERE provider = 'paddle' AND provider_ref = _provider_ref) THEN
    RETURN false;
  END IF;

  SELECT active_org_id INTO v_org FROM public.profiles WHERE user_id = _user_id;
  v_unit := public.resolve_cost_unit(_user_id, v_org);
  IF v_unit IS NULL THEN RETURN false; END IF;

  INSERT INTO public.credit_purchases (
    credits, unit_cost, currency, note, cost_unit_id, user_id, provider, provider_ref, created_by
  ) VALUES (
    _credits,
    CASE WHEN _credits > 0 THEN coalesce(_amount, 0) / _credits ELSE 0 END,
    upper(coalesce(_currency, 'GBP')), 'Credit top-up', v_unit, _user_id, 'paddle', _provider_ref, _user_id
  );

  PERFORM public.adjust_credits(v_unit, _credits, 'topup', 'Credit top-up');

  INSERT INTO public.payment_transactions (
    subscription_id, user_id, org_id, plan_id, plan_version_id, provider, provider_ref,
    amount, currency, credits_allocated, status
  ) VALUES (
    NULL, _user_id, v_org, 'credit_topup', NULL, 'paddle', _provider_ref,
    coalesce(_amount, 0), upper(coalesce(_currency, 'GBP')), _credits, 'succeeded'
  );

  RETURN true;
END $function$;

-- 6. A cancelled plan actually ends when its paid period runs out
create or replace function public.expire_lapsed_subscriptions()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE r record; v_free text; v_count int := 0;
BEGIN
  FOR r IN
    SELECT s.id, s.user_id, s.org_id, s.plan_id, s.plan
      FROM public.subscriptions s
     WHERE s.status = 'active'
       AND s.cancel_at IS NOT NULL
       AND s.cancel_at <= now()
  LOOP
    UPDATE public.subscriptions
       SET status = 'canceled', updated_at = now()
     WHERE id = r.id;
    v_count := v_count + 1;

    SELECT p2.key INTO v_free
      FROM public.plans p2
      JOIN public.plans p1 ON p1.key = coalesce(r.plan_id, r.plan)
     WHERE p2.audience = p1.audience
       AND p2.is_free
       AND p2.active
       AND p2.status = 'available'
     ORDER BY p2.sort_order LIMIT 1;

    -- Leftover credits stay in the wallet; the free plan simply adds no more.
    IF v_free IS NOT NULL AND r.user_id IS NOT NULL THEN
      BEGIN
        PERFORM public.activate_subscription(r.user_id, v_free, r.org_id, 'none', NULL, 0, 30);
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;
  END LOOP;

  RETURN v_count;
END $function$;

revoke all on function public.expire_lapsed_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_lapsed_subscriptions() to service_role;
revoke all on function public.paddle_record_topup(uuid, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.paddle_record_topup(uuid, text, numeric, numeric, text) to service_role;

-- 7. Plan change against the same subscription, applied immediately
create or replace function public.paddle_apply_plan_change(_provider_sub_id text, _plan_key text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_user uuid; v_end timestamptz; v_customer text;
BEGIN
  SELECT user_id, period_end, provider_customer_id INTO v_user, v_end, v_customer
    FROM public.subscriptions
   WHERE provider_subscription_id = _provider_sub_id AND status = 'active'
   ORDER BY period_start DESC LIMIT 1;
  IF v_user IS NULL THEN RETURN NULL; END IF;
  RETURN public.paddle_activate_paid_plan(v_user, _plan_key, _provider_sub_id, NULL, v_end, v_customer);
END $function$;

revoke all on function public.paddle_apply_plan_change(text, text) from public, anon, authenticated;
grant execute on function public.paddle_apply_plan_change(text, text) to service_role;