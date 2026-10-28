-- 1. Platform credit inventory ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credits numeric NOT NULL CHECK (credits > 0),
  unit_cost numeric NOT NULL CHECK (unit_cost >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  purchased_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_purchases TO authenticated;
GRANT ALL ON public.credit_purchases TO service_role;
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read credit purchases"
  ON public.credit_purchases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 2. Per-currency profit override ---------------------------------------------
ALTER TABLE public.currency_rates
  ADD COLUMN IF NOT EXISTS profit_percentage numeric,
  ADD COLUMN IF NOT EXISTS follows_base boolean NOT NULL DEFAULT true;

-- Base currency cost moves to 0.31 as a new insert-only version.
INSERT INTO public.currency_rates (currency, credit_value, profit_percentage, follows_base, effective_from, note)
VALUES ('GBP', 0.31, 50, true, now(), 'Base cost per credit purchased from the infrastructure provider');

-- 3. Plans ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  audience text NOT NULL,
  label text NOT NULL,
  subscription_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'available',
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.plans TO anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON public.plans FOR SELECT USING (active);

INSERT INTO public.plans (key, audience, label, subscription_amount, credit_amount, currency, status, sort_order)
VALUES
  ('teacher_free',      'teacher', 'Free',      0,     0,  'GBP', 'available',   1),
  ('teacher_pro',       'teacher', 'Pro',       4.99,  5.00, 'GBP', 'available',   2),
  ('teacher_super_pro', 'teacher', 'Super Pro', 0,     0,  'GBP', 'coming_soon', 3),
  ('school_pro',        'school',  'Pro',       19.99, 30.00, 'GBP', 'available',   1),
  ('school_super_pro',  'school',  'Super Pro', 0,     0,  'GBP', 'coming_soon', 2),
  ('parent_free',       'parent',  'Free',      0,     0,  'GBP', 'available',   1),
  ('parent_pro',        'parent',  'Pro',       2.99,  2.00, 'GBP', 'available',   2)
ON CONFLICT (key) DO NOTHING;

-- 4. Subscription pricing snapshot --------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS included_credits numeric,
  ADD COLUMN IF NOT EXISTS credit_sell_price numeric,
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid,
  ADD COLUMN IF NOT EXISTS region text;

-- 5. Staff access is not a promotion -----------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text,
  entitlement text NOT NULL DEFAULT 'pro',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.staff_codes(id) ON DELETE CASCADE,
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  user_id uuid,
  active boolean NOT NULL DEFAULT true,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, cost_unit_id)
);

GRANT SELECT ON public.staff_codes TO authenticated;
GRANT ALL ON public.staff_codes TO service_role;
ALTER TABLE public.staff_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read staff codes"
  ON public.staff_codes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

GRANT SELECT ON public.staff_redemptions TO authenticated;
GRANT ALL ON public.staff_redemptions TO service_role;
ALTER TABLE public.staff_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read staff redemptions"
  ON public.staff_redemptions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE POLICY "Staff read their own redemption"
  ON public.staff_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS staff_redemptions_unit_idx ON public.staff_redemptions (cost_unit_id) WHERE active;

-- 6. Pricing engine -----------------------------------------------------------
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
  v_base_pct numeric;
BEGIN
  SELECT r.credit_value, r.profit_percentage, r.follows_base
    INTO v_cost, v_pct, v_follows
  FROM public.currency_rates r
  WHERE r.currency = v_code AND r.effective_from <= _at
  ORDER BY r.effective_from DESC LIMIT 1;

  SELECT r.credit_value, r.profit_percentage
    INTO v_cost, v_base_pct
  FROM public.currency_rates r
  WHERE r.currency = 'GBP' AND r.effective_from <= _at
    AND (v_cost IS NULL)
  ORDER BY r.effective_from DESC LIMIT 1;

  IF v_cost IS NULL THEN v_cost := 0.31; END IF;

  IF v_follows OR v_pct IS NULL THEN
    v_pct := coalesce(public.profit_percentage_at(_at), 50);
  END IF;

  RETURN QUERY SELECT v_code, v_cost, v_pct, round(v_cost * (1 + v_pct / 100.0), 6), v_follows;
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_credit_pricing(text, timestamptz) TO authenticated, service_role;

-- 7. Usage recording reads pricing through the engine and honours staff codes --
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

  -- Credits are the accounting unit: credit-metered events carry credits in
  -- the quantity; priced metrics convert at the rate in force at that moment.
  IF _metric LIKE '%.credits' THEN
    v_cost_credits := COALESCE(_quantity, 0);
    v_cost := v_cost_credits * v_credit_price;
  ELSE
    v_cost_credits := v_cost / v_credit_price;
  END IF;

  -- Percentage Profit: the subscription's locked rate wins over the engine.
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

  -- Staff access: entitlement without payment, but the cost is still recorded.
  SELECT true INTO v_is_staff
  FROM public.staff_redemptions r
  JOIN public.staff_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND (c.expires_at IS NULL OR c.expires_at > _occurred_at)
  LIMIT 1;

  -- Promotions are discounts on a real payment, never free access.
  SELECT c.code, c.discount_percentage INTO v_code, v_discount
  FROM public.promo_redemptions r
  JOIN public.promo_codes c ON c.id = r.code_id
  WHERE r.cost_unit_id = v_unit_id AND r.active AND c.active
    AND c.kind = 'promo'
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

  -- Unpaid or staff usage is a loss of what was consumed; expected revenue is
  -- never treated as collected.
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