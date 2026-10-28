alter table public.subscriptions add column if not exists payment_state text not null default 'ok';

create or replace function public.can_afford_usage(_user_id uuid, _org_id uuid, _estimated numeric default 0)
returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
DECLARE v_unit uuid; v_rate numeric; v_state text; v_balance numeric;
BEGIN
  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN RETURN true; END IF;

  SELECT s.locked_profit_rate, s.payment_state INTO v_rate, v_state FROM public.subscriptions s
   WHERE s.cost_unit_id = v_unit AND s.status = 'active' AND s.plan <> 'free'
     AND s.period_start <= now() AND (s.period_end IS NULL OR s.period_end >= now())
   ORDER BY s.period_start DESC LIMIT 1;
  IF v_rate IS NULL THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.promo_redemptions r JOIN public.promo_codes c ON c.id = r.code_id
    WHERE r.cost_unit_id = v_unit AND r.active AND c.active AND c.kind = 'staff'
  ) THEN RETURN true; END IF;

  -- A failed renewal keeps plan features but pauses chargeable generation.
  IF coalesce(v_state, 'ok') = 'past_due' THEN RETURN false; END IF;

  SELECT balance INTO v_balance FROM public.credit_wallets WHERE cost_unit_id = v_unit;
  RETURN COALESCE(v_balance, 0) >= COALESCE(_estimated, 0);
END $function$;

-- Payment succeeded: lock the live plan version on, allocate its credits.
create or replace function public.paddle_activate_paid_plan(
  _user_id uuid, _plan_key text, _provider_sub_id text,
  _amount numeric default null, _period_end timestamptz default null,
  _customer_id text default null
) returns uuid language plpgsql security definer set search_path to 'public' as $function$
DECLARE v_org uuid; v_sub uuid;
BEGIN
  SELECT active_org_id INTO v_org FROM public.profiles WHERE user_id = _user_id;

  v_sub := public.activate_subscription(
    _user_id, _plan_key, v_org, 'paddle', _provider_sub_id, _amount,
    greatest(coalesce(extract(day from (coalesce(_period_end, now() + interval '30 days') - now()))::int, 30), 1)
  );

  UPDATE public.subscriptions
     SET period_end = coalesce(_period_end, period_end),
         payment_state = 'ok',
         cancel_at = NULL,
         scheduled_plan_id = NULL,
         region = coalesce(_customer_id, region),
         updated_at = now()
   WHERE id = v_sub;

  RETURN v_sub;
END $function$;

create or replace function public.paddle_set_payment_state(_provider_sub_id text, _state text)
returns void language sql security definer set search_path to 'public' as $function$
  UPDATE public.subscriptions
     SET payment_state = CASE WHEN _state = 'past_due' THEN 'past_due' ELSE 'ok' END,
         updated_at = now()
   WHERE provider_subscription_id = _provider_sub_id AND status = 'active';
$function$;

-- Cancellation keeps everything until the paid period ends.
create or replace function public.paddle_cancel_at_period_end(_provider_sub_id text, _period_end timestamptz default null)
returns void language sql security definer set search_path to 'public' as $function$
  UPDATE public.subscriptions
     SET cancel_at = coalesce(_period_end, period_end, now()),
         status = CASE WHEN coalesce(_period_end, period_end, now()) <= now() THEN 'canceled' ELSE status END,
         updated_at = now()
   WHERE provider_subscription_id = _provider_sub_id AND status = 'active';
$function$;

-- Downgrades wait for the next renewal so the paid rate stays locked.
create or replace function public.paddle_schedule_plan_change(_provider_sub_id text, _plan_key text)
returns void language sql security definer set search_path to 'public' as $function$
  UPDATE public.subscriptions
     SET scheduled_plan_id = _plan_key, updated_at = now()
   WHERE provider_subscription_id = _provider_sub_id AND status = 'active';
$function$;

grant execute on function public.paddle_activate_paid_plan(uuid, text, text, numeric, timestamptz, text) to service_role;
grant execute on function public.paddle_set_payment_state(text, text) to service_role;
grant execute on function public.paddle_cancel_at_period_end(text, timestamptz) to service_role;
grant execute on function public.paddle_schedule_plan_change(text, text) to service_role;