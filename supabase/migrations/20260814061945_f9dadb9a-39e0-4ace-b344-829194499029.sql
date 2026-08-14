ALTER TABLE public.gateway_plans
  ADD COLUMN IF NOT EXISTS one_time_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS yearly_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS yearly_discount_percentage numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.gateway_payments
  ADD COLUMN IF NOT EXISTS plan_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS granted_items text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS billing_interval text,
  ADD COLUMN IF NOT EXISTS yearly_discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS permanent_access boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

UPDATE public.gateway_plans
SET one_time_enabled = billing_mode = 'one_off',
    monthly_enabled = billing_mode = 'subscription',
    yearly_enabled = false
WHERE COALESCE(price_amount, 0) > 0;

ALTER TABLE public.gateway_plans
  DROP CONSTRAINT IF EXISTS gateway_plans_yearly_discount_range;
ALTER TABLE public.gateway_plans
  ADD CONSTRAINT gateway_plans_yearly_discount_range
  CHECK (yearly_discount_percentage >= 0 AND yearly_discount_percentage <= 100);

DROP FUNCTION IF EXISTS public.gateway_by_handle(text);
CREATE FUNCTION public.gateway_by_handle(_handle text)
RETURNS TABLE(
  owner_id uuid,
  owner_kind text,
  owner_name text,
  username text,
  plan_id uuid,
  slot text,
  name text,
  description text,
  price_amount numeric,
  currency text,
  items text[],
  billing_mode text,
  one_time_enabled boolean,
  monthly_enabled boolean,
  yearly_enabled boolean,
  yearly_discount_percentage numeric,
  payments_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.user_id,
         g.owner_kind,
         COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), p.username),
         p.username,
         g.id,
         g.slot,
         g.name,
         g.description,
         g.price_amount,
         g.currency,
         g.items,
         g.billing_mode,
         g.one_time_enabled,
         g.monthly_enabled,
         g.yearly_enabled,
         g.yearly_discount_percentage,
         COALESCE(a.payments_active AND a.charges_enabled, false)
  FROM public.profiles p
  JOIN public.gateway_plans g ON g.owner_id = p.user_id AND g.is_published
  LEFT JOIN public.gateway_payout_accounts a
         ON a.owner_id = g.owner_id AND a.owner_kind = g.owner_kind
  WHERE lower(p.username) = lower(btrim(_handle, '@'))
  ORDER BY CASE g.slot WHEN 'free' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END;
$$;

REVOKE ALL ON FUNCTION public.gateway_by_handle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gateway_by_handle(text) TO anon, authenticated, service_role;