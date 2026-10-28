-- 1. Six billable categories
CREATE TYPE public.cost_category AS ENUM ('database','network','storage','compute','realtime','ai');

CREATE TABLE public.platform_cost_settings (
  id int PRIMARY KEY DEFAULT 1,
  profit_percentage numeric NOT NULL DEFAULT 50,
  currency text NOT NULL DEFAULT 'GBP',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_cost_settings_single CHECK (id = 1)
);
GRANT ALL ON public.platform_cost_settings TO service_role;
GRANT SELECT ON public.platform_cost_settings TO authenticated;
ALTER TABLE public.platform_cost_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read cost settings" ON public.platform_cost_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
INSERT INTO public.platform_cost_settings (id) VALUES (1);

-- 2. Cost units
CREATE SEQUENCE IF NOT EXISTS public.cost_unit_user_seq;
CREATE SEQUENCE IF NOT EXISTS public.cost_unit_workspace_seq;

CREATE TABLE public.cost_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  owner_kind text NOT NULL CHECK (owner_kind IN ('user','workspace')),
  user_id uuid UNIQUE,
  org_id uuid UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cost_units_owner_shape CHECK (
    (owner_kind = 'user' AND user_id IS NOT NULL AND org_id IS NULL)
    OR (owner_kind = 'workspace' AND org_id IS NOT NULL AND user_id IS NULL)
  )
);
GRANT ALL ON public.cost_units TO service_role;
GRANT SELECT ON public.cost_units TO authenticated;
ALTER TABLE public.cost_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read cost units" ON public.cost_units
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 3. Versioned provider price book
CREATE TABLE public.resource_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.cost_category NOT NULL,
  metric text NOT NULL,
  unit text NOT NULL,
  unit_price numeric,
  currency text NOT NULL DEFAULT 'GBP',
  effective_from timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metric, effective_from)
);
GRANT ALL ON public.resource_prices TO service_role;
GRANT SELECT ON public.resource_prices TO authenticated;
ALTER TABLE public.resource_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read prices" ON public.resource_prices
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 4. Subscriptions with the profit rate locked per period
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  user_id uuid,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  provider text,
  provider_subscription_id text,
  locked_profit_rate numeric NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT now(),
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscriptions_cost_unit_idx ON public.subscriptions (cost_unit_id, period_start DESC);
GRANT ALL ON public.subscriptions TO service_role;
GRANT SELECT ON public.subscriptions TO authenticated;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 5. Metered usage events
CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  actor_user_id uuid,
  category public.cost_category NOT NULL,
  metric text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'unit',
  unit_price numeric,
  actual_cost numeric NOT NULL DEFAULT 0,
  profit_rate numeric NOT NULL DEFAULT 0,
  customer_charge numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  feature text,
  model text,
  reconciled boolean NOT NULL DEFAULT false,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX usage_events_unit_time_idx ON public.usage_events (cost_unit_id, occurred_at DESC);
CREATE INDEX usage_events_time_idx ON public.usage_events (occurred_at DESC);
CREATE INDEX usage_events_category_idx ON public.usage_events (category, occurred_at DESC);
GRANT ALL ON public.usage_events TO service_role;
GRANT SELECT ON public.usage_events TO authenticated;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read usage events" ON public.usage_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 6. Daily rollups
CREATE TABLE public.cost_unit_totals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_unit_id uuid NOT NULL REFERENCES public.cost_units(id) ON DELETE CASCADE,
  day date NOT NULL,
  category public.cost_category NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  actual_cost numeric NOT NULL DEFAULT 0,
  customer_charge numeric NOT NULL DEFAULT 0,
  profit numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cost_unit_id, day, category)
);
GRANT ALL ON public.cost_unit_totals TO service_role;
GRANT SELECT ON public.cost_unit_totals TO authenticated;
ALTER TABLE public.cost_unit_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admins read cost totals" ON public.cost_unit_totals
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));

-- 7. Cost unit issuance
CREATE OR REPLACE FUNCTION public.ensure_user_cost_unit(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.cost_units WHERE user_id = _user_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.cost_units (code, owner_kind, user_id)
  VALUES ('CU-' || lpad(nextval('public.cost_unit_user_seq')::text, 6, '0'), 'user', _user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.cost_units WHERE user_id = _user_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_workspace_cost_unit(_org_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.cost_units WHERE org_id = _org_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.cost_units (code, owner_kind, org_id)
  VALUES ('CU-SCHOOL-' || lpad(nextval('public.cost_unit_workspace_seq')::text, 3, '0'), 'workspace', _org_id)
  ON CONFLICT (org_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.cost_units WHERE org_id = _org_id;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.profiles_issue_cost_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.ensure_user_cost_unit(NEW.user_id);
  RETURN NEW;
END $$;

CREATE TRIGGER profiles_issue_cost_unit
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_issue_cost_unit();

CREATE OR REPLACE FUNCTION public.organizations_issue_cost_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.ensure_workspace_cost_unit(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER organizations_issue_cost_unit
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.organizations_issue_cost_unit();

-- 8. Backfill existing accounts and workspaces
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id FROM public.profiles ORDER BY created_at LOOP
    PERFORM public.ensure_user_cost_unit(r.user_id);
  END LOOP;
  FOR r IN SELECT id FROM public.organizations ORDER BY created_at LOOP
    PERFORM public.ensure_workspace_cost_unit(r.id);
  END LOOP;
END $$;

-- 9. Resolve the billing owner for a usage event: the workspace when the work
-- happens inside a paid/shared workspace, otherwise the personal cost unit.
CREATE OR REPLACE FUNCTION public.resolve_cost_unit(_user_id uuid, _org_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_unit uuid; v_owner uuid;
BEGIN
  IF _org_id IS NOT NULL THEN
    SELECT o.owner_user_id INTO v_owner FROM public.organizations o WHERE o.id = _org_id;
    -- A workspace only bills itself when it is not merely the person's own
    -- private workspace: that case is personal usage.
    IF v_owner IS DISTINCT FROM _user_id THEN
      RETURN public.ensure_workspace_cost_unit(_org_id);
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.org_id = _org_id AND s.status = 'active' AND s.plan <> 'free'
    ) THEN
      RETURN public.ensure_workspace_cost_unit(_org_id);
    END IF;
  END IF;
  IF _user_id IS NULL THEN RETURN NULL; END IF;
  SELECT public.ensure_user_cost_unit(_user_id) INTO v_unit;
  RETURN v_unit;
END $$;

-- 10. Record a metered usage event: price it, apply the locked profit rate and
-- roll it up. Service role only.
CREATE OR REPLACE FUNCTION public.record_usage_event(
  _user_id uuid,
  _org_id uuid,
  _category public.cost_category,
  _metric text,
  _quantity numeric,
  _unit text DEFAULT 'unit',
  _feature text DEFAULT NULL,
  _model text DEFAULT NULL,
  _occurred_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit_id uuid;
  v_price numeric;
  v_cost numeric;
  v_rate numeric;
  v_charge numeric;
  v_id uuid;
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
  WHERE s.cost_unit_id = v_unit_id
    AND s.status = 'active'
    AND s.plan <> 'free'
    AND s.period_start <= _occurred_at
    AND (s.period_end IS NULL OR s.period_end >= _occurred_at)
  ORDER BY s.period_start DESC LIMIT 1;

  IF v_rate IS NULL THEN
    -- Free accounts are not charged: the actual cost is a MathGPL subsidy.
    v_charge := 0;
    v_rate := 0;
  ELSE
    v_charge := v_cost * (1 + v_rate / 100.0);
  END IF;

  INSERT INTO public.usage_events (
    cost_unit_id, actor_user_id, category, metric, quantity, unit,
    unit_price, actual_cost, profit_rate, customer_charge, profit,
    feature, model, occurred_at
  ) VALUES (
    v_unit_id, _user_id, _category, _metric, COALESCE(_quantity, 0), _unit,
    v_price, v_cost, v_rate, v_charge, v_charge - v_cost,
    _feature, _model, _occurred_at
  ) RETURNING id INTO v_id;

  INSERT INTO public.cost_unit_totals (cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit)
  VALUES (v_unit_id, (_occurred_at AT TIME ZONE 'UTC')::date, _category, COALESCE(_quantity, 0), v_cost, v_charge, v_charge - v_cost)
  ON CONFLICT (cost_unit_id, day, category) DO UPDATE
    SET quantity = public.cost_unit_totals.quantity + EXCLUDED.quantity,
        actual_cost = public.cost_unit_totals.actual_cost + EXCLUDED.actual_cost,
        customer_charge = public.cost_unit_totals.customer_charge + EXCLUDED.customer_charge,
        profit = public.cost_unit_totals.profit + EXCLUDED.profit,
        updated_at = now();

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.record_usage_event(uuid, uuid, public.cost_category, text, numeric, text, text, text, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage_event(uuid, uuid, public.cost_category, text, numeric, text, text, text, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.resolve_cost_unit(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_cost_unit(uuid, uuid) TO service_role;

-- 11. Reprice events after the price book or authoritative provider data changes.
CREATE OR REPLACE FUNCTION public.reconcile_usage_costs(_since timestamptz DEFAULT (now() - interval '90 days'))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count int := 0;
BEGIN
  WITH priced AS (
    SELECT e.id,
           (SELECT p.unit_price FROM public.resource_prices p
             WHERE p.metric = e.metric AND p.effective_from <= e.occurred_at
             ORDER BY p.effective_from DESC LIMIT 1) AS price
    FROM public.usage_events e
    WHERE e.occurred_at >= _since
  )
  UPDATE public.usage_events e
     SET unit_price = priced.price,
         actual_cost = COALESCE(priced.price, 0) * e.quantity,
         customer_charge = CASE WHEN e.profit_rate = 0 AND e.customer_charge = 0
                                THEN 0
                                ELSE COALESCE(priced.price, 0) * e.quantity * (1 + e.profit_rate / 100.0) END,
         profit = CASE WHEN e.profit_rate = 0 AND e.customer_charge = 0
                       THEN -1 * COALESCE(priced.price, 0) * e.quantity
                       ELSE COALESCE(priced.price, 0) * e.quantity * (e.profit_rate / 100.0) END,
         reconciled = true
    FROM priced
   WHERE priced.id = e.id
     AND COALESCE(priced.price, -1) IS DISTINCT FROM COALESCE(e.unit_price, -1);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.cost_unit_totals WHERE day >= (_since AT TIME ZONE 'UTC')::date;
  INSERT INTO public.cost_unit_totals (cost_unit_id, day, category, quantity, actual_cost, customer_charge, profit)
  SELECT e.cost_unit_id, (e.occurred_at AT TIME ZONE 'UTC')::date, e.category,
         sum(e.quantity), sum(e.actual_cost), sum(e.customer_charge), sum(e.profit)
  FROM public.usage_events e
  WHERE e.occurred_at >= _since
  GROUP BY 1, 2, 3;

  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_usage_costs(timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_usage_costs(timestamptz) TO service_role;

-- 12. Seed the price-book metric list with no invented prices.
INSERT INTO public.resource_prices (category, metric, unit, unit_price, note) VALUES
  ('ai','ai.input_tokens','per 1M input tokens', NULL, 'Text model input'),
  ('ai','ai.output_tokens','per 1M output tokens', NULL, 'Text model output'),
  ('ai','ai.images','per image', NULL, 'Image generation'),
  ('ai','ai.audio_minutes','per audio minute', NULL, 'Speech and sound generation'),
  ('compute','compute.invocations','per 1k invocations', NULL, 'Server functions and edge functions'),
  ('compute','compute.gb_seconds','per GB-second', NULL, 'Server execution time'),
  ('storage','storage.gb_month','per GB-month', NULL, 'Stored files and media'),
  ('network','network.egress_gb','per GB egress', NULL, 'Response and asset bytes served'),
  ('realtime','realtime.minutes','per realtime minute', NULL, 'Live sessions, smartboard sync, presence'),
  ('realtime','realtime.messages','per 1k messages', NULL, 'Realtime broadcast volume'),
  ('database','database.rows_written','per 1M rows', NULL, 'Database writes'),
  ('database','database.gb_month','per GB-month', NULL, 'Database storage');