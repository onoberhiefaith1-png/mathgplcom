ALTER TABLE public.credit_wallets ADD COLUMN IF NOT EXISTS reserved numeric NOT NULL DEFAULT 0;

ALTER TABLE public.platform_cost_settings
  ADD COLUMN IF NOT EXISTS credit_start_floor numeric NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS credit_stop_floor numeric NOT NULL DEFAULT 0.30;

CREATE TABLE IF NOT EXISTS public.credit_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.credit_wallets(id) ON DELETE CASCADE,
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  operation_key text NOT NULL UNIQUE,
  feature text,
  credits numeric NOT NULL DEFAULT 0,
  consumed numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  settled_at timestamptz
);

GRANT SELECT ON public.credit_reservations TO authenticated;
GRANT ALL ON public.credit_reservations TO service_role;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their reservations" ON public.credit_reservations;
CREATE POLICY "Owners read their reservations"
  ON public.credit_reservations FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'platform_owner')
    OR public.has_role(auth.uid(), 'co_admin')
    OR EXISTS (SELECT 1 FROM public.cost_units cu
                WHERE cu.id = credit_reservations.cost_unit_id AND cu.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS credit_reservations_open_idx
  ON public.credit_reservations (wallet_id) WHERE status = 'open';

ALTER TABLE public.usage_events ADD COLUMN IF NOT EXISTS operation_key text;
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_operation_key_idx
  ON public.usage_events (operation_key) WHERE operation_key IS NOT NULL;

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS service_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_amount numeric NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.credit_headroom(_user_id uuid, _org_id uuid DEFAULT NULL)
RETURNS TABLE(enforced boolean, balance numeric, reserved numeric, available numeric,
              start_floor numeric, stop_floor numeric, blocked_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_unit uuid; v_balance numeric; v_reserved numeric; v_state text;
  v_start numeric; v_stop numeric; v_staff boolean := false;
BEGIN
  SELECT coalesce(s.credit_start_floor, 0.50), coalesce(s.credit_stop_floor, 0.30)
    INTO v_start, v_stop FROM public.platform_cost_settings s WHERE s.id = 1;
  v_start := coalesce(v_start, 0.50); v_stop := coalesce(v_stop, 0.30);

  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, v_start, v_stop, NULL::text;
    RETURN;
  END IF;

  SELECT true INTO v_staff
  FROM public.staff_redemptions r JOIN public.staff_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit AND r.active AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > now()) LIMIT 1;

  SELECT w.balance, w.reserved INTO v_balance, v_reserved
  FROM public.credit_wallets w WHERE w.cost_unit_id = v_unit;

  SELECT s.payment_state INTO v_state FROM public.subscriptions s
   WHERE s.cost_unit_id = v_unit AND s.status = 'active'
     AND s.period_start <= now() AND (s.period_end IS NULL OR s.period_end >= now())
   ORDER BY s.period_start DESC LIMIT 1;

  RETURN QUERY SELECT
    NOT coalesce(v_staff, false),
    coalesce(v_balance, 0),
    coalesce(v_reserved, 0),
    coalesce(v_balance, 0) - coalesce(v_reserved, 0),
    v_start, v_stop,
    CASE WHEN coalesce(v_staff, false) THEN NULL
         WHEN coalesce(v_state, 'ok') = 'past_due' THEN 'past_due' ELSE NULL END;
END $function$;

CREATE OR REPLACE FUNCTION public.consume_credits(
  _cost_unit_id uuid, _credits numeric, _usage_event_id uuid DEFAULT NULL, _note text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_wallet uuid; v_left numeric; v_spent numeric := 0; v_take numeric; r record; v_balance numeric;
BEGIN
  IF coalesce(_credits, 0) <= 0 THEN RETURN 0; END IF;
  v_wallet := public.ensure_credit_wallet(_cost_unit_id);
  v_left := _credits;

  FOR r IN
    SELECT id, remaining FROM public.credit_grants
     WHERE wallet_id = v_wallet AND remaining > 0 AND expires_at > now()
     ORDER BY expires_at ASC, granted_at ASC FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := least(r.remaining, v_left);
    UPDATE public.credit_grants SET remaining = remaining - v_take WHERE id = r.id;
    v_left := v_left - v_take;
    v_spent := v_spent + v_take;
  END LOOP;

  UPDATE public.credit_wallets w
     SET balance = greatest(coalesce((
           SELECT sum(g.remaining) FROM public.credit_grants g
            WHERE g.wallet_id = w.id AND g.remaining > 0 AND g.expires_at > now()
         ), 0), 0),
         lifetime_spent = lifetime_spent + v_spent,
         updated_at = now()
   WHERE w.id = v_wallet
  RETURNING balance INTO v_balance;

  IF v_spent > 0 THEN
    INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, usage_event_id, note)
    VALUES (v_wallet, _cost_unit_id, 'deduction', -v_spent, coalesce(v_balance, 0), _usage_event_id, _note);
  END IF;

  RETURN v_spent;
END $function$;

CREATE OR REPLACE FUNCTION public.reserve_credits(
  _user_id uuid, _org_id uuid DEFAULT NULL, _operation_key text DEFAULT NULL,
  _credits numeric DEFAULT 0.5, _feature text DEFAULT NULL)
RETURNS TABLE(ok boolean, reason text, available numeric, required numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_unit uuid; v_wallet uuid; v_balance numeric; v_reserved numeric;
  v_avail numeric; v_head record; v_need numeric;
BEGIN
  IF _operation_key IS NULL THEN
    RETURN QUERY SELECT false, 'missing_operation_key'::text, 0::numeric, 0::numeric;
    RETURN;
  END IF;
  v_need := greatest(coalesce(_credits, 0), 0);

  SELECT * INTO v_head FROM public.credit_headroom(_user_id, _org_id);
  IF NOT v_head.enforced THEN
    RETURN QUERY SELECT true, 'unmetered'::text, v_head.available, v_need;
    RETURN;
  END IF;
  IF v_head.blocked_reason IS NOT NULL THEN
    RETURN QUERY SELECT false, v_head.blocked_reason, v_head.available, v_need;
    RETURN;
  END IF;

  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  v_wallet := public.ensure_credit_wallet(v_unit);

  IF EXISTS (SELECT 1 FROM public.credit_reservations WHERE operation_key = _operation_key) THEN
    SELECT balance - reserved INTO v_avail FROM public.credit_wallets WHERE id = v_wallet;
    RETURN QUERY SELECT true, 'already_reserved'::text, coalesce(v_avail, 0), v_need;
    RETURN;
  END IF;

  SELECT balance, reserved INTO v_balance, v_reserved
    FROM public.credit_wallets WHERE id = v_wallet FOR UPDATE;
  v_avail := coalesce(v_balance, 0) - coalesce(v_reserved, 0);

  IF v_avail <= v_head.start_floor THEN
    RETURN QUERY SELECT false, 'floor'::text, v_avail, v_need;
    RETURN;
  END IF;
  IF v_need > v_avail THEN
    RETURN QUERY SELECT false, 'insufficient'::text, v_avail, v_need;
    RETURN;
  END IF;

  INSERT INTO public.credit_reservations (wallet_id, cost_unit_id, operation_key, feature, credits)
  VALUES (v_wallet, v_unit, _operation_key, _feature, v_need);

  UPDATE public.credit_wallets
     SET reserved = coalesce(reserved, 0) + v_need, updated_at = now()
   WHERE id = v_wallet;

  RETURN QUERY SELECT true, 'reserved'::text, v_avail - v_need, v_need;
END $function$;

CREATE OR REPLACE FUNCTION public.settle_credit_reservation(
  _operation_key text, _status text DEFAULT 'consumed')
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r record; v_hold numeric;
BEGIN
  SELECT * INTO r FROM public.credit_reservations
   WHERE operation_key = _operation_key AND status = 'open' FOR UPDATE;
  IF r.id IS NULL THEN RETURN false; END IF;

  v_hold := greatest(coalesce(r.credits, 0), 0);

  UPDATE public.credit_wallets
     SET reserved = greatest(coalesce(reserved, 0) - v_hold, 0), updated_at = now()
   WHERE id = r.wallet_id;

  UPDATE public.credit_reservations
     SET status = coalesce(_status, 'consumed'), settled_at = now()
   WHERE id = r.id;

  RETURN true;
END $function$;

CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE r record; v_count integer := 0;
BEGIN
  FOR r IN SELECT operation_key FROM public.credit_reservations
            WHERE status = 'open' AND expires_at < now()
  LOOP
    PERFORM public.settle_credit_reservation(r.operation_key, 'expired');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $function$;

DROP FUNCTION IF EXISTS public.record_usage_event(
  uuid, uuid, cost_category, text, numeric, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS public.record_usage_event(
  uuid, uuid, cost_category, text, numeric, text, text, text, timestamptz, text);

CREATE OR REPLACE FUNCTION public.record_usage_event(
  _user_id uuid, _org_id uuid, _category cost_category, _metric text, _quantity numeric,
  _unit text DEFAULT 'unit', _feature text DEFAULT NULL, _model text DEFAULT NULL,
  _occurred_at timestamptz DEFAULT now(), _resource_label text DEFAULT NULL,
  _operation_key text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_unit_id uuid; v_price numeric; v_cost numeric; v_rate numeric; v_charge numeric;
  v_discount numeric := 0; v_code text; v_due_credits numeric := 0; v_spent numeric := 0;
  v_status text := 'unpaid'; v_result numeric; v_id uuid;
  v_credit_price numeric; v_cost_credits numeric; v_charge_credits numeric;
  v_paid numeric := 0; v_is_staff boolean := false;
BEGIN
  v_unit_id := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit_id IS NULL THEN RETURN NULL; END IF;

  IF _operation_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.usage_events WHERE operation_key = _operation_key;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT p.cost_price, p.profit_percentage INTO v_credit_price, v_rate
  FROM public.resolve_credit_pricing('GBP', _occurred_at) p;
  IF v_credit_price IS NULL OR v_credit_price <= 0 THEN v_credit_price := 0.31; END IF;

  SELECT p.unit_price INTO v_price
  FROM public.resource_prices p
  WHERE p.metric = _metric AND p.effective_from <= _occurred_at
  ORDER BY p.effective_from DESC LIMIT 1;

  v_cost := COALESCE(v_price, 0) * COALESCE(_quantity, 0);

  IF _metric LIKE '%.credits' THEN
    v_cost_credits := COALESCE(_quantity, 0);
    v_cost := v_cost_credits * v_credit_price;
  ELSE
    v_cost_credits := v_cost / v_credit_price;
  END IF;

  SELECT s.locked_profit_rate INTO v_rate
  FROM public.subscriptions s
  WHERE s.cost_unit_id = v_unit_id AND s.status = 'active' AND s.plan <> 'free'
    AND s.period_start <= _occurred_at
    AND (s.period_end IS NULL OR s.period_end >= _occurred_at)
  ORDER BY s.period_start DESC LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT p.profit_percentage INTO v_rate FROM public.resolve_credit_pricing('GBP', _occurred_at) p;
  END IF;
  v_rate := COALESCE(v_rate, 0);

  v_charge := v_cost * (1 + v_rate / 100.0);
  v_charge_credits := v_cost_credits * (1 + v_rate / 100.0);

  SELECT true INTO v_is_staff
  FROM public.staff_redemptions r JOIN public.staff_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > _occurred_at) LIMIT 1;

  SELECT c.code, c.discount_percentage INTO v_code, v_discount
  FROM public.promo_redemptions r JOIN public.promo_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND coalesce(c.kind, 'discount') <> 'staff'
    AND (c.expires_at IS NULL OR c.expires_at > _occurred_at)
  ORDER BY c.discount_percentage DESC LIMIT 1;
  v_discount := COALESCE(v_discount, 0);

  INSERT INTO public.usage_events (
    cost_unit_id, actor_user_id, category, metric, quantity, unit,
    unit_price, actual_cost, profit_rate, customer_charge, profit,
    feature, model, occurred_at, payment_status, discount_percentage,
    promo_code, amount_paid, financial_result, resource_label,
    cost_credits, charge_credits, paid_credits, credit_price, operation_key
  ) VALUES (
    v_unit_id, _user_id, _category, _metric, COALESCE(_quantity, 0), _unit,
    v_price, v_cost, v_rate, v_charge, v_charge - v_cost,
    _feature, _model, _occurred_at, 'unpaid', v_discount,
    v_code, 0, -v_cost, _resource_label,
    v_cost_credits, v_charge_credits, 0, v_credit_price, _operation_key
  ) RETURNING id INTO v_id;

  IF COALESCE(v_is_staff, false) THEN
    v_status := 'staff'; v_discount := 0; v_code := NULL;
  ELSE
    v_due_credits := greatest(v_charge_credits * (1 - v_discount / 100.0), 0);
    v_spent := public.consume_credits(v_unit_id, v_due_credits, v_id, _feature);
    IF v_due_credits = 0 THEN
      v_status := 'free';
    ELSIF v_spent >= v_due_credits THEN
      v_status := CASE WHEN v_discount > 0 THEN 'discounted' ELSE 'paid' END;
    ELSIF v_spent > 0 THEN
      v_status := 'partial';
    END IF;
  END IF;

  v_paid := v_spent * v_credit_price;
  v_result := v_paid - v_cost;

  UPDATE public.usage_events
     SET payment_status = v_status, discount_percentage = v_discount, promo_code = v_code,
         paid_credits = v_spent, amount_paid = v_paid, financial_result = v_result
   WHERE id = v_id;

  IF _operation_key IS NOT NULL THEN
    UPDATE public.credit_reservations
       SET consumed = coalesce(consumed, 0) + v_spent
     WHERE operation_key = _operation_key AND status = 'open';
  END IF;

  INSERT INTO public.cost_unit_totals (
    cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit,
    amount_paid, financial_result, cost_credits, charge_credits, paid_credits
  )
  VALUES (v_unit_id, (_occurred_at AT TIME ZONE 'UTC')::date, _category, COALESCE(_quantity, 0),
          v_cost, v_charge, v_charge - v_cost, v_paid, v_result,
          v_cost_credits, v_charge_credits, v_spent)
  ON CONFLICT (cost_unit_id, day, category) DO UPDATE
    SET quantity = public.cost_unit_totals.quantity + EXCLUDED.quantity,
        actual_cost = public.cost_unit_totals.actual_cost + EXCLUDED.actual_cost,
        customer_charge = public.cost_unit_totals.customer_charge + EXCLUDED.customer_charge,
        profit = public.cost_unit_totals.profit + EXCLUDED.profit,
        amount_paid = public.cost_unit_totals.amount_paid + EXCLUDED.amount_paid,
        financial_result = public.cost_unit_totals.financial_result + EXCLUDED.financial_result,
        cost_credits = public.cost_unit_totals.cost_credits + EXCLUDED.cost_credits,
        charge_credits = public.cost_unit_totals.charge_credits + EXCLUDED.charge_credits,
        paid_credits = public.cost_unit_totals.paid_credits + EXCLUDED.paid_credits,
        updated_at = now();

  RETURN v_id;
END $function$;

CREATE OR REPLACE FUNCTION public.plan_allows_ai(_user_id uuid, _org_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE v_unit uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.has_role(_user_id, 'platform_owner') OR public.has_role(_user_id, 'co_admin')
     OR public.has_role(_user_id, 'student') THEN
    RETURN true;
  END IF;

  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN RETURN false; END IF;

  IF EXISTS (SELECT 1 FROM public.staff_redemptions r JOIN public.staff_codes c ON c.id = r.code_id
              WHERE r.cost_unit_id = v_unit AND r.active AND c.active
                AND (c.expires_at IS NULL OR c.expires_at > now())) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.cost_unit_id = v_unit AND s.status = 'active' AND s.plan <> 'free'
       AND s.period_start <= now() AND (s.period_end IS NULL OR s.period_end >= now())
  );
END $function$;

CREATE OR REPLACE FUNCTION public.activate_subscription(_user_id uuid, _plan_key text, _org_id uuid DEFAULT NULL::uuid, _provider text DEFAULT NULL::text, _provider_subscription_id text DEFAULT NULL::text, _amount_paid numeric DEFAULT NULL::numeric, _period_days integer DEFAULT 30)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_plan public.plans;
  v_version public.plan_versions;
  v_unit uuid;
  v_sub uuid;
  v_total numeric;
  v_service numeric;
  v_credit numeric;
  v_end timestamptz := now() + make_interval(days => greatest(coalesce(_period_days, 30), 1));
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE key = _plan_key AND active;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan %', _plan_key; END IF;
  IF v_plan.status <> 'available' THEN RAISE EXCEPTION 'Plan % is not available', _plan_key; END IF;

  SELECT * INTO v_version FROM public.plan_versions
   WHERE plan_id = v_plan.id AND status = 'published'
   ORDER BY version_no DESC LIMIT 1;

  v_unit := public.resolve_cost_unit(_user_id, _org_id);

  UPDATE public.subscriptions SET status = 'replaced', updated_at = now()
   WHERE cost_unit_id = v_unit AND status = 'active';

  INSERT INTO public.subscriptions (
    cost_unit_id, user_id, org_id, plan, plan_id, status, provider, provider_subscription_id,
    stripe_subscription_id, locked_profit_rate, currency, credit_price, credit_sell_price,
    included_credits, final_price, plan_version_id, period_start, period_end
  ) VALUES (
    v_unit, _user_id, _org_id,
    CASE WHEN coalesce(v_version.price, 0) = 0 THEN 'free' ELSE v_plan.key END,
    v_plan.key, 'active', _provider, _provider_subscription_id, _provider_subscription_id,
    coalesce(v_version.profit_percentage, 0),
    coalesce(v_version.currency, v_plan.currency),
    coalesce(v_version.credit_cost, 0),
    coalesce(v_version.credit_sell_price, 0),
    coalesce(v_version.included_credits, 0),
    coalesce(_amount_paid, v_version.price, 0),
    v_version.id, now(), v_end
  ) RETURNING id INTO v_sub;

  IF coalesce(v_version.included_credits, 0) > 0 THEN
    PERFORM public.adjust_credits(v_unit, v_version.included_credits, 'plan_allocation',
      'Included credits for ' || v_plan.key);
  END IF;

  v_total := coalesce(_amount_paid, v_version.price, 0);
  v_credit := least(coalesce(v_version.credit_amount, 0), v_total);
  v_service := greatest(v_total - v_credit, 0);

  INSERT INTO public.payment_transactions (
    subscription_id, user_id, org_id, plan_id, plan_version_id, provider, provider_ref,
    amount, currency, credits_allocated, status, service_amount, credit_amount
  ) VALUES (
    v_sub, _user_id, _org_id, v_plan.key, v_version.id,
    coalesce(_provider, 'none'), _provider_subscription_id,
    v_total, coalesce(v_version.currency, v_plan.currency),
    coalesce(v_version.included_credits, 0),
    CASE WHEN v_total = 0 THEN 'free' ELSE 'succeeded' END,
    v_service, v_credit
  );

  RETURN v_sub;
END $function$;

CREATE OR REPLACE FUNCTION public.paddle_record_topup(_user_id uuid, _provider_ref text, _credits numeric, _amount numeric, _currency text DEFAULT 'GBP'::text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
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
    amount, currency, credits_allocated, status, service_amount, credit_amount
  ) VALUES (
    NULL, _user_id, v_org, 'credit_topup', NULL, 'paddle', _provider_ref,
    coalesce(_amount, 0), upper(coalesce(_currency, 'GBP')), _credits, 'succeeded',
    0, coalesce(_amount, 0)
  );

  RETURN true;
END $function$;

DROP POLICY IF EXISTS "Published plan versions readable by signed-in users" ON public.plan_versions;

REVOKE EXECUTE ON FUNCTION public.consume_credits(uuid, numeric, uuid, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.reserve_credits(uuid, uuid, text, numeric, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.settle_credit_reservation(text, text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.release_expired_reservations() FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.credit_headroom(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plan_allows_ai(uuid, uuid) TO authenticated, service_role;