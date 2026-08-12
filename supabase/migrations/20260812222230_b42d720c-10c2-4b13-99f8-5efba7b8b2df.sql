CREATE OR REPLACE FUNCTION public.resolve_credit_pricing(_currency text DEFAULT 'GBP', _at timestamptz DEFAULT now())
RETURNS TABLE (currency text, cost_price numeric, profit_percentage numeric, sell_price numeric, follows_base boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(coalesce(_currency, 'GBP'));
  v_cost numeric;
  v_pct numeric;
  v_follows boolean := true;
BEGIN
  SELECT r.credit_value, r.profit_percentage, coalesce(r.follows_base, true)
    INTO v_cost, v_pct, v_follows
  FROM public.currency_rates r
  WHERE r.currency = v_code AND r.effective_from <= _at
  ORDER BY r.effective_from DESC LIMIT 1;

  -- Only fall back to the base currency when this currency has no rate at all.
  IF v_cost IS NULL AND v_code <> 'GBP' THEN
    SELECT r.credit_value
      INTO v_cost
    FROM public.currency_rates r
    WHERE r.currency = 'GBP' AND r.effective_from <= _at
    ORDER BY r.effective_from DESC LIMIT 1;
  END IF;

  IF v_cost IS NULL THEN v_cost := 0.31; END IF;
  v_follows := coalesce(v_follows, true);

  IF v_follows OR v_pct IS NULL THEN
    v_pct := coalesce(public.profit_percentage_at(_at), 50);
  END IF;

  RETURN QUERY SELECT v_code, v_cost, v_pct, round(v_cost * (1 + v_pct / 100.0), 6), v_follows;
END $$;

REVOKE ALL ON FUNCTION public.resolve_credit_pricing(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_credit_pricing(text, timestamptz) TO authenticated, service_role;