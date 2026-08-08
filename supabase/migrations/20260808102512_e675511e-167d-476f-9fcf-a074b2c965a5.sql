-- Homepage/building config of a workspace the caller may view.
CREATE OR REPLACE FUNCTION public.get_workspace_homepage_config(_org_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.homepage_config
  FROM public.organizations o
  JOIN public.profiles p ON p.user_id = o.owner_user_id
  WHERE o.id = _org_id AND public.can_view_workspace(_org_id)
  LIMIT 1
$$;

-- Join-code gate: the code identifies the class, the relationship grants entry.
CREATE OR REPLACE FUNCTION public.class_join_gate(code text)
RETURNS TABLE(id uuid, name text, org_id uuid, allowed boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.org_id,
         (
           o.id IS NULL
           OR o.visibility = 'public'
           OR public.is_workspace_member(o.id)
         ) AS allowed
  FROM public.class_join_codes j
  JOIN public.classes c ON c.id = j.class_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  WHERE j.join_code = upper(code)
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.my_workspaces() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_active_workspace(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.workspace_students(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_workspace(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_homepage_config(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.class_join_gate(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_org_invite_code() FROM anon, authenticated;