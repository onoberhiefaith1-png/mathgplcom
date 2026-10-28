DROP POLICY IF EXISTS "Students choose their own plan" ON public.gateway_entitlements;
DROP POLICY IF EXISTS "Students update their own selection" ON public.gateway_entitlements;

CREATE OR REPLACE FUNCTION public.gateway_by_handle(_handle text)
RETURNS TABLE (
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
  items text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
         g.items
  FROM public.profiles p
  JOIN public.gateway_plans g ON g.owner_id = p.user_id AND g.is_published
  WHERE lower(p.username) = lower(btrim(_handle, '@'))
  ORDER BY CASE g.slot WHEN 'free' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END
$$;

GRANT EXECUTE ON FUNCTION public.gateway_by_handle(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.gateway_choose_plan(_plan_id uuid)
RETURNS public.gateway_entitlements
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.gateway_plans;
  v_row public.gateway_entitlements;
  v_uid uuid := auth.uid();
  v_paid boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO v_plan FROM public.gateway_plans WHERE id = _plan_id AND is_published;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'plan_not_available';
  END IF;

  v_paid := COALESCE(v_plan.price_amount, 0) > 0;

  INSERT INTO public.gateway_entitlements
    (owner_id, owner_kind, student_id, plan_id, granted_items, source, status)
  VALUES (
    v_plan.owner_id,
    v_plan.owner_kind,
    v_uid,
    v_plan.id,
    CASE WHEN v_paid THEN '{}'::text[] ELSE v_plan.items END,
    CASE WHEN v_paid THEN 'paid' ELSE 'free' END,
    CASE WHEN v_paid THEN 'pending_payment' ELSE 'active' END
  )
  ON CONFLICT (owner_id, owner_kind, student_id) DO UPDATE
    SET plan_id = EXCLUDED.plan_id,
        granted_items = EXCLUDED.granted_items,
        source = EXCLUDED.source,
        status = EXCLUDED.status,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.gateway_choose_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gateway_choose_plan(uuid) TO authenticated;