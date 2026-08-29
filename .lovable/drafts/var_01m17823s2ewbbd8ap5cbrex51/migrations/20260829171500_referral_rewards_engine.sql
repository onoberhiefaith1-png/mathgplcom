-- Referral & Rewards engine.
--
-- The link identifies the referrer; the campaign holds the reward RULE (type,
-- currency, amount, trigger) so no reward value is ever hard-coded. Totals are
-- always derived from these rows, per currency.

-- ---------------------------------------------------------------- campaigns
CREATE TABLE IF NOT EXISTS public.referral_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind text NOT NULL CHECK (owner_kind IN ('platform', 'school', 'teacher')),
  owner_user_id uuid NOT NULL,
  org_id uuid,
  name text NOT NULL,
  -- Text, not an enum: a future reward type is a new value, not a migration of
  -- every existing campaign.
  reward_type text NOT NULL DEFAULT 'payment',
  reward_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  trigger_event text NOT NULL DEFAULT 'subscription'
    CHECK (trigger_event IN ('registration', 'subscription')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.referral_campaigns TO authenticated;
GRANT ALL ON public.referral_campaigns TO service_role;
ALTER TABLE public.referral_campaigns ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------- links
CREATE TABLE IF NOT EXISTS public.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.referral_campaigns(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL,
  org_id uuid,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, referrer_user_id)
);

CREATE INDEX IF NOT EXISTS referral_links_referrer_idx ON public.referral_links(referrer_user_id);
GRANT SELECT, INSERT, UPDATE ON public.referral_links TO authenticated;
GRANT ALL ON public.referral_links TO service_role;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------ events
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('opened', 'registered', 'subscribed', 'reward')),
  referred_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_events_code_idx ON public.referral_events(code, created_at DESC);
GRANT SELECT ON public.referral_events TO authenticated;
GRANT ALL ON public.referral_events TO service_role;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------ attributions
CREATE TABLE IF NOT EXISTS public.referral_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.referral_links(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.referral_campaigns(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL,
  org_id uuid,
  referred_user_id uuid NOT NULL UNIQUE,
  referred_role text,
  registered_at timestamptz NOT NULL DEFAULT now(),
  subscribed_at timestamptz
);

CREATE INDEX IF NOT EXISTS referral_attributions_referrer_idx
  ON public.referral_attributions(referrer_user_id);
CREATE INDEX IF NOT EXISTS referral_attributions_org_idx ON public.referral_attributions(org_id);
GRANT SELECT ON public.referral_attributions TO authenticated;
GRANT ALL ON public.referral_attributions TO service_role;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------- rewards
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL UNIQUE
    REFERENCES public.referral_attributions(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.referral_campaigns(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL,
  org_id uuid,
  reward_type text NOT NULL,
  currency text,
  amount numeric(12, 2),
  discount_kind text,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'paid')),
  qualified_at timestamptz,
  paid_at timestamptz,
  paid_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx
  ON public.referral_rewards(referrer_user_id, status);
CREATE INDEX IF NOT EXISTS referral_rewards_org_idx ON public.referral_rewards(org_id);
GRANT SELECT, UPDATE ON public.referral_rewards TO authenticated;
GRANT ALL ON public.referral_rewards TO service_role;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.referral_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'platform_owner')
      OR public.has_role(auth.uid(), 'co_admin')
$$;

GRANT EXECUTE ON FUNCTION public.referral_is_admin() TO authenticated, service_role;

-- --------------------------------------------------------------- policies
DROP POLICY IF EXISTS "referral campaigns readable by owner, org owner, admin" ON public.referral_campaigns;
CREATE POLICY "referral campaigns readable by owner, org owner, admin"
ON public.referral_campaigns FOR SELECT TO authenticated
USING (
  owner_user_id = auth.uid()
  OR public.referral_is_admin()
  OR (org_id IS NOT NULL AND public.is_org_owner(org_id))
);

DROP POLICY IF EXISTS "referral campaigns created by their owner" ON public.referral_campaigns;
CREATE POLICY "referral campaigns created by their owner"
ON public.referral_campaigns FOR INSERT TO authenticated
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "referral campaigns edited by owner or admin" ON public.referral_campaigns;
CREATE POLICY "referral campaigns edited by owner or admin"
ON public.referral_campaigns FOR UPDATE TO authenticated
USING (owner_user_id = auth.uid() OR public.referral_is_admin())
WITH CHECK (owner_user_id = auth.uid() OR public.referral_is_admin());

DROP POLICY IF EXISTS "referral campaigns removed by owner or admin" ON public.referral_campaigns;
CREATE POLICY "referral campaigns removed by owner or admin"
ON public.referral_campaigns FOR DELETE TO authenticated
USING (owner_user_id = auth.uid() OR public.referral_is_admin());

DROP POLICY IF EXISTS "referral links readable by referrer, org owner, admin" ON public.referral_links;
CREATE POLICY "referral links readable by referrer, org owner, admin"
ON public.referral_links FOR SELECT TO authenticated
USING (
  referrer_user_id = auth.uid()
  OR public.referral_is_admin()
  OR (org_id IS NOT NULL AND public.is_org_owner(org_id))
);

DROP POLICY IF EXISTS "referral links created by their referrer" ON public.referral_links;
CREATE POLICY "referral links created by their referrer"
ON public.referral_links FOR INSERT TO authenticated
WITH CHECK (referrer_user_id = auth.uid());

DROP POLICY IF EXISTS "referral links toggled by referrer or admin" ON public.referral_links;
CREATE POLICY "referral links toggled by referrer or admin"
ON public.referral_links FOR UPDATE TO authenticated
USING (referrer_user_id = auth.uid() OR public.referral_is_admin())
WITH CHECK (referrer_user_id = auth.uid() OR public.referral_is_admin());

DROP POLICY IF EXISTS "referral events readable by admin" ON public.referral_events;
CREATE POLICY "referral events readable by admin"
ON public.referral_events FOR SELECT TO authenticated
USING (public.referral_is_admin());

DROP POLICY IF EXISTS "referral attributions readable by referrer, org owner, admin" ON public.referral_attributions;
CREATE POLICY "referral attributions readable by referrer, org owner, admin"
ON public.referral_attributions FOR SELECT TO authenticated
USING (
  referrer_user_id = auth.uid()
  OR public.referral_is_admin()
  OR (org_id IS NOT NULL AND public.is_org_owner(org_id))
);

DROP POLICY IF EXISTS "referral rewards readable by referrer, org owner, admin" ON public.referral_rewards;
CREATE POLICY "referral rewards readable by referrer, org owner, admin"
ON public.referral_rewards FOR SELECT TO authenticated
USING (
  referrer_user_id = auth.uid()
  OR public.referral_is_admin()
  OR (org_id IS NOT NULL AND public.is_org_owner(org_id))
);

-- Only an administrator (platform, or the school that owns the campaign) may
-- record that a reward has been paid. MathGPL never moves the money itself.
DROP POLICY IF EXISTS "referral rewards settled by admin or school owner" ON public.referral_rewards;
CREATE POLICY "referral rewards settled by admin or school owner"
ON public.referral_rewards FOR UPDATE TO authenticated
USING (public.referral_is_admin() OR (org_id IS NOT NULL AND public.is_org_owner(org_id)))
WITH CHECK (public.referral_is_admin() OR (org_id IS NOT NULL AND public.is_org_owner(org_id)));

-- ------------------------------------------- subscription → reward eligible
CREATE OR REPLACE FUNCTION public.referral_settle_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _attribution public.referral_attributions;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('active', 'trialing') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _attribution
  FROM public.referral_attributions
  WHERE referred_user_id = NEW.user_id;

  IF _attribution.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF _attribution.subscribed_at IS NULL THEN
    UPDATE public.referral_attributions
       SET subscribed_at = now()
     WHERE id = _attribution.id;

    INSERT INTO public.referral_events (code, kind, referred_user_id)
    SELECT l.code, 'subscribed', NEW.user_id
      FROM public.referral_links l
     WHERE l.id = _attribution.link_id;
  END IF;

  UPDATE public.referral_rewards r
     SET status = 'eligible', qualified_at = COALESCE(r.qualified_at, now())
   WHERE r.attribution_id = _attribution.id
     AND r.status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS referral_settle_subscription_ins ON public.subscriptions;
CREATE TRIGGER referral_settle_subscription_ins
AFTER INSERT ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.referral_settle_subscription();

DROP TRIGGER IF EXISTS referral_settle_subscription_upd ON public.subscriptions;
CREATE TRIGGER referral_settle_subscription_upd
AFTER UPDATE OF status ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.referral_settle_subscription();

-- ------------------------------------------------------- default campaign
INSERT INTO public.referral_campaigns (owner_kind, owner_user_id, name, reward_type, reward_rule, trigger_event, is_active)
SELECT 'platform', ur.user_id, 'MathGPL Referral Campaign', 'payment',
       jsonb_build_object('currency', 'GBP', 'amount', 5),
       'subscription', true
  FROM public.user_roles ur
 WHERE ur.role = 'platform_owner'
   AND NOT EXISTS (SELECT 1 FROM public.referral_campaigns WHERE owner_kind = 'platform')
 LIMIT 1;
