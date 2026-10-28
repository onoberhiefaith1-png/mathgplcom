CREATE TABLE IF NOT EXISTS public.pricing_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profit_percentage numeric NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pricing_versions_effective_idx ON public.pricing_versions (effective_from DESC);

GRANT SELECT ON public.pricing_versions TO authenticated;
GRANT ALL ON public.pricing_versions TO service_role;

ALTER TABLE public.pricing_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admins read pricing versions" ON public.pricing_versions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- Seed the history with the percentage currently in force
INSERT INTO public.pricing_versions (profit_percentage, effective_from, note)
SELECT COALESCE(s.profit_percentage, 0), COALESCE(s.updated_at, now()), 'Initial recorded percentage'
FROM public.platform_cost_settings s
WHERE s.id = 1
  AND NOT EXISTS (SELECT 1 FROM public.pricing_versions);

-- Full pricing snapshot per subscription period
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_id text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS credit_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_price numeric NOT NULL DEFAULT 0;

-- Percentage in force at a given moment (used when a subscription starts or renews)
CREATE OR REPLACE FUNCTION public.profit_percentage_at(_at timestamptz DEFAULT now())
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT v.profit_percentage FROM public.pricing_versions v
      WHERE v.effective_from <= _at
      ORDER BY v.effective_from DESC LIMIT 1),
    (SELECT s.profit_percentage FROM public.platform_cost_settings s WHERE s.id = 1),
    0
  );
$$;

-- Start or renew a subscription period, locking the percentage in force right now
CREATE OR REPLACE FUNCTION public.start_subscription_period(
  _cost_unit_id uuid,
  _plan text,
  _plan_id text DEFAULT NULL,
  _period_start timestamptz DEFAULT now(),
  _period_end timestamptz DEFAULT NULL,
  _credit_price numeric DEFAULT 0,
  _discount_percentage numeric DEFAULT 0,
  _final_price numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate numeric;
  v_currency text;
  v_id uuid;
BEGIN
  v_rate := public.profit_percentage_at(_period_start);
  SELECT COALESCE(currency, 'GBP') INTO v_currency FROM public.platform_cost_settings WHERE id = 1;

  UPDATE public.subscriptions
     SET status = 'expired', updated_at = now()
   WHERE cost_unit_id = _cost_unit_id AND status = 'active';

  INSERT INTO public.subscriptions (
    cost_unit_id, plan, plan_id, status, locked_profit_rate,
    period_start, period_end, currency, credit_price,
    discount_percentage, final_price
  ) VALUES (
    _cost_unit_id, _plan, _plan_id, 'active', v_rate,
    _period_start, _period_end, COALESCE(v_currency, 'GBP'), COALESCE(_credit_price, 0),
    COALESCE(_discount_percentage, 0), COALESCE(_final_price, 0)
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_subscription_period(uuid, text, text, timestamptz, timestamptz, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_subscription_period(uuid, text, text, timestamptz, timestamptz, numeric, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.profit_percentage_at(timestamptz) TO service_role, authenticated;