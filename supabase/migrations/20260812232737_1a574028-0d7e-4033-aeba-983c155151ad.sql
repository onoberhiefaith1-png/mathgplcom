ALTER TABLE public.gateway_payout_accounts
  ADD COLUMN IF NOT EXISTS stripe_account_id text,
  ADD COLUMN IF NOT EXISTS charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payments_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.gateway_plans
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'free';

ALTER TABLE public.gateway_entitlements
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

CREATE TABLE IF NOT EXISTS public.gateway_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL,
  student_id uuid NOT NULL,
  plan_id uuid REFERENCES public.gateway_plans(id) ON DELETE SET NULL,
  plan_name text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending',
  billing_mode text NOT NULL DEFAULT 'one_off',
  stripe_account_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gateway_payments TO authenticated;
GRANT ALL ON public.gateway_payments TO service_role;

ALTER TABLE public.gateway_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their gateway payments" ON public.gateway_payments;
CREATE POLICY "Owners read their gateway payments"
  ON public.gateway_payments FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Students read their own gateway payments" ON public.gateway_payments;
CREATE POLICY "Students read their own gateway payments"
  ON public.gateway_payments FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS gateway_payments_owner_idx ON public.gateway_payments (owner_id, owner_kind, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS gateway_payments_session_idx ON public.gateway_payments (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.gateway_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gateway_touch_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS update_gateway_payments_updated_at ON public.gateway_payments;
CREATE TRIGGER update_gateway_payments_updated_at
  BEFORE UPDATE ON public.gateway_payments
  FOR EACH ROW EXECUTE FUNCTION public.gateway_touch_updated_at();