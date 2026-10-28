UPDATE public.usage_events e
   SET actual_cost = e.cost_credits * COALESCE(NULLIF(e.credit_price, 0), 0.30),
       customer_charge = e.charge_credits * COALESCE(NULLIF(e.credit_price, 0), 0.30),
       profit = (e.charge_credits - e.cost_credits) * COALESCE(NULLIF(e.credit_price, 0), 0.30),
       financial_result = COALESCE(e.amount_paid, 0) - (e.cost_credits * COALESCE(NULLIF(e.credit_price, 0), 0.30))
 WHERE e.cost_credits > 0 AND COALESCE(e.actual_cost, 0) = 0;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT cost_unit_id, (occurred_at AT TIME ZONE 'UTC')::date AS day FROM public.usage_events LOOP
    PERFORM public.recompute_cost_unit_day(r.cost_unit_id, r.day);
  END LOOP;
END $$;