-- 1. Pricing versions capture both inputs and the derived sell price.
ALTER TABLE public.pricing_versions
  ADD COLUMN IF NOT EXISTS cost_per_credit numeric,
  ADD COLUMN IF NOT EXISTS sell_price numeric,
  ADD COLUMN IF NOT EXISTS label text;

UPDATE public.pricing_versions v
   SET cost_per_credit = COALESCE(
         (SELECT r.credit_value FROM public.currency_rates r
           WHERE r.currency = 'GBP' AND r.effective_from <= v.effective_from
           ORDER BY r.effective_from DESC LIMIT 1),
         (SELECT s.credit_rate FROM public.platform_cost_settings s WHERE s.id = 1),
         0.31)
 WHERE v.cost_per_credit IS NULL;

UPDATE public.pricing_versions
   SET sell_price = round(coalesce(cost_per_credit, 0) * (1 + coalesce(profit_percentage, 0) / 100.0), 6)
 WHERE sell_price IS NULL;

UPDATE public.pricing_versions
   SET label = 'PV-' || to_char(effective_from, 'YYYY-MM-DD') || '-' || to_char(round(coalesce(profit_percentage, 0)), 'FM999')
 WHERE label IS NULL;

-- Insert-only: a change to either input records a new version.
CREATE OR REPLACE FUNCTION public.record_pricing_version(
  _cost_per_credit numeric,
  _profit_percentage numeric,
  _created_by uuid DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_last record; v_id uuid; v_at timestamptz := now();
BEGIN
  SELECT * INTO v_last FROM public.pricing_versions
   WHERE effective_from <= v_at ORDER BY effective_from DESC LIMIT 1;

  IF v_last.id IS NOT NULL
     AND coalesce(v_last.cost_per_credit, -1) = coalesce(_cost_per_credit, -1)
     AND coalesce(v_last.profit_percentage, -1) = coalesce(_profit_percentage, -1) THEN
    RETURN v_last.id;
  END IF;

  INSERT INTO public.pricing_versions (
    profit_percentage, cost_per_credit, sell_price, label, effective_from, created_by, note
  ) VALUES (
    coalesce(_profit_percentage, 0),
    coalesce(_cost_per_credit, 0),
    round(coalesce(_cost_per_credit, 0) * (1 + coalesce(_profit_percentage, 0) / 100.0), 6),
    'PV-' || to_char(v_at, 'YYYY-MM-DD') || '-' || to_char(round(coalesce(_profit_percentage, 0)), 'FM999'),
    v_at, _created_by, _note
  ) RETURNING id INTO v_id;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.record_pricing_version(numeric, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_pricing_version(numeric, numeric, uuid, text) TO service_role;

-- The version in force at a moment, with its locked customer multiplier.
CREATE OR REPLACE FUNCTION public.pricing_version_at(_at timestamptz DEFAULT now())
RETURNS TABLE(id uuid, label text, cost_per_credit numeric, profit_percentage numeric, sell_price numeric, multiplier numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v record; p record;
BEGIN
  SELECT * INTO v FROM public.pricing_versions
   WHERE effective_from <= _at ORDER BY effective_from DESC LIMIT 1;

  IF v.id IS NOT NULL AND coalesce(v.cost_per_credit, 0) > 0 THEN
    RETURN QUERY SELECT v.id, v.label, v.cost_per_credit, coalesce(v.profit_percentage, 0),
                        coalesce(v.sell_price, round(v.cost_per_credit * (1 + coalesce(v.profit_percentage, 0) / 100.0), 6)),
                        1 + coalesce(v.profit_percentage, 0) / 100.0;
    RETURN;
  END IF;

  SELECT * INTO p FROM public.resolve_credit_pricing('GBP', _at);
  RETURN QUERY SELECT v.id, v.label, p.cost_price, coalesce(p.profit_percentage, 0), p.sell_price,
                      1 + coalesce(p.profit_percentage, 0) / 100.0;
END $$;

REVOKE ALL ON FUNCTION public.pricing_version_at(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pricing_version_at(timestamptz) TO service_role;

-- 2. Credit lots carry their own locked economics.
ALTER TABLE public.credit_grants
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid REFERENCES public.pricing_versions(id),
  ADD COLUMN IF NOT EXISTS cost_per_credit_at_purchase numeric,
  ADD COLUMN IF NOT EXISTS profit_percentage_at_purchase numeric,
  ADD COLUMN IF NOT EXISTS customer_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sell_price_at_purchase numeric,
  ADD COLUMN IF NOT EXISTS purchase_id uuid REFERENCES public.credit_purchases(id);

UPDATE public.credit_grants g
   SET (pricing_version_id, cost_per_credit_at_purchase, profit_percentage_at_purchase,
        customer_multiplier, sell_price_at_purchase) = (
     SELECT v.id, v.cost_per_credit, v.profit_percentage,
            GREATEST(coalesce(v.multiplier, 1), 0.000001), v.sell_price
       FROM public.pricing_version_at(g.granted_at) v
   )
 WHERE g.pricing_version_id IS NULL;

-- 3. Ledger and usage records carry the audit chain.
ALTER TABLE public.credit_ledger
  ADD COLUMN IF NOT EXISTS credit_lot_id uuid,
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid;

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS credit_lot_id uuid,
  ADD COLUMN IF NOT EXISTS pricing_version_id uuid,
  ADD COLUMN IF NOT EXISTS balance_before numeric,
  ADD COLUMN IF NOT EXISTS balance_after numeric,
  ADD COLUMN IF NOT EXISTS payer_cost_unit_id uuid;

-- 4. Payer-level credit permission.
ALTER TABLE public.cost_units
  ADD COLUMN IF NOT EXISTS credit_usage_enabled boolean NOT NULL DEFAULT true;

-- 5. Grants are stamped with the pricing version in force.
CREATE OR REPLACE FUNCTION public.adjust_credits(_cost_unit_id uuid, _amount numeric, _kind text, _note text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet uuid; v_balance numeric; v_left numeric; r record; v_take numeric; v_pv record;
BEGIN
  v_wallet := public.ensure_credit_wallet(_cost_unit_id);

  IF coalesce(_amount, 0) > 0 THEN
    SELECT * INTO v_pv FROM public.pricing_version_at(now());
    INSERT INTO public.credit_grants (
      wallet_id, cost_unit_id, credits, remaining, source, note,
      pricing_version_id, cost_per_credit_at_purchase, profit_percentage_at_purchase,
      customer_multiplier, sell_price_at_purchase
    )
    VALUES (
      v_wallet, _cost_unit_id, _amount, _amount, coalesce(_kind, 'allocation'), _note,
      v_pv.id, v_pv.cost_per_credit, v_pv.profit_percentage,
      GREATEST(coalesce(v_pv.multiplier, 1), 0.000001), v_pv.sell_price
    );
  ELSIF coalesce(_amount, 0) < 0 THEN
    v_left := -_amount;
    FOR r IN
      SELECT id, remaining FROM public.credit_grants
       WHERE wallet_id = v_wallet AND remaining > 0 AND expires_at > now()
       ORDER BY expires_at ASC, granted_at ASC
       FOR UPDATE
    LOOP
      EXIT WHEN v_left <= 0;
      v_take := least(r.remaining, v_left);
      UPDATE public.credit_grants SET remaining = remaining - v_take WHERE id = r.id;
      v_left := v_left - v_take;
    END LOOP;
  END IF;

  UPDATE public.credit_wallets w
     SET balance = coalesce((
           SELECT sum(g.remaining) FROM public.credit_grants g
            WHERE g.wallet_id = w.id AND g.remaining > 0 AND g.expires_at > now()
         ), 0),
         lifetime_purchased = lifetime_purchased + GREATEST(coalesce(_amount, 0), 0),
         updated_at = now()
   WHERE w.id = v_wallet
  RETURNING balance INTO v_balance;

  INSERT INTO public.credit_ledger (wallet_id, cost_unit_id, kind, amount, balance_after, note, pricing_version_id)
  VALUES (v_wallet, _cost_unit_id, coalesce(_kind, 'adjustment'), _amount, v_balance, _note,
          CASE WHEN coalesce(_amount, 0) > 0 THEN v_pv.id ELSE NULL END);

  RETURN v_balance;
END $function$;

-- 6. Consuming provider cost through the lots' own locked multipliers, oldest first.
CREATE OR REPLACE FUNCTION public.consume_cost_credits(
  _cost_unit_id uuid,
  _cost_credits numeric,
  _usage_event_id uuid DEFAULT NULL,
  _note text DEFAULT NULL
) RETURNS TABLE(charged numeric, cost_covered numeric, first_lot uuid, first_version uuid, balance_before numeric, balance_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_wallet uuid; v_left numeric; v_charged numeric := 0; v_covered numeric := 0;
  v_take numeric; v_mult numeric; r record;
  v_before numeric; v_after numeric; v_lot uuid; v_version uuid;
BEGIN
  v_wallet := public.ensure_credit_wallet(_cost_unit_id);
  SELECT balance INTO v_before FROM public.credit_wallets WHERE id = v_wallet;
  v_before := coalesce(v_before, 0);

  IF coalesce(_cost_credits, 0) <= 0 THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, NULL::uuid, NULL::uuid, v_before, v_before;
    RETURN;
  END IF;

  v_left := _cost_credits;

  FOR r IN
    SELECT id, remaining, customer_multiplier, pricing_version_id
      FROM public.credit_grants
     WHERE wallet_id = v_wallet AND remaining > 0 AND expires_at > now()
     ORDER BY expires_at ASC, granted_at ASC FOR UPDATE
  LOOP
    EXIT WHEN v_left <= 0.000000001;
    v_mult := GREATEST(coalesce(r.customer_multiplier, 1), 0.000001);
    v_take := least(r.remaining, v_left * v_mult);
    IF v_take <= 0 THEN CONTINUE; END IF;

    UPDATE public.credit_grants SET remaining = remaining - v_take WHERE id = r.id;
    v_charged := v_charged + v_take;
    v_covered := v_covered + v_take / v_mult;
    v_left := v_left - v_take / v_mult;

    IF v_lot IS NULL THEN v_lot := r.id; v_version := r.pricing_version_id; END IF;
  END LOOP;

  UPDATE public.credit_wallets w
     SET balance = greatest(coalesce((
           SELECT sum(g.remaining) FROM public.credit_grants g
            WHERE g.wallet_id = w.id AND g.remaining > 0 AND g.expires_at > now()
         ), 0), 0),
         lifetime_spent = lifetime_spent + v_charged,
         updated_at = now()
   WHERE w.id = v_wallet
  RETURNING balance INTO v_after;
  v_after := coalesce(v_after, 0);

  IF v_charged > 0 THEN
    INSERT INTO public.credit_ledger (
      wallet_id, cost_unit_id, kind, amount, balance_after, usage_event_id, note,
      credit_lot_id, pricing_version_id
    ) VALUES (
      v_wallet, _cost_unit_id, 'deduction', -v_charged, v_after, _usage_event_id, _note,
      v_lot, v_version
    );
  END IF;

  RETURN QUERY SELECT v_charged, v_covered, v_lot, v_version, v_before, v_after;
END $$;

REVOKE ALL ON FUNCTION public.consume_cost_credits(uuid, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_cost_credits(uuid, numeric, uuid, text) TO service_role;

-- 7. Usage deducts through the lot multipliers, never today's margin.
CREATE OR REPLACE FUNCTION public.record_usage_event(_user_id uuid, _org_id uuid, _category cost_category, _metric text, _quantity numeric, _unit text DEFAULT 'unit'::text, _feature text DEFAULT NULL::text, _model text DEFAULT NULL::text, _occurred_at timestamp with time zone DEFAULT now(), _resource_label text DEFAULT NULL::text, _operation_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_unit_id uuid; v_price numeric; v_cost numeric; v_rate numeric; v_charge numeric;
  v_discount numeric := 0; v_code text; v_due_cost numeric := 0;
  v_status text := 'unpaid'; v_result numeric; v_id uuid;
  v_credit_price numeric; v_cost_credits numeric; v_charge_credits numeric;
  v_paid numeric := 0; v_is_staff boolean := false; v_pv record; v_take record;
  v_spent numeric := 0;
BEGIN
  v_unit_id := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit_id IS NULL THEN RETURN NULL; END IF;

  IF _operation_key IS NOT NULL THEN
    SELECT id INTO v_id FROM public.usage_events WHERE operation_key = _operation_key;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  SELECT * INTO v_pv FROM public.pricing_version_at(_occurred_at);
  v_credit_price := v_pv.cost_per_credit;
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

  -- The current rate is only a provisional figure for the record; the real
  -- deduction uses each credit lot's own locked multiplier.
  v_rate := coalesce(v_pv.profit_percentage, 0);
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
    cost_credits, charge_credits, paid_credits, credit_price, operation_key,
    pricing_version_id, payer_cost_unit_id
  ) VALUES (
    v_unit_id, _user_id, _category, _metric, COALESCE(_quantity, 0), _unit,
    v_price, v_cost, v_rate, v_charge, v_charge - v_cost,
    _feature, _model, _occurred_at, 'unpaid', v_discount,
    v_code, 0, -v_cost, _resource_label,
    v_cost_credits, v_charge_credits, 0, v_credit_price, _operation_key,
    v_pv.id, v_unit_id
  ) RETURNING id INTO v_id;

  IF COALESCE(v_is_staff, false) THEN
    v_status := 'staff'; v_discount := 0; v_code := NULL;
  ELSE
    v_due_cost := greatest(v_cost_credits * (1 - v_discount / 100.0), 0);
    SELECT * INTO v_take FROM public.consume_cost_credits(v_unit_id, v_due_cost, v_id, _feature);
    v_spent := coalesce(v_take.charged, 0);
    IF v_due_cost = 0 THEN
      v_status := 'free';
    ELSIF coalesce(v_take.cost_covered, 0) >= v_due_cost - 0.000001 THEN
      v_status := CASE WHEN v_discount > 0 THEN 'discounted' ELSE 'paid' END;
    ELSIF v_spent > 0 THEN
      v_status := 'partial';
    END IF;
    v_charge_credits := v_spent;
    v_charge := v_spent * v_credit_price;
    IF coalesce(v_take.cost_covered, 0) > 0 THEN
      v_rate := (v_spent / v_take.cost_covered - 1) * 100.0;
    END IF;
  END IF;

  v_paid := v_spent * v_credit_price;
  v_result := v_paid - v_cost;

  UPDATE public.usage_events
     SET payment_status = v_status, discount_percentage = v_discount, promo_code = v_code,
         paid_credits = v_spent, amount_paid = v_paid, financial_result = v_result,
         charge_credits = v_charge_credits, customer_charge = v_charge,
         profit_rate = v_rate, profit = v_charge - v_cost,
         credit_lot_id = v_take.first_lot,
         pricing_version_id = coalesce(v_take.first_version, v_pv.id),
         balance_before = v_take.balance_before,
         balance_after = v_take.balance_after
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

-- 8. Top-ups stamp the lot with the purchase.
CREATE OR REPLACE FUNCTION public.paddle_record_topup(_user_id uuid, _provider_ref text, _credits numeric, _amount numeric, _currency text DEFAULT 'GBP'::text)
 RETURNS boolean
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_unit uuid; v_purchase uuid;
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
  ) RETURNING id INTO v_purchase;

  PERFORM public.adjust_credits(v_unit, _credits, 'topup', 'Credit top-up');

  UPDATE public.credit_grants g
     SET purchase_id = v_purchase
   WHERE g.id = (
     SELECT id FROM public.credit_grants
      WHERE cost_unit_id = v_unit AND source = 'topup' AND purchase_id IS NULL
      ORDER BY granted_at DESC LIMIT 1
   );

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

-- 9. Credit usage can be switched off by the responsible account.
CREATE OR REPLACE FUNCTION public.credit_headroom(_user_id uuid, _org_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(enforced boolean, balance numeric, reserved numeric, available numeric, start_floor numeric, stop_floor numeric, blocked_reason text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_unit uuid; v_balance numeric; v_reserved numeric; v_state text;
  v_start numeric; v_stop numeric; v_staff boolean := false; v_enabled boolean := true;
BEGIN
  SELECT coalesce(s.credit_start_floor, 0.50), coalesce(s.credit_stop_floor, 0.30)
    INTO v_start, v_stop FROM public.platform_cost_settings s WHERE s.id = 1;
  v_start := coalesce(v_start, 0.50); v_stop := coalesce(v_stop, 0.30);

  v_unit := public.resolve_cost_unit(_user_id, _org_id);
  IF v_unit IS NULL THEN
    RETURN QUERY SELECT false, 0::numeric, 0::numeric, 0::numeric, v_start, v_stop, NULL::text;
    RETURN;
  END IF;

  SELECT coalesce(cu.credit_usage_enabled, true) INTO v_enabled
    FROM public.cost_units cu WHERE cu.id = v_unit;

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
    CASE WHEN NOT coalesce(v_enabled, true) THEN 'disabled'
         WHEN coalesce(v_staff, false) THEN NULL
         WHEN coalesce(v_state, 'ok') = 'past_due' THEN 'past_due' ELSE NULL END;
END $function$;

-- 10. Customer-facing credit activity: action and credits only.
CREATE OR REPLACE FUNCTION public.my_credit_activity(_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, occurred_at timestamptz, kind text, label text, credits numeric, balance_after numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH unit AS (
    SELECT cu.id FROM public.cost_units cu
     WHERE cu.user_id = auth.uid() AND cu.owner_kind = 'user' LIMIT 1
  )
  SELECT l.id, l.created_at, l.kind,
         coalesce(nullif(l.note, ''), initcap(replace(l.kind, '_', ' '))),
         l.amount, l.balance_after
    FROM public.credit_ledger l
   WHERE l.cost_unit_id = (SELECT id FROM unit)
   ORDER BY l.created_at DESC
   LIMIT least(greatest(coalesce(_limit, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.my_credit_activity(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_credit_activity(integer) TO authenticated, service_role;

-- 11. Members must not read internal economics columns on their subscription row.
DROP POLICY IF EXISTS "Members read their own subscriptions" ON public.subscriptions;