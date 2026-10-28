-- Activity signals used to rank Community listings.
CREATE OR REPLACE FUNCTION public.account_activity_score(_user_id uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    COALESCE((SELECT count(*) FROM public.classes WHERE owner_id = _user_id), 0) * 3
  + COALESCE((SELECT count(*) FROM public.notebooks WHERE owner_id = _user_id), 0)
  + COALESCE((SELECT count(*) FROM public.community_resources
              WHERE owner_id = _user_id AND status = 'published'), 0) * 5
  + COALESCE((SELECT count(*) FROM public.connections
              WHERE status = 'accepted' AND (from_user_id = _user_id OR to_user_id = _user_id)), 0) * 2
  )::int
$$;

-- Schools that can be discovered in the Community.
CREATE OR REPLACE FUNCTION public.discover_schools(_q text DEFAULT '')
RETURNS TABLE(
  org_id uuid, owner_user_id uuid, name text, mathgpl_id text,
  teachers int, students int, activity int,
  connection_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.owner_user_id, o.name, a.mathgpl_id,
         (SELECT count(*) FROM public.account_memberships m
           WHERE m.org_id = o.id AND m.role = 'teacher' AND m.status = 'active')::int,
         (SELECT count(*) FROM public.account_memberships m
           WHERE m.org_id = o.id AND m.role = 'student' AND m.status = 'active')::int,
         public.account_activity_score(o.owner_user_id),
         (SELECT c.status FROM public.connections c
           WHERE c.status IN ('pending', 'accepted')
             AND ((c.from_user_id = auth.uid() AND c.to_user_id = o.owner_user_id)
               OR (c.to_user_id = auth.uid() AND c.from_user_id = o.owner_user_id))
           ORDER BY c.created_at DESC LIMIT 1)
  FROM public.organizations o
  LEFT JOIN public.account_ids a ON a.user_id = o.owner_user_id
  WHERE auth.uid() IS NOT NULL
    AND o.kind = 'school'
    AND o.visibility = 'public'
    AND o.owner_user_id IS DISTINCT FROM auth.uid()
    AND (COALESCE(_q, '') = '' OR o.name ILIKE '%' || _q || '%' OR a.mathgpl_id ILIKE '%' || _q || '%')
  ORDER BY public.account_activity_score(o.owner_user_id) DESC, o.name
  LIMIT 60
$$;

-- Teachers and students are only discoverable while they are live.
CREATE OR REPLACE FUNCTION public.discover_accounts(_role app_role, _q text DEFAULT '')
RETURNS TABLE(
  user_id uuid, display_name text, mathgpl_id text, role app_role,
  activity int, connection_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         a.mathgpl_id, a.role,
         public.account_activity_score(p.user_id),
         (SELECT c.status FROM public.connections c
           WHERE c.status IN ('pending', 'accepted')
             AND ((c.from_user_id = auth.uid() AND c.to_user_id = p.user_id)
               OR (c.to_user_id = auth.uid() AND c.from_user_id = p.user_id))
           ORDER BY c.created_at DESC LIMIT 1)
  FROM public.profiles p
  JOIN public.account_ids a ON a.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND _role IN ('teacher', 'student')
    AND a.role = _role
    AND p.is_live = true
    AND p.user_id <> auth.uid()
    AND (COALESCE(_q, '') = ''
         OR p.display_name ILIKE '%' || _q || '%'
         OR a.mathgpl_id ILIKE '%' || _q || '%')
  ORDER BY public.account_activity_score(p.user_id) DESC, p.display_name
  LIMIT 60
$$;

REVOKE EXECUTE ON FUNCTION public.discover_schools(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.discover_accounts(app_role, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.account_activity_score(uuid) FROM anon;
