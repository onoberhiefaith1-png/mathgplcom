ALTER TABLE public.referral_campaigns
  ADD COLUMN IF NOT EXISTS audience text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS target_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_campaigns_status_check'
  ) THEN
    ALTER TABLE public.referral_campaigns
      ADD CONSTRAINT referral_campaigns_status_check
      CHECK (status IN ('draft', 'live', 'paused', 'retired'));
  END IF;
END $$;

UPDATE public.referral_campaigns SET status = 'draft' WHERE status IS NULL OR status = '';

-- The seeded default platform offer is retired: only the administrator decides rewards.
UPDATE public.referral_campaigns
SET status = 'retired', is_active = false, updated_at = now()
WHERE owner_kind = 'platform'
  AND reward_type = 'payment'
  AND reward_rule->>'currency' = 'GBP'
  AND (reward_rule->>'amount') = '5';

CREATE INDEX IF NOT EXISTS referral_campaigns_status_idx
  ON public.referral_campaigns(status, owner_kind);
CREATE INDEX IF NOT EXISTS referral_campaigns_target_idx
  ON public.referral_campaigns(target_user_id);

CREATE OR REPLACE FUNCTION public.referral_campaign_visible(_audience text[], _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _target = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = ANY (_audience)
    );
$$;

REVOKE ALL ON FUNCTION public.referral_campaign_visible(text[], uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.referral_campaign_visible(text[], uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "referral campaigns readable by owner, org owner, admin" ON public.referral_campaigns;
CREATE POLICY "referral campaigns readable by owner, org owner, admin"
ON public.referral_campaigns FOR SELECT TO authenticated
USING (
  owner_user_id = auth.uid()
  OR public.referral_is_admin()
  OR (org_id IS NOT NULL AND public.is_org_owner(org_id))
  OR (status = 'live' AND is_active AND public.referral_campaign_visible(audience, target_user_id))
);