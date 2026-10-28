CREATE TABLE public.student_workspace_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'open',
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT student_workspace_access_source_check CHECK (source IN ('open','paid')),
  CONSTRAINT student_workspace_access_unique UNIQUE (student_id, owner_id)
);

GRANT SELECT, INSERT, UPDATE ON public.student_workspace_access TO authenticated;
GRANT ALL ON public.student_workspace_access TO service_role;

ALTER TABLE public.student_workspace_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read their own workspace access"
  ON public.student_workspace_access FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR owner_id = auth.uid());

CREATE POLICY "Students record their own workspace access"
  ON public.student_workspace_access FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE TRIGGER student_workspace_access_touch
  BEFORE UPDATE ON public.student_workspace_access
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.enter_workspace(_owner_id uuid, _org_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid := auth.uid();
  _connected boolean;
  _paid boolean;
  _entitled boolean;
BEGIN
  IF _student IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.status = 'accepted'
      AND ((c.from_user_id = _student AND c.to_user_id = _owner_id)
        OR (c.to_user_id = _student AND c.from_user_id = _owner_id))
  ) INTO _connected;

  IF NOT _connected THEN
    RETURN 'not_connected';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.gateway_plans p
    WHERE p.owner_id = _owner_id
      AND p.is_published = true
      AND COALESCE(p.price_amount, 0) > 0
  ) INTO _paid;

  IF _paid THEN
    SELECT EXISTS (
      SELECT 1 FROM public.gateway_entitlements e
      WHERE e.owner_id = _owner_id
        AND e.student_id = _student
        AND e.status = 'active'
    ) INTO _entitled;

    IF NOT _entitled THEN
      RETURN 'payment_required';
    END IF;
  END IF;

  INSERT INTO public.student_workspace_access (student_id, owner_id, org_id, source)
  VALUES (_student, _owner_id, _org_id, CASE WHEN _paid THEN 'paid' ELSE 'open' END)
  ON CONFLICT (student_id, owner_id) DO UPDATE
    SET org_id = COALESCE(EXCLUDED.org_id, public.student_workspace_access.org_id),
        source = EXCLUDED.source,
        granted_at = now();

  RETURN 'granted';
END;
$$;

REVOKE ALL ON FUNCTION public.enter_workspace(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enter_workspace(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enter_workspace(uuid, uuid) TO service_role;