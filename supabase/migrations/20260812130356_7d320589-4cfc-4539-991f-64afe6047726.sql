ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS import_day date;

CREATE INDEX IF NOT EXISTS usage_events_source_day_idx
  ON public.usage_events (source, import_day, cost_unit_id);

ALTER TABLE public.platform_cost_settings
  ADD COLUMN IF NOT EXISTS credit_rate numeric NOT NULL DEFAULT 0.30;

INSERT INTO public.resource_prices (category, metric, unit, unit_price, currency, note)
SELECT c.cat::public.cost_category, c.metric, 'credits', 0.30, 'GBP', 'Lovable platform credit rate'
FROM (VALUES
  ('database','database.credits'),
  ('network','network.credits'),
  ('storage','storage.credits'),
  ('compute','compute.credits'),
  ('realtime','realtime.credits'),
  ('ai','ai.credits')
) AS c(cat, metric)
WHERE NOT EXISTS (SELECT 1 FROM public.resource_prices p WHERE p.metric = c.metric);

CREATE OR REPLACE FUNCTION public.recompute_cost_unit_day(_cost_unit_id uuid, _day date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.cost_unit_totals
   WHERE cost_unit_id = _cost_unit_id AND day = _day;

  INSERT INTO public.cost_unit_totals (
    cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit, amount_paid, financial_result
  )
  SELECT e.cost_unit_id, _day, e.category,
         sum(e.quantity), sum(e.actual_cost), sum(e.customer_charge),
         sum(e.profit), sum(e.amount_paid), sum(e.financial_result)
  FROM public.usage_events e
  WHERE e.cost_unit_id = _cost_unit_id
    AND (e.occurred_at AT TIME ZONE 'UTC')::date = _day
  GROUP BY e.cost_unit_id, e.category;
END $$;

CREATE OR REPLACE FUNCTION public.import_platform_usage(
  _cost_unit_id uuid,
  _day date,
  _rows jsonb,
  _credit_rate numeric DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rate numeric;
  v_row jsonb;
  v_cat public.cost_category;
  v_credits numeric;
  v_cost numeric;
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
  END IF;

  v_at := (_day::timestamptz + interval '12 hours');

  DELETE FROM public.usage_events
   WHERE source = 'platform_import' AND import_day = _day AND cost_unit_id = _cost_unit_id;

  FOR v_row IN SELECT * FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) LOOP
    v_cat := (v_row->>'category')::public.cost_category;
    v_credits := COALESCE((v_row->>'credits')::numeric, 0);
    CONTINUE WHEN v_credits = 0;
    v_cost := v_credits * v_rate;

    INSERT INTO public.usage_events (
      cost_unit_id, actor_user_id, category, metric, quantity, unit,
      unit_price, actual_cost, profit_rate, customer_charge, profit,
      feature, model, occurred_at, payment_status, discount_percentage,
      amount_paid, financial_result, resource_label, source, import_day
    ) VALUES (
      _cost_unit_id, NULL, v_cat, v_cat::text || '.credits', v_credits, 'credits',
      v_rate, v_cost, 0, v_cost, 0,
      COALESCE(NULLIF(v_row->>'feature',''), 'Platform usage'),
      NULLIF(v_row->>'model',''), v_at, 'unpaid', 0,
      0, -v_cost, NULLIF(v_row->>'label',''), 'platform_import', _day
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public.recompute_cost_unit_day(_cost_unit_id, _day);
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.apply_usage_payment(_cost_unit_id uuid, _amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    SELECT id, customer_charge, actual_cost, amount_paid,
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
END $$;

REVOKE ALL ON FUNCTION public.import_platform_usage(uuid, date, jsonb, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_usage_payment(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_platform_usage(uuid, date, jsonb, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_usage_payment(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recompute_cost_unit_day(uuid, date) TO service_role;