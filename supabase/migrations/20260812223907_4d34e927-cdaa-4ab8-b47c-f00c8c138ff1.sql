CREATE TABLE public.gateway_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL CHECK (owner_kind IN ('teacher','school')),
  slot text NOT NULL CHECK (slot IN ('free','pro','third')),
  name text NOT NULL DEFAULT 'Plan',
  description text NOT NULL DEFAULT '',
  price_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'GBP',
  items text[] NOT NULL DEFAULT '{}',
  is_published boolean NOT NULL DEFAULT false,
  auto_grant_existing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, owner_kind, slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_plans TO authenticated;
GRANT SELECT ON public.gateway_plans TO anon;
GRANT ALL ON public.gateway_plans TO service_role;
ALTER TABLE public.gateway_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their gateway plans"
ON public.gateway_plans FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Published gateway plans are viewable"
ON public.gateway_plans FOR SELECT TO anon, authenticated
USING (is_published = true);

CREATE TABLE public.gateway_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL CHECK (owner_kind IN ('teacher','school')),
  student_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.gateway_plans(id) ON DELETE CASCADE,
  granted_items text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'free' CHECK (source IN ('free','manual_grant','paid')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_payment','revoked')),
  payment_provider text,
  payment_reference text,
  paid_amount numeric(10,2),
  paid_currency text,
  content_access jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, owner_kind, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_entitlements TO authenticated;
GRANT ALL ON public.gateway_entitlements TO service_role;
ALTER TABLE public.gateway_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage entitlements for their gateway"
ON public.gateway_entitlements FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Students view their own entitlements"
ON public.gateway_entitlements FOR SELECT TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students choose their own plan"
ON public.gateway_entitlements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students update their own selection"
ON public.gateway_entitlements FOR UPDATE TO authenticated
USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

CREATE TABLE public.gateway_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  owner_kind text NOT NULL CHECK (owner_kind IN ('teacher','school')),
  provider text,
  external_account_id text,
  status text NOT NULL DEFAULT 'not_connected' CHECK (status IN ('not_connected','pending','connected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, owner_kind)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gateway_payout_accounts TO authenticated;
GRANT ALL ON public.gateway_payout_accounts TO service_role;
ALTER TABLE public.gateway_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their payout account"
ON public.gateway_payout_accounts FOR ALL TO authenticated
USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER gateway_plans_updated_at BEFORE UPDATE ON public.gateway_plans
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER gateway_entitlements_updated_at BEFORE UPDATE ON public.gateway_entitlements
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER gateway_payout_accounts_updated_at BEFORE UPDATE ON public.gateway_payout_accounts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX gateway_plans_owner_idx ON public.gateway_plans (owner_id, owner_kind);
CREATE INDEX gateway_entitlements_student_idx ON public.gateway_entitlements (student_id);