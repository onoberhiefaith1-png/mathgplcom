CREATE OR REPLACE FUNCTION public.redeem_staff_code(_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_code_id uuid;
  v_entitlement text;
  v_unit uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN 'unauthorised'; END IF;

  SELECT c.id, c.entitlement INTO v_code_id, v_entitlement
  FROM public.staff_codes c
  WHERE upper(c.code) = upper(btrim(_code)) AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > now())
  LIMIT 1;

  IF v_code_id IS NULL THEN RETURN 'invalid'; END IF;

  v_unit := public.ensure_user_cost_unit(v_uid);
  IF v_unit IS NULL THEN RETURN 'invalid'; END IF;

  INSERT INTO public.staff_redemptions (code_id, cost_unit_id, user_id, active)
  VALUES (v_code_id, v_unit, v_uid, true)
  ON CONFLICT (code_id, cost_unit_id) DO UPDATE SET active = true;

  RETURN v_entitlement;
END $$;

REVOKE EXECUTE ON FUNCTION public.redeem_staff_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_staff_code(text) TO authenticated, service_role;

-- Any non-staff code is a discount on a real payment.
CREATE OR REPLACE FUNCTION public.record_usage_event(
  _user_id uuid, _org_id uuid, _category cost_category, _metric text, _quantity numeric,
  _unit text DEFAULT 'unit', _feature text DEFAULT NULL, _model text DEFAULT NULL,
  _occurred_at timestamptz DEFAULT now(), _resource_label text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_unit_id uuid; v_price numeric; v_cost numeric; v_rate numeric; v_charge numeric;
  v_discount numeric := 0; v_code text; v_due numeric := 0; v_paid numeric := 0;
  v_status text := 'unpaid'; v_wallet uuid; v_balance numeric; v_result numeric; v_id uuid;
  v_credit_price numeric; v_cost_credits numeric; v_charge_credits numeric; v_paid_credits numeric;
  v_is_staff boolean := false;
BEGIN
  v_unit_id := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit_id IS NULL THEN RETURN NULL; END IF;

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
  FROM public.staff_redemptions r
  JOIN public.staff_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > _occurred_at)
  LIMIT 1;

  SELECT c.code, c.discount_percentage INTO v_code, v_discount
  FROM public.promo_redemptions r
  JOIN public.promo_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND coalesce(c.kind, 'discount') <> 'staff'
    AND (c.expires_at IS NULL OR c.expires_at > _occurred_at)
  ORDER BY c.discount_percentage DESC LIMIT 1;

  v_discount := COALESCE(v_discount, 0);

  IF COALESCE(v_is_staff, false) THEN
    v_status := 'staff'; v_due := 0; v_paid := 0; v_code := NULL; v_discount := 0;
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