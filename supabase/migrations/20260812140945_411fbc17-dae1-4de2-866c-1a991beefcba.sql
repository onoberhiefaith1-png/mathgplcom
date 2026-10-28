-- 1. Credit columns (snapshots) -------------------------------------------
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS cost_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_price numeric;

ALTER TABLE public.cost_unit_totals
  ADD COLUMN IF NOT EXISTS cost_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charge_credits numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_credits numeric NOT NULL DEFAULT 0;

-- 2. Currency rates (insert-only history) ---------------------------------
CREATE TABLE IF NOT EXISTS public.currency_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency text NOT NULL,
  credit_value numeric NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.currency_rates TO authenticated;
GRANT ALL ON public.currency_rates TO service_role;

ALTER TABLE public.currency_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read currency rates" ON public.currency_rates;
CREATE POLICY "Platform admins read currency rates"
  ON public.currency_rates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE INDEX IF NOT EXISTS currency_rates_currency_idx
  ON public.currency_rates (currency, effective_from DESC);

INSERT INTO public.currency_rates (currency, credit_value, effective_from, note)
SELECT 'GBP', COALESCE(s.credit_rate, 0.30), COALESCE(s.updated_at, now()), 'Initial buy rate'
FROM public.platform_cost_settings s
WHERE s.id = 1
  AND NOT EXISTS (SELECT 1 FROM public.currency_rates WHERE currency = 'GBP');

CREATE OR REPLACE FUNCTION public.credit_value_at(_currency text DEFAULT 'GBP', _at timestamptz DEFAULT now())
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT r.credit_value FROM public.currency_rates r
      WHERE r.currency = _currency AND r.effective_from <= _at
      ORDER BY r.effective_from DESC LIMIT 1),
    (SELECT s.credit_rate FROM public.platform_cost_settings s WHERE s.id = 1),
    0.30
  );
$$;

-- 3. Roll-up recompute now carries credits -------------------------------
CREATE OR REPLACE FUNCTION public.recompute_cost_unit_day(_cost_unit_id uuid, _day date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.cost_unit_totals
   WHERE cost_unit_id = _cost_unit_id AND day = _day;

  INSERT INTO public.cost_unit_totals (
    cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit,
    amount_paid, financial_result, cost_credits, charge_credits, paid_credits
  )
  SELECT e.cost_unit_id, _day, e.category,
         sum(e.quantity), sum(e.actual_cost), sum(e.customer_charge),
         sum(e.profit), sum(e.amount_paid), sum(e.financial_result),
         sum(e.cost_credits), sum(e.charge_credits), sum(e.paid_credits)
  FROM public.usage_events e
  WHERE e.cost_unit_id = _cost_unit_id
    AND (e.occurred_at AT TIME ZONE 'UTC')::date = _day
  GROUP BY e.cost_unit_id, e.category;
END $function$;

-- 4. Metering: credits + percentage fallback ------------------------------
CREATE OR REPLACE FUNCTION public.record_usage_event(_user_id uuid, _org_id uuid, _category cost_category, _metric text, _quantity numeric, _unit text DEFAULT 'unit'::text, _feature text DEFAULT NULL::text, _model text DEFAULT NULL::text, _occurred_at timestamp with time zone DEFAULT now(), _resource_label text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_id uuid; v_price numeric; v_cost numeric; v_rate numeric; v_charge numeric;
  v_discount numeric := 0; v_code text; v_kind text; v_due numeric := 0; v_paid numeric := 0;
  v_status text := 'unpaid'; v_wallet uuid; v_balance numeric; v_result numeric; v_id uuid;
  v_credit_price numeric; v_cost_credits numeric; v_charge_credits numeric; v_paid_credits numeric;
BEGIN
  v_unit_id := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit_id IS NULL THEN RETURN NULL; END IF;

  v_credit_price := public.credit_value_at('GBP', _occurred_at);
  IF v_credit_price IS NULL OR v_credit_price <= 0 THEN v_credit_price := 0.30; END IF;

  SELECT p.unit_price INTO v_price
  FROM public.resource_prices p
  WHERE p.metric = _metric AND p.effective_from <= _occurred_at
  ORDER BY p.effective_from DESC LIMIT 1;

  v_cost := COALESCE(v_price, 0) * COALESCE(_quantity, 0);

  -- Credits are the accounting unit: credit-metered events carry credits in
  -- the quantity; priced metrics convert at the rate in force at that moment.
  IF _metric LIKE '%.credits' THEN
    v_cost_credits := COALESCE(_quantity, 0);
    v_cost := v_cost_credits * v_credit_price;
  ELSE
    v_cost_credits := v_cost / v_credit_price;
  END IF;

  -- Percentage Profit: the subscription's locked rate, otherwise the pricing
  -- version in force when the usage happened.
  SELECT s.locked_profit_rate INTO v_rate
  FROM public.subscriptions s
  WHERE s.cost_unit_id = v_unit_id AND s.status = 'active' AND s.plan <> 'free'
    AND s.period_start <= _occurred_at
    AND (s.period_end IS NULL OR s.period_end >= _occurred_at)
  ORDER BY s.period_start DESC LIMIT 1;

  IF v_rate IS NULL THEN
    v_rate := COALESCE(public.profit_percentage_at(_occurred_at), 0);
  END IF;

  v_charge := v_cost * (1 + v_rate / 100.0);
  v_charge_credits := v_cost_credits * (1 + v_rate / 100.0);

  SELECT c.code, c.kind, c.discount_percentage INTO v_code, v_kind, v_discount
  FROM public.promo_redemptions r
  JOIN public.promo_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > _occurred_at)
  ORDER BY c.discount_percentage DESC LIMIT 1;

  v_discount := COALESCE(v_discount, 0);

  IF v_kind = 'staff' THEN
    v_status := 'staff'; v_due := 0; v_paid := 0;
  ELSE
    v_due := v_charge * (1 - v_discount / 100.0);
    v_wallet := public.ensure_credit_wallet(v_unit_id);
    SELECT balance INTO v_balance FROM public.credit_wallets WHERE id = v_wallet FOR UPDATE;

    IF COALESCE(v_balance, 0) >= v_due AND v_due > 0 THEN
      UPDATE public.credit_wallets
         SET balance = balance - v_due, lifetime_spent = lifetime_spent + v_due, updated_at = now()
       WHERE id = v_wallet
      RETURNING balance INTO v_balance;
      v_paid := v_due;
      v_status := CASE WHEN v_discount > 0 THEN 'discounted' ELSE 'paid' END;
    ELSE
      v_paid := 0;
      v_status := 'unpaid';
    END IF;
  END IF;

  v_paid_credits := CASE WHEN v_charge > 0 THEN v_charge_credits * (v_paid / v_charge) ELSE 0 END;

  -- Unpaid usage is a loss of what was consumed; expected revenue is never
  -- treated as collected.
  v_result := v_paid - v_cost;

  INSERT INTO public.usage_events (
    cost_unit_id, actor_user_id, category, metric, quantity, unit,
    unit_price, actual_cost, profit_rate, customer_charge, profit,
    feature, model, occurred_at, payment_status, discount_percentage,
    promo_code, amount_paid, financial_result, resource_label,
    cost_credits, charge_credits, paid_credits, credit_price
  ) VALUES (
    v_unit_id, _user_id, _category, _metric, COALESCE(_quantity, 0), _unit,
    v_price, v_cost, v_rate, v_charge, v_charge - v_cost,
    _feature, _model, _occurred_at, v_status, v_discount,
    v_code, v_paid, v_result, _resource_label,
    v_cost_credits, v_charge_credits, v_paid_credits, v_credit_price
  ) RETURNING id INTO v_id;

  IF v_paid > 0 AND v_wallet IS NOT NULL THEN
    INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, usage_event_id, note)
    VALUES (v_wallet, v_unit_id, 'deduction', -v_paid, COALESCE(v_balance, 0), v_id, _feature);
  END IF;

  INSERT INTO public.cost_unit_totals (
    cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit,
    amount_paid, financial_result, cost_credits, charge_credits, paid_credits
  )
  VALUES (v_unit_id, (_occurred_at AT TIME ZONE 'UTC')::date, _category, COALESCE(_quantity, 0),
          v_cost, v_charge, v_charge - v_cost, v_paid, v_result,
          v_cost_credits, v_charge_credits, v_paid_credits)
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

-- 5. Platform usage import records credits + applicable percentage --------
CREATE OR REPLACE FUNCTION public.import_platform_usage(_cost_unit_id uuid, _day date, _rows jsonb, _credit_rate numeric DEFAULT NULL::numeric)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rate numeric;
  v_row jsonb;
  v_cat public.cost_category;
  v_credits numeric;
  v_cost numeric;
  v_pct numeric;
  v_charge numeric;
  v_charge_credits numeric;
  v_count integer := 0;
  v_at timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin')) THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  SELECT COALESCE(_credit_rate, s.credit_rate, 0.30) INTO v_rate
  FROM public.platform_cost_settings s WHERE s.id = 1;

  IF _credit_rate IS NOT NULL THEN
    UPDATE public.platform_cost_settings SET credit_rate = _credit_rate, updated_at = now() WHERE id = 1;
    INSERT INTO public.currency_rates (currency, credit_value, note)
    VALUES ('GBP', _credit_rate, 'Buy rate set during platform usage import');
  END IF;

  v_at := (_day::timestamptz + interval '12 hours');

  SELECT COALESCE(s.locked_profit_rate, public.profit_percentage_at(v_at)) INTO v_pct
  FROM public.subscriptions s
  WHERE s.cost_unit_id = _cost_unit_id AND s.status = 'active' AND s.plan <> 'free'
    AND s.period_start <= v_at AND (s.period_end IS NULL OR s.period_end >= v_at)
  ORDER BY s.period_start DESC LIMIT 1;

  v_pct := COALESCE(v_pct, public.profit_percentage_at(v_at), 0);

  DELETE FROM public.usage_events
   WHERE source = 'platform_import' AND import_day = _day AND cost_unit_id = _cost_unit_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) LOOP
    v_cat := (v_row->>'category')::public.cost_category;
    v_credits := COALESCE((v_row->>'credits')::numeric, 0);
    CONTINUE WHEN v_credits = 0;
    v_cost := v_credits * v_rate;
    v_charge := v_cost * (1 + v_pct / 100.0);
    v_charge_credits := v_credits * (1 + v_pct / 100.0);

    INSERT INTO public.usage_events (
      cost_unit_id, actor_user_id, category, metric, quantity, unit,
      unit_price, actual_cost, profit_rate, customer_charge, profit,
      feature, model, occurred_at, payment_status, discount_percentage,
      amount_paid, financial_result, resource_label, source, import_day,
      cost_credits, charge_credits, paid_credits, credit_price
    ) VALUES (
      _cost_unit_id, NULL, v_cat, v_cat::text || '.credits', v_credits, 'credits',
      v_rate, v_cost, v_pct, v_charge, v_charge - v_cost,
      COALESCE(NULLIF(v_row->>'feature',''), 'Platform usage'),
      NULLIF(v_row->>'model',''), v_at, 'unpaid', 0,
      0, -v_cost, NULLIF(v_row->>'label',''), 'platform_import', _day,
      v_credits, v_charge_credits, 0, v_rate
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.recompute_cost_unit_day(_cost_unit_id, _day);
  RETURN v_count;
END $function$;

-- 6. Payments record credits collected ------------------------------------
CREATE OR REPLACE FUNCTION public.apply_usage_payment(_cost_unit_id uuid, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_left numeric := COALESCE(_amount, 0);
  v_take numeric;
  r record;
  v_days date[];
  d date;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin')) THEN
    RAISE EXCEPTION 'not_platform_admin';
  END IF;

  FOR r IN
    SELECT id, customer_charge, actual_cost, amount_paid, charge_credits,
           (occurred_at AT TIME ZONE 'UTC')::date AS day
    FROM public.usage_events
    WHERE cost_unit_id = _cost_unit_id
      AND payment_status IN ('unpaid', 'free')
      AND customer_charge > amount_paid
    ORDER BY occurred_at
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(v_left, r.customer_charge - r.amount_paid);
    UPDATE public.usage_events
       SET amount_paid = amount_paid + v_take,
           paid_credits = CASE WHEN customer_charge > 0
                               THEN charge_credits * ((amount_paid + v_take) / customer_charge)
                               ELSE 0 END,
           payment_status = CASE WHEN amount_paid + v_take >= customer_charge THEN 'paid' ELSE 'unpaid' END,
           financial_result = (amount_paid + v_take) - actual_cost
     WHERE id = r.id;
    v_left := v_left - v_take;
    v_days := array_append(v_days, r.day);
  END LOOP;

  FOREACH d IN ARRAY COALESCE(v_days, ARRAY[]::date[]) LOOP
    PERFORM public.recompute_cost_unit_day(_cost_unit_id, d);
  END LOOP;

  RETURN COALESCE(_amount, 0) - v_left;
END $function$;

-- 7. Backfill existing history (credits preserved, percentage resolved) ---
UPDATE public.usage_events e
   SET credit_price = COALESCE(e.credit_price, public.credit_value_at('GBP', e.occurred_at)),
       cost_credits = CASE
         WHEN e.cost_credits > 0 THEN e.cost_credits
         WHEN e.metric LIKE '%.credits' THEN COALESCE(e.quantity, 0)
         ELSE COALESCE(e.actual_cost, 0) / NULLIF(public.credit_value_at('GBP', e.occurred_at), 0)
       END;

UPDATE public.usage_events e
   SET profit_rate = CASE WHEN COALESCE(e.profit_rate, 0) > 0 THEN e.profit_rate
                          ELSE COALESCE(public.profit_percentage_at(e.occurred_at), 0) END
 WHERE COALESCE(e.profit_rate, 0) = 0;

UPDATE public.usage_events e
   SET customer_charge = COALESCE(e.actual_cost, 0) * (1 + COALESCE(e.profit_rate, 0) / 100.0),
       profit = COALESCE(e.actual_cost, 0) * (COALESCE(e.profit_rate, 0) / 100.0),
       charge_credits = e.cost_credits * (1 + COALESCE(e.profit_rate, 0) / 100.0),
       paid_credits = CASE WHEN COALESCE(e.customer_charge, 0) > 0
                           THEN e.cost_credits * (1 + COALESCE(e.profit_rate, 0) / 100.0)
                                * (COALESCE(e.amount_paid, 0) / (COALESCE(e.actual_cost, 0) * (1 + COALESCE(e.profit_rate, 0) / 100.0)))
                           ELSE 0 END,
       financial_result = COALESCE(e.amount_paid, 0) - COALESCE(e.actual_cost, 0)
 WHERE e.source = 'platform_import' OR e.charge_credits = 0;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT cost_unit_id, (occurred_at AT TIME ZONE 'UTC')::date AS day FROM public.usage_events LOOP
    PERFORM public.recompute_cost_unit_day(r.cost_unit_id, r.day);
  END LOOP;
END $$;