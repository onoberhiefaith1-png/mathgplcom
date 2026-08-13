ALTER TABLE public.staff_codes
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'access',
  ADD COLUMN IF NOT EXISTS claimed_by uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- One active code can only ever serve one person.
CREATE UNIQUE INDEX IF NOT EXISTS staff_redemptions_one_holder_idx
  ON public.staff_redemptions (code_id) WHERE active;

-- Does this account currently hold an access code?
CREATE OR REPLACE FUNCTION public.has_free_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_codes c
    WHERE c.claimed_by = _user_id
      AND c.active
      AND c.revoked_at IS NULL
      AND (c.expires_at IS NULL OR c.expires_at > now())
  )
$$;

REVOKE ALL ON FUNCTION public.has_free_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_free_access(uuid) TO authenticated, service_role;

-- Claim (or re-confirm) an access code as the signed-in caller.
CREATE OR REPLACE FUNCTION public.redeem_access_code(_code text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code public.staff_codes;
  v_unit uuid;
BEGIN
  IF v_user IS NULL THEN RETURN 'rejected'; END IF;

  SELECT * INTO v_code FROM public.staff_codes
  WHERE code = upper(btrim(_code))
  FOR UPDATE;

  IF v_code.id IS NULL
     OR NOT v_code.active
     OR v_code.revoked_at IS NOT NULL
     OR (v_code.expires_at IS NOT NULL AND v_code.expires_at <= now())
     OR (v_code.claimed_by IS NOT NULL AND v_code.claimed_by <> v_user)
  THEN
    RETURN 'rejected';
  END IF;

  IF v_code.claimed_by IS NULL THEN
    UPDATE public.staff_codes
       SET claimed_by = v_user, claimed_at = now()
     WHERE id = v_code.id;
  END IF;

  v_unit := public.ensure_user_cost_unit(v_user);

  INSERT INTO public.staff_redemptions (code_id, cost_unit_id, user_id, active)
  VALUES (v_code.id, v_unit, v_user, true)
  ON CONFLICT (code_id, cost_unit_id) DO UPDATE SET active = true;

  RETURN 'granted';
END $$;

REVOKE ALL ON FUNCTION public.redeem_access_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_access_code(text) TO authenticated, service_role;

-- Access-code holders receive every feature of their own account type.
CREATE OR REPLACE FUNCTION public.effective_entitlements(_user_id uuid)
RETURNS TABLE(feature_key text, source text, payer_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH aud AS (SELECT public.account_audience(_user_id) AS audience),
  free AS (SELECT public.has_free_access(_user_id) AS ok),
  own AS (
    SELECT af.feature_key,
           CASE WHEN af.kind = 'unconfigured' THEN 'unconfigured' ELSE 'own_plan' END AS source,
           _user_id AS payer_user_id
    FROM public.account_features(_user_id) af
    WHERE NOT (SELECT ok FROM free)
    UNION ALL
    SELECT f.key, 'free_access'::text, _user_id
    FROM public.feature_entitlements f
    WHERE (SELECT ok FROM free)
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
  ORDER BY e.feature_key, (e.source IN ('own_plan','free_access')) DESC;
$$;

CREATE OR REPLACE FUNCTION public.has_entitlement(_user_id uuid, _feature text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'platform_owner')
      OR public.has_role(_user_id, 'co_admin')
      OR public.has_role(_user_id, 'student')
      OR public.has_free_access(_user_id)
      OR EXISTS (SELECT 1 FROM public.effective_entitlements(_user_id) e WHERE e.feature_key = _feature)
$$;