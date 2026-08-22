CREATE OR REPLACE FUNCTION public.class_join_gate(code text)
 RETURNS TABLE(id uuid, name text, org_id uuid, allowed boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.name, c.org_id,
         (
           c.owner_id = auth.uid()
           OR EXISTS (
             SELECT 1 FROM public.student_workspace_access a
             WHERE a.student_id = auth.uid()
               AND (a.owner_id = c.owner_id OR (c.org_id IS NOT NULL AND a.org_id = c.org_id))
           )
           OR (o.id IS NOT NULL AND (public.is_workspace_member(o.id) OR public.is_org_owner(o.id)))
         ) AS allowed
  FROM public.class_join_codes j
  JOIN public.classes c ON c.id = j.class_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  WHERE j.join_code = upper(code)
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.join_class_with_code(code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _student uuid := auth.uid();
  _class_id uuid;
  _org_id uuid;
  _allowed boolean;
BEGIN
  IF _student IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT g.id, g.org_id, g.allowed INTO _class_id, _org_id, _allowed
  FROM public.class_join_gate(code) g;

  IF _class_id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.class_members m
    WHERE m.class_id = _class_id AND m.user_id = _student
  ) THEN
    RETURN jsonb_build_object('status', 'joined', 'class_id', _class_id);
  END IF;

  IF NOT COALESCE(_allowed, false) THEN
    RETURN jsonb_build_object('status', 'not_entered', 'class_id', _class_id, 'org_id', _org_id);
  END IF;

  INSERT INTO public.class_members (class_id, user_id)
  VALUES (_class_id, _student)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('status', 'joined', 'class_id', _class_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.join_class_with_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_class_with_code(text) TO authenticated;