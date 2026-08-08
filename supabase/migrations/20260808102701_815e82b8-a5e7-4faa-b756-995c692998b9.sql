ALTER TABLE public.teacher_invitations DROP CONSTRAINT IF EXISTS teacher_invitations_status_check;
ALTER TABLE public.teacher_invitations
  ADD CONSTRAINT teacher_invitations_status_check
  CHECK (status IN ('pending','accepted','declined','revoked','expired'));

CREATE OR REPLACE FUNCTION public.set_workspace_visibility(_org_id uuid, _visibility text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _visibility NOT IN ('public','private') THEN RAISE EXCEPTION 'invalid_visibility'; END IF;
  IF NOT public.owns_org(_org_id) THEN RAISE EXCEPTION 'not_workspace_owner'; END IF;
  UPDATE public.organizations SET visibility = _visibility WHERE id = _org_id;
  RETURN _visibility;
END $$;

-- Community search only ever lists *public* workspaces; private accounts keep
-- full Community access, they are simply not discoverable.
CREATE OR REPLACE FUNCTION public.search_public_teachers(_q text)
RETURNS TABLE(org_id uuid, user_id uuid, display_name text, org_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.owner_user_id,
         COALESCE(NULLIF(p.display_name,''), 'Teacher'),
         o.name
  FROM public.organizations o
  JOIN public.profiles p ON p.user_id = o.owner_user_id
  WHERE o.kind = 'teacher'
    AND o.visibility = 'public'
    AND o.owner_user_id IS DISTINCT FROM auth.uid()
    AND auth.uid() IS NOT NULL
    AND (
      COALESCE(_q,'') = ''
      OR p.display_name ILIKE '%' || _q || '%'
      OR o.name ILIKE '%' || _q || '%'
    )
  ORDER BY p.display_name
  LIMIT 25
$$;

-- Invite a discovered teacher by account (no email typing, no auto-join).
CREATE OR REPLACE FUNCTION public.invite_teacher_by_user(_org_id uuid, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.owns_org(_org_id) THEN RAISE EXCEPTION 'not_workspace_owner'; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = _user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'user_not_found'; END IF;

  INSERT INTO public.teacher_invitations (org_id, invited_by, email, status, expires_at)
  VALUES (_org_id, auth.uid(), v_email, 'pending', now() + interval '30 days')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.my_pending_invitations()
RETURNS TABLE(id uuid, org_id uuid, org_name text, invited_by_name text, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.org_id, o.name,
         COALESCE(NULLIF(p.display_name,''), 'A school'),
         i.created_at
  FROM public.teacher_invitations i
  JOIN public.organizations o ON o.id = i.org_id
  LEFT JOIN public.profiles p ON p.user_id = i.invited_by
  WHERE i.status = 'pending'
    AND auth.uid() IS NOT NULL
    AND lower(i.email) = lower((SELECT u.email FROM auth.users u WHERE u.id = auth.uid()))
  ORDER BY i.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.respond_to_teacher_invitation(_invitation_id uuid, _accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_org uuid; v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = auth.uid();

  SELECT i.org_id INTO v_org
  FROM public.teacher_invitations i
  WHERE i.id = _invitation_id
    AND i.status = 'pending'
    AND lower(i.email) = lower(v_email);

  IF v_org IS NULL THEN RAISE EXCEPTION 'invitation_not_found'; END IF;

  IF _accept THEN
    INSERT INTO public.account_memberships (user_id, org_id, role, status)
    VALUES (auth.uid(), v_org, 'teacher', 'active')
    ON CONFLICT (user_id, org_id) DO UPDATE SET status = 'active';
    UPDATE public.teacher_invitations
    SET status = 'accepted', accepted_user_id = auth.uid()
    WHERE id = _invitation_id;
    RETURN 'accepted';
  END IF;

  UPDATE public.teacher_invitations SET status = 'declined' WHERE id = _invitation_id;
  RETURN 'declined';
END $$;

REVOKE EXECUTE ON FUNCTION public.set_workspace_visibility(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_public_teachers(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_teacher_by_user(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_pending_invitations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_to_teacher_invitation(uuid, boolean) FROM anon;