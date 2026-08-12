-- 1. Usage event accounting columns
ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS discount_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_result numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS resource_label text;

CREATE INDEX IF NOT EXISTS usage_events_occurred_idx ON public.usage_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_unit_occurred_idx ON public.usage_events (cost_unit_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS usage_events_cat_occurred_idx ON public.usage_events (category, occurred_at DESC);

ALTER TABLE public.cost_unit_totals
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS financial_result numeric NOT NULL DEFAULT 0;

-- 2. Credit wallets
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_unit_id uuid NOT NULL UNIQUE REFERENCES public.cost_units(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  lifetime_purchased numeric NOT NULL DEFAULT 0,
  lifetime_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.credit_wallets TO authenticated;
GRANT ALL ON public.credit_wallets TO service_role;
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their wallet" ON public.credit_wallets FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cost_units cu WHERE cu.id = credit_wallets.cost_unit_id AND cu.user_id = auth.uid()));
CREATE POLICY "Admins read all wallets" ON public.credit_wallets FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.credit_wallets(id) ON DELETE CASCADE,
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'deduction',
  amount numeric NOT NULL,
  balance_after numeric NOT NULL DEFAULT 0,
  usage_event_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_unit_idx ON public.credit_ledger (cost_unit_id, created_at DESC);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their credit history" ON public.credit_ledger FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cost_units cu WHERE cu.id = credit_ledger.cost_unit_id AND cu.user_id = auth.uid()));
CREATE POLICY "Admins read all credit history" ON public.credit_ledger FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 3. Promotional and staff codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'discount',
  discount_percentage numeric NOT NULL DEFAULT 0,
  label text,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promo codes" ON public.promo_codes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_codes TO authenticated;

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, cost_unit_id)
);
GRANT SELECT ON public.promo_redemptions TO authenticated;
GRANT ALL ON public.promo_redemptions TO service_role;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their redemptions" ON public.promo_redemptions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.cost_units cu WHERE cu.id = promo_redemptions.cost_unit_id AND cu.user_id = auth.uid()));
CREATE POLICY "Admins read all redemptions" ON public.promo_redemptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 4. Wallet helpers
CREATE OR REPLACE FUNCTION public.ensure_credit_wallet(_cost_unit_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.credit_wallets WHERE cost_unit_id = _cost_unit_id;
  IF v_id IS NULL THEN
    INSERT INTO public.credit_wallets (cost_unit_id) VALUES (_cost_unit_id)
    ON CONFLICT (cost_unit_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.my_credit_balance()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT w.balance FROM public.credit_wallets w
    JOIN public.cost_units cu ON cu.id = w.cost_unit_id
    WHERE cu.user_id = auth.uid() AND cu.owner_kind = 'user'
    LIMIT 1
  ), 0);
$$;
GRANT EXECUTE ON FUNCTION public.my_credit_balance() TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_credits(_cost_unit_id uuid, _amount numeric, _kind text, _note text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_wallet uuid; v_balance numeric;
BEGIN
  v_wallet := public.ensure_credit_wallet(_cost_unit_id);
  UPDATE public.credit_wallets
     SET balance = balance + _amount,
         lifetime_purchased = lifetime_purchased + GREATEST(_amount, 0),
         updated_at = now()
   WHERE id = v_wallet
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, note)
  VALUES (v_wallet, _cost_unit_id, COALESCE(_kind, 'adjustment'), _amount, v_balance, _note);

  RETURN v_balance;
END $$;

-- 5. Metering: price, discount, charge, wallet deduction, payment status
CREATE OR REPLACE FUNCTION public.record_usage_event(
  _user_id uuid, _org_id uuid, _category cost_category, _metric text, _quantity numeric,
  _unit text DEFAULT 'unit', _feature text DEFAULT NULL, _model text DEFAULT NULL,
  _occurred_at timestamptz DEFAULT now(), _resource_label text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_unit_id uuid; v_price numeric; v_cost numeric; v_rate numeric; v_charge numeric;
  v_discount numeric := 0; v_code text; v_kind text; v_due numeric := 0; v_paid numeric := 0;
  v_status text := 'free'; v_wallet uuid; v_balance numeric; v_result numeric; v_id uuid;
BEGIN
  v_unit_id := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit_id IS NULL THEN RETURN NULL; END IF;

  SELECT p.unit_price INTO v_price
  FROM public.resource_prices p
  WHERE p.metric = _metric AND p.effective_from <= _occurred_at
  ORDER BY p.effective_from DESC LIMIT 1;

  v_cost := COALESCE(v_price, 0) * COALESCE(_quantity, 0);

  SELECT s.locked_profit_rate INTO v_rate
  FROM public.subscriptions s
  WHERE s.cost_unit_id = v_unit_id AND s.status = 'active' AND s.plan <> 'free'
    AND s.period_start <= _occurred_at
    AND (s.period_end IS NULL OR s.period_end >= _occurred_at)
  ORDER BY s.period_start DESC LIMIT 1;

  IF v_rate IS NULL THEN
    v_charge := 0; v_rate := 0; v_status := 'free';
  ELSE
    v_charge := v_cost * (1 + v_rate / 100.0);

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

      IF COALESCE(v_balance, 0) >= v_due THEN
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
  END IF;

  v_result := CASE
    WHEN v_status = 'unpaid' THEN -v_charge
    ELSE v_paid - v_cost
  END;

  INSERT INTO public.usage_events (
    cost_unit_id, actor_user_id, category, metric, quantity, unit,
    unit_price, actual_cost, profit_rate, customer_charge, profit,
    feature, model, occurred_at, payment_status, discount_percentage,
    promo_code, amount_paid, financial_result, resource_label
  ) VALUES (
    v_unit_id, _user_id, _category, _metric, COALESCE(_quantity, 0), _unit,
    v_price, v_cost, v_rate, v_charge, v_charge - v_cost,
    _feature, _model, _occurred_at, v_status, v_discount,
    v_code, v_paid, v_result, _resource_label
  ) RETURNING id INTO v_id;

  IF v_paid > 0 AND v_wallet IS NOT NULL THEN
    INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, usage_event_id, note)
    VALUES (v_wallet, v_unit_id, 'deduction', -v_paid, COALESCE(v_balance, 0), v_id, _feature);
  END IF;

  INSERT INTO public.cost_unit_totals (cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit, amount_paid, financial_result)
  VALUES (v_unit_id, (_occurred_at AT TIME ZONE 'UTC')::date, _category, COALESCE(_quantity, 0), v_cost, v_charge, v_charge - v_cost, v_paid, v_result)
  ON CONFLICT (cost_unit_id, day, category) DO UPDATE
    SET quantity = public.cost_unit_totals.quantity + EXCLUDED.quantity,
        actual_cost = public.cost_unit_totals.actual_cost + EXCLUDED.actual_cost,
        customer_charge = public.cost_unit_totals.customer_charge + EXCLUDED.customer_charge,
        profit = public.cost_unit_totals.profit + EXCLUDED.profit,
        amount_paid = public.cost_unit_totals.amount_paid + EXCLUDED.amount_paid,
        financial_result = public.cost_unit_totals.financial_result + EXCLUDED.financial_result,
        updated_at = now();

  RETURN v_id;
END $$;

-- 6. Redeem a code for the signed-in account
CREATE OR REPLACE FUNCTION public.redeem_promo_code(_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code public.promo_codes; v_unit uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'unauthenticated'; END IF;
  SELECT * INTO v_code FROM public.promo_codes
   WHERE lower(code) = lower(trim(_code)) AND active
     AND (expires_at IS NULL OR expires_at > now());
  IF v_code.id IS NULL THEN RETURN 'invalid'; END IF;

  SELECT id INTO v_unit FROM public.cost_units WHERE user_id = auth.uid() AND owner_kind = 'user' LIMIT 1;
  IF v_unit IS NULL THEN RETURN 'no_cost_unit'; END IF;

  INSERT INTO public.promo_redemptions (code_id, cost_unit_id) VALUES (v_code.id, v_unit)
  ON CONFLICT (code_id, cost_unit_id) DO UPDATE SET active = true;
  RETURN 'ok';
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_promo_code(text) TO authenticated;

-- 7. Can this account still afford chargeable work?
CREATE OR REPLACE FUNCTION public.can_afford_usage(_user_id uuid, _org_id uuid, _estimated numeric DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_unit uuid; v_rate numeric; v_balance numeric;
BEGIN
  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN RETURN true; END IF;

  SELECT s.locked_profit_rate INTO v_rate FROM public.subscriptions s
   WHERE s.cost_unit_id = v_unit AND s.status = 'active' AND s.plan <> 'free'
     AND s.period_start <= now() AND (s.period_end IS NULL OR s.period_end >= now())
   ORDER BY s.period_start DESC LIMIT 1;
  IF v_rate IS NULL THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.promo_redemptions r JOIN public.promo_codes c ON c.id = r.code_id
    WHERE r.cost_unit_id = v_unit AND r.active AND c.active AND c.kind = 'staff'
  ) THEN RETURN true; END IF;

  SELECT balance INTO v_balance FROM public.credit_wallets WHERE cost_unit_id = v_unit;
  RETURN COALESCE(v_balance, 0) >= COALESCE(_estimated, 0);
END $$;
GRANT EXECUTE ON FUNCTION public.can_afford_usage(uuid, uuid, numeric) TO authenticated, service_role;