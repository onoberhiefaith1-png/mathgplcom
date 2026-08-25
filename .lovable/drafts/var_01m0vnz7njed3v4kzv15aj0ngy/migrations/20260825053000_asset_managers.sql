-- Permanent Asset Library managers.
-- Manager rights no longer depend only on a redeemed staff code: the platform
-- owner keeps an explicit list of accounts that may add, edit and delete
-- official assets.

CREATE TABLE IF NOT EXISTS public.asset_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  granted_by uuid,
  note text,
  granted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asset_managers TO authenticated;
GRANT ALL ON public.asset_managers TO service_role;

ALTER TABLE public.asset_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages asset managers" ON public.asset_managers;
CREATE POLICY "Owner manages asset managers"
  ON public.asset_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner'::app_role));

DROP POLICY IF EXISTS "See my own manager row" ON public.asset_managers;
CREATE POLICY "See my own manager row"
  ON public.asset_managers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Owner, co-admin, the managed list, or a live asset-manager code.
CREATE OR REPLACE FUNCTION public.can_manage_gpl_assets()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'platform_owner'::app_role)
      OR public.has_role(auth.uid(), 'co_admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.asset_managers m WHERE m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.staff_codes c
        WHERE c.purpose = 'asset_manager'
          AND c.claimed_by = auth.uid()
          AND c.active
          AND c.revoked_at IS NULL
          AND (c.expires_at IS NULL OR c.expires_at > now())
      )
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_gpl_assets() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_gpl_assets() TO authenticated, service_role;

-- Anyone already holding a live asset-manager code becomes a permanent manager,
-- so the right survives the code being revoked or expiring.
INSERT INTO public.asset_managers (user_id, note)
SELECT DISTINCT c.claimed_by, 'migrated from asset-manager code'
FROM public.staff_codes c
WHERE c.purpose = 'asset_manager'
  AND c.claimed_by IS NOT NULL
  AND c.active
  AND c.revoked_at IS NULL
ON CONFLICT (user_id) DO NOTHING;
