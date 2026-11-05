-- Mirror of supabase/migrations/20261105190000_game_template_share_access.sql

CREATE OR REPLACE FUNCTION public.can_share_game_library()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_flow_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.staff_codes c
      WHERE c.claimed_by = auth.uid()
        AND c.purpose = 'access'
        AND c.active
        AND c.revoked_at IS NULL
        AND (c.expires_at IS NULL OR c.expires_at > now())
    );
$$;

REVOKE ALL ON FUNCTION public.can_share_game_library() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_share_game_library() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_slate_game_library()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.library, false) IS TRUE AND NOT public.can_share_game_library() THEN
      RAISE EXCEPTION 'Only an administrator or an access-code holder can share a game template';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.library IS DISTINCT FROM OLD.library AND NOT public.can_share_game_library() THEN
    RAISE EXCEPTION 'Only an administrator or an access-code holder can share a game template';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.library_game_authors()
RETURNS TABLE(owner_id uuid, author text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (g.owner_id)
    g.owner_id,
    COALESCE(
      NULLIF(btrim(p.display_name), ''),
      NULLIF(btrim(p.full_name), ''),
      NULLIF(btrim(concat_ws(' ', NULLIF(btrim(p.first_name), ''), NULLIF(btrim(p.last_name), ''))), ''),
      'MathGPL teacher'
    ) AS author
  FROM public.slate_games g
  LEFT JOIN public.profiles p ON p.user_id = g.owner_id
  WHERE g.library = true
  ORDER BY g.owner_id;
$$;

REVOKE ALL ON FUNCTION public.library_game_authors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.library_game_authors() TO authenticated, service_role;
