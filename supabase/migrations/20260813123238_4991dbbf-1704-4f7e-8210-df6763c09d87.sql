-- 1. Yearly billing flags
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS yearly_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.plan_versions ADD COLUMN IF NOT EXISTS yearly_enabled boolean NOT NULL DEFAULT true;

-- 2. Locked commercial terms on the subscription
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS monthly_equivalent numeric,
  ADD COLUMN IF NOT EXISTS standard_annual_price numeric,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric NOT NULL DEFAULT 0;

-- 3. Locked feature + limit snapshot
CREATE TABLE IF NOT EXISTS public.subscription_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.feature_entitlements(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_subscription_entitlements_sub ON public.subscription_entitlements(subscription_id);

CREATE TABLE IF NOT EXISTS public.subscription_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  limit_value integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, limit_key)
);

GRANT SELECT ON public.subscription_entitlements TO authenticated;
GRANT ALL ON public.subscription_entitlements TO service_role;
GRANT SELECT ON public.subscription_limits TO authenticated;
GRANT ALL ON public.subscription_limits TO service_role;

ALTER TABLE public.subscription_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own subscription entitlements" ON public.subscription_entitlements;
CREATE POLICY "Owners read own subscription entitlements"
ON public.subscription_entitlements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners read own subscription limits" ON public.subscription_limits;
CREATE POLICY "Owners read own subscription limits"
ON public.subscription_limits FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid()));

-- 4. Teacher Payments feature
INSERT INTO public.feature_entitlements (key, label, category, applies_to, sort_order)
VALUES ('teacher_payments','Teacher Payments','teaching',ARRAY['teacher','school']::text[],105)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, category = EXCLUDED.category,
  applies_to = EXCLUDED.applies_to, sort_order = EXCLUDED.sort_order;

INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, 'teacher_payments' FROM public.plans p
WHERE p.audience IN ('teacher','school') AND p.is_free = false
ON CONFLICT DO NOTHING;

-- 5. Which subscription currently governs this account
CREATE OR REPLACE FUNCTION public.account_subscription_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id FROM public.subscriptions s
  WHERE s.user_id = _user_id
    AND s.status IN ('active','trialing','past_due','expired')
    AND s.plan_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1
$$;

-- 6. Snapshot-first feature resolution
CREATE OR REPLACE FUNCTION public.account_features(_user_id uuid)
RETURNS TABLE (feature_key text, kind text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub uuid := public.account_subscription_id(_user_id);
  _aud text := public.account_audience(_user_id);
  _plan uuid := public.account_plan_id(_user_id);
  _configured boolean;
BEGIN
  IF _sub IS NOT NULL AND EXISTS (SELECT 1 FROM public.subscription_entitlements WHERE subscription_id = _sub) THEN
    RETURN QUERY SELECT se.feature_key, 'locked'::text
      FROM public.subscription_entitlements se WHERE se.subscription_id = _sub;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.plan_entitlements pe
    JOIN public.plans p ON p.id = pe.plan_id
    WHERE p.audience = _aud
  ) INTO _configured;

  IF _configured THEN
    RETURN QUERY SELECT pe.feature_key, 'plan'::text
      FROM public.plan_entitlements pe WHERE pe.plan_id = _plan;
  ELSIF _aud IS NOT NULL THEN
    RETURN QUERY SELECT f.key, 'unconfigured'::text
      FROM public.feature_entitlements f WHERE _aud = ANY (f.applies_to);
  END IF;
END $$;

-- 7. Effective entitlements now read the locked snapshot first
CREATE OR REPLACE FUNCTION public.effective_entitlements(_user_id uuid)
RETURNS TABLE (feature_key text, source text, payer_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH aud AS (SELECT public.account_audience(_user_id) AS audience),
  own AS (
    SELECT af.feature_key,
           CASE WHEN af.kind = 'unconfigured' THEN 'unconfigured' ELSE 'own_plan' END AS source,
           _user_id AS payer_user_id
    FROM public.account_features(_user_id) af
  ),
  provided AS (
    SELECT of.feature_key,
           CASE WHEN c.relation IN ('school_teacher','parent_school') THEN 'via_school' ELSE 'via_teacher' END AS source,
           other.other_id AS payer_user_id
    FROM public.connections c
    CROSS JOIN LATERAL (
      SELECT CASE WHEN c.from_user_id = _user_id THEN c.to_user_id ELSE c.from_user_id END AS other_id
    ) other
    CROSS JOIN LATERAL public.account_features(other.other_id) of
    WHERE c.status = 'accepted'
      AND (c.from_user_id = _user_id OR c.to_user_id = _user_id)
      AND c.relation IN ('school_teacher','parent_school','parent_teacher')
      AND of.kind <> 'unconfigured'
      AND (
        (c.relation = 'school_teacher' AND (SELECT audience FROM aud) = 'teacher')
        OR (c.relation IN ('parent_school','parent_teacher')
            AND (SELECT audience FROM aud) = 'parent'
            AND of.feature_key IN ('assignments','adventure','progress_tracking','reports'))
      )
  )
  SELECT DISTINCT ON (e.feature_key) e.feature_key, e.source, e.payer_user_id
  FROM (SELECT * FROM own UNION ALL SELECT * FROM provided) e
  JOIN public.feature_entitlements f ON f.key = e.feature_key
  WHERE (SELECT audience FROM aud) IS NULL
     OR (SELECT audience FROM aud) = ANY (f.applies_to)
  ORDER BY e.feature_key, (e.source = 'own_plan') DESC;
$$;

-- 8. Limits read the locked snapshot first
CREATE OR REPLACE FUNCTION public.effective_limit(_user_id uuid, _limit text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub uuid := public.account_subscription_id(_user_id);
  _value integer;
  _found boolean := false;
BEGIN
  IF _sub IS NOT NULL THEN
    SELECT sl.limit_value, true INTO _value, _found
    FROM public.subscription_limits sl
    WHERE sl.subscription_id = _sub AND sl.limit_key = _limit
    LIMIT 1;
    IF _found THEN RETURN _value; END IF;
  END IF;

  SELECT pl.limit_value INTO _value
  FROM public.plan_limits pl
  WHERE pl.plan_id = public.account_plan_id(_user_id) AND pl.limit_key = _limit
  LIMIT 1;

  RETURN _value;
END $$;

-- 9. Write the snapshot whenever a subscription is activated
CREATE OR REPLACE FUNCTION public.snapshot_subscription_terms(_subscription_id uuid, _plan_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.subscription_entitlements WHERE subscription_id = _subscription_id;
  DELETE FROM public.subscription_limits WHERE subscription_id = _subscription_id;

  INSERT INTO public.subscription_entitlements (subscription_id, feature_key)
  SELECT _subscription_id, pe.feature_key FROM public.plan_entitlements pe WHERE pe.plan_id = _plan_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscription_limits (subscription_id, limit_key, limit_value)
  SELECT _subscription_id, pl.limit_key, pl.limit_value FROM public.plan_limits pl WHERE pl.plan_id = _plan_id
  ON CONFLICT DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.account_subscription_id(uuid) FROM public;
REVOKE ALL ON FUNCTION public.account_features(uuid) FROM public;
REVOKE ALL ON FUNCTION public.snapshot_subscription_terms(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.account_subscription_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_features(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.snapshot_subscription_terms(uuid, uuid) TO service_role;

-- 10. Activation stores the interval and the locked snapshot
CREATE OR REPLACE FUNCTION public.activate_subscription(_user_id uuid, _plan_key text, _org_id uuid DEFAULT NULL::uuid, _provider text DEFAULT NULL::text, _provider_subscription_id text DEFAULT NULL::text, _amount_paid numeric DEFAULT NULL::numeric, _period_days integer DEFAULT 30, _billing_interval text DEFAULT 'monthly')
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
  v_interval text := CASE WHEN lower(coalesce(_billing_interval,'monthly')) = 'yearly' THEN 'yearly' ELSE 'monthly' END;
  v_days integer;
  v_monthly numeric;
  v_standard numeric;
  v_price numeric;
  v_end timestamptz;
BEGIN
  SELECT * INTO v_plan FROM public.plans WHERE key = _plan_key AND active;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Unknown plan %', _plan_key; END IF;
  IF v_plan.status <> 'available' THEN RAISE EXCEPTION 'Plan % is not available', _plan_key; END IF;

  SELECT * INTO v_version FROM public.plan_versions
   WHERE plan_id = v_plan.id AND status = 'published'
   ORDER BY version_no DESC LIMIT 1;

  v_monthly := coalesce(v_version.price, 0);
  IF v_interval = 'yearly' AND v_monthly > 0 THEN
    v_standard := round(v_monthly * 12, 2);
    v_price := round(v_monthly * 12 * 0.8, 2);
    v_days := coalesce(nullif(_period_days, 30), 365);
  ELSE
    v_interval := CASE WHEN v_monthly = 0 THEN 'monthly' ELSE v_interval END;
    v_standard := v_monthly;
    v_price := v_monthly;
    v_days := coalesce(_period_days, 30);
  END IF;

  v_end := now() + make_interval(days => greatest(v_days, 1));
  v_unit := public.resolve_cost_unit(_user_id, _org_id);

  UPDATE public.subscriptions SET status = 'replaced', updated_at = now()
   WHERE cost_unit_id = v_unit AND status = 'active';

  INSERT INTO public.subscriptions (
    cost_unit_id, user_id, org_id, plan, plan_id, status, provider, provider_subscription_id,
    stripe_subscription_id, locked_profit_rate, currency, credit_price, credit_sell_price,
    included_credits, final_price, plan_version_id, period_start, period_end,
    billing_interval, monthly_equivalent, standard_annual_price, discount_percentage
  ) VALUES (
    v_unit, _user_id, _org_id,
    CASE WHEN v_monthly = 0 THEN 'free' ELSE v_plan.key END,
    v_plan.key, 'active', _provider, _provider_subscription_id, _provider_subscription_id,
    coalesce(v_version.profit_percentage, 0),
    coalesce(v_version.currency, v_plan.currency),
    coalesce(v_version.credit_cost, 0),
    coalesce(v_version.credit_sell_price, 0),
    coalesce(v_version.included_credits, 0),
    coalesce(_amount_paid, v_price, 0),
    v_version.id, now(), v_end,
    v_interval,
    CASE WHEN v_interval = 'yearly' THEN round(coalesce(_amount_paid, v_price, 0) / 12, 2) ELSE v_monthly END,
    v_standard,
    CASE WHEN v_interval = 'yearly' AND v_monthly > 0 THEN 20 ELSE 0 END
  ) RETURNING id INTO v_sub;

  PERFORM public.snapshot_subscription_terms(v_sub, v_plan.id);

  IF coalesce(v_version.included_credits, 0) > 0 THEN
    PERFORM public.adjust_credits(v_unit, v_version.included_credits, 'plan_allocation',
      'Included credits for ' || v_plan.key);
  END IF;

  v_total := coalesce(_amount_paid, v_price, 0);
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

-- 11. Backfill snapshots for accounts that already hold a subscription
INSERT INTO public.subscription_entitlements (subscription_id, feature_key)
SELECT s.id, pe.feature_key
FROM public.subscriptions s
JOIN public.plans p ON p.key = s.plan_id
JOIN public.plan_entitlements pe ON pe.plan_id = p.id
WHERE s.status IN ('active','trialing','past_due','expired')
ON CONFLICT DO NOTHING;

INSERT INTO public.subscription_limits (subscription_id, limit_key, limit_value)
SELECT s.id, pl.limit_key, pl.limit_value
FROM public.subscriptions s
JOIN public.plans p ON p.key = s.plan_id
JOIN public.plan_limits pl ON pl.plan_id = p.id
WHERE s.status IN ('active','trialing','past_due','expired')
ON CONFLICT DO NOTHING;

-- 12. Resolve the plan through its key (subscriptions.plan_id stores the plan key)
CREATE OR REPLACE FUNCTION public.account_plan_id(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan uuid;
  _aud text := public.account_audience(_user_id);
BEGIN
  SELECT p.id INTO _plan
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_id
  WHERE s.user_id = _user_id
    AND s.status IN ('active','trialing','past_due','expired')
    AND s.plan_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _plan IS NOT NULL THEN
    RETURN _plan;
  END IF;

  IF _aud IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id INTO _plan
  FROM public.plans p
  WHERE p.audience = _aud AND p.active AND p.is_free
  ORDER BY p.sort_order
  LIMIT 1;

  RETURN _plan;
END;
$$;
REVOKE ALL ON FUNCTION public.account_plan_id(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.account_plan_id(uuid) TO authenticated, service_role;