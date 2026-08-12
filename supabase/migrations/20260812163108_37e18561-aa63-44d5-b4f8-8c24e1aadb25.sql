-- 1. plans: extra descriptive columns
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS current_version_id uuid;

UPDATE public.plans SET is_free = true WHERE subscription_amount = 0 AND credit_amount = 0 AND status = 'available';
UPDATE public.plans SET subscription_amount = 15.99, credit_amount = 25.00 WHERE key = 'school_pro';

-- 2. plan_versions
CREATE TABLE public.plan_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  version_no integer NOT NULL DEFAULT 0,
  label text,
  description text,
  price numeric NOT NULL DEFAULT 0,
  platform_amount numeric NOT NULL DEFAULT 0,
  credit_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  profit_percentage numeric NOT NULL DEFAULT 0,
  credit_cost numeric NOT NULL DEFAULT 0,
  credit_sell_price numeric NOT NULL DEFAULT 0,
  included_credits numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  published_by uuid,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX plan_versions_draft_idx ON public.plan_versions (plan_id) WHERE status = 'draft';
CREATE INDEX plan_versions_plan_idx ON public.plan_versions (plan_id, version_no DESC);

GRANT SELECT ON public.plan_versions TO anon;
GRANT SELECT ON public.plan_versions TO authenticated;
GRANT ALL ON public.plan_versions TO service_role;
ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published plan versions are public" ON public.plan_versions
  FOR SELECT USING (status = 'published');
CREATE POLICY "Platform owners read all plan versions" ON public.plan_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE POLICY "Platform owners write plan versions" ON public.plan_versions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

ALTER TABLE public.plans
  ADD CONSTRAINT plans_current_version_fkey FOREIGN KEY (current_version_id)
  REFERENCES public.plan_versions(id) ON DELETE SET NULL;

CREATE TRIGGER update_plan_versions_updated_at BEFORE UPDATE ON public.plan_versions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. plan_features
CREATE TABLE public.plan_features (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX plan_features_plan_idx ON public.plan_features (plan_id, sort_order);

GRANT SELECT ON public.plan_features TO anon;
GRANT SELECT ON public.plan_features TO authenticated;
GRANT ALL ON public.plan_features TO service_role;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan features are public" ON public.plan_features FOR SELECT USING (true);
CREATE POLICY "Platform owners write plan features" ON public.plan_features
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE TRIGGER update_plan_features_updated_at BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. currency conversion
ALTER TABLE public.currency_rates ADD COLUMN IF NOT EXISTS exchange_rate numeric NOT NULL DEFAULT 1;

-- 5. subscription lifecycle columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_version_id uuid REFERENCES public.plan_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_plan_id text,
  ADD COLUMN IF NOT EXISTS cancel_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE POLICY "Members read their own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.subscriptions TO authenticated;

-- 6. payment records
CREATE TABLE public.stripe_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  customer_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stripe_customers TO authenticated;
GRANT ALL ON public.stripe_customers TO service_role;
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their own stripe customer" ON public.stripe_customers
  FOR SELECT TO authenticated USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

CREATE TABLE public.payment_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid,
  org_id uuid,
  plan_id text,
  plan_version_id uuid REFERENCES public.plan_versions(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_ref text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  credits_allocated numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'succeeded',
  occurred_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX payment_transactions_user_idx ON public.payment_transactions (user_id, occurred_at DESC);
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read their own payments" ON public.payment_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid()
    OR public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 7. draft / publish routines
CREATE OR REPLACE FUNCTION public.save_plan_draft(
  _plan_id uuid,
  _label text,
  _description text,
  _platform_amount numeric,
  _credit_amount numeric,
  _currency text DEFAULT 'GBP',
  _profit_percentage numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pricing record;
  v_pct numeric;
  v_sell numeric;
  v_credits numeric;
  v_id uuid;
BEGIN
  SELECT * INTO v_pricing FROM public.resolve_credit_pricing(coalesce(_currency, 'GBP'), now());
  v_pct := coalesce(_profit_percentage, v_pricing.profit_percentage, 0);
  v_sell := round(coalesce(v_pricing.cost_price, 0) * (1 + v_pct / 100.0), 6);
  v_credits := CASE WHEN v_sell > 0 THEN round(coalesce(_credit_amount, 0) / v_sell, 4) ELSE 0 END;

  INSERT INTO public.plan_versions (
    plan_id, label, description, price, platform_amount, credit_amount, currency,
    profit_percentage, credit_cost, credit_sell_price, included_credits, status
  ) VALUES (
    _plan_id, _label, _description,
    coalesce(_platform_amount, 0) + coalesce(_credit_amount, 0),
    coalesce(_platform_amount, 0), coalesce(_credit_amount, 0), upper(coalesce(_currency, 'GBP')),
    v_pct, coalesce(v_pricing.cost_price, 0), v_sell, v_credits, 'draft'
  )
  ON CONFLICT (plan_id) WHERE status = 'draft' DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    platform_amount = EXCLUDED.platform_amount,
    credit_amount = EXCLUDED.credit_amount,
    currency = EXCLUDED.currency,
    profit_percentage = EXCLUDED.profit_percentage,
    credit_cost = EXCLUDED.credit_cost,
    credit_sell_price = EXCLUDED.credit_sell_price,
    included_credits = EXCLUDED.included_credits,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.publish_plan_version(_plan_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_draft public.plan_versions;
  v_next integer;
BEGIN
  SELECT * INTO v_draft FROM public.plan_versions WHERE plan_id = _plan_id AND status = 'draft';
  IF v_draft.id IS NULL THEN
    RAISE EXCEPTION 'No draft to publish for this plan';
  END IF;

  SELECT coalesce(max(version_no), 0) + 1 INTO v_next
    FROM public.plan_versions WHERE plan_id = _plan_id AND status <> 'draft';

  UPDATE public.plan_versions SET status = 'archived', updated_at = now()
   WHERE plan_id = _plan_id AND status = 'published';

  UPDATE public.plan_versions
     SET status = 'published', version_no = v_next, published_at = now(),
         published_by = auth.uid(), updated_at = now()
   WHERE id = v_draft.id;

  UPDATE public.plans
     SET label = coalesce(v_draft.label, label),
         description = coalesce(v_draft.description, description),
         subscription_amount = v_draft.platform_amount,
         credit_amount = v_draft.credit_amount,
         currency = v_draft.currency,
         is_free = (v_draft.price = 0),
         current_version_id = v_draft.id,
         updated_at = now()
   WHERE id = _plan_id;

  RETURN v_draft.id;
END $$;

-- 8. subscription activation (payment confirmed -> lock version, credit wallet)
CREATE OR REPLACE FUNCTION public.activate_subscription(
  _user_id uuid,
  _plan_key text,
  _org_id uuid DEFAULT NULL,
  _provider text DEFAULT NULL,
  _provider_subscription_id text DEFAULT NULL,
  _amount_paid numeric DEFAULT NULL,
  _period_days integer DEFAULT 30
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan public.plans;
  v_version public.plan_versions;
  v_unit uuid;
  v_sub uuid;
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

  INSERT INTO public.payment_transactions (
    subscription_id, user_id, org_id, plan_id, plan_version_id, provider, provider_ref,
    amount, currency, credits_allocated, status
  ) VALUES (
    v_sub, _user_id, _org_id, v_plan.key, v_version.id,
    coalesce(_provider, 'none'), _provider_subscription_id,
    coalesce(_amount_paid, v_version.price, 0),
    coalesce(v_version.currency, v_plan.currency),
    coalesce(v_version.included_credits, 0),
    CASE WHEN coalesce(_amount_paid, v_version.price, 0) = 0 THEN 'free' ELSE 'succeeded' END
  );

  RETURN v_sub;
END $$;

REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid, text, uuid, text, text, numeric, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid, text, uuid, text, text, numeric, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.save_plan_draft(uuid, text, text, numeric, numeric, text, numeric) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.publish_plan_version(uuid) FROM public, anon;

-- 9. seed the first published version for each existing plan
DO $$
DECLARE r record; v_draft uuid;
BEGIN
  FOR r IN SELECT * FROM public.plans LOOP
    v_draft := public.save_plan_draft(r.id, r.label, r.description, r.subscription_amount, r.credit_amount, r.currency, NULL);
    PERFORM public.publish_plan_version(r.id);
  END LOOP;
END $$;