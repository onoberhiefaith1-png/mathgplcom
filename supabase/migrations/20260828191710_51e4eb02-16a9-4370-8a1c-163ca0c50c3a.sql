-- Guests may only see and update their own audience row, identified by the
-- private guest token their browser holds. Both are done through
-- security-definer helpers so no policy needs to expose other guests' tokens.

DROP POLICY IF EXISTS "Audience reads the roll of an open session" ON public.session_audience;
DROP POLICY IF EXISTS "Audience keeps its own row alive" ON public.session_audience;

REVOKE UPDATE ON public.session_audience FROM anon;
REVOKE SELECT ON public.session_audience FROM anon;

CREATE OR REPLACE FUNCTION public.live_audience_me(_session uuid, _token text)
RETURNS public.session_audience
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.* FROM public.session_audience a
  WHERE a.session_id = _session
    AND a.guest_token = _token
    AND public.session_is_open(a.session_id)
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.live_audience_touch(
  _session uuid,
  _token text,
  _name text DEFAULT NULL,
  _claim_free_entry boolean DEFAULT false
)
RETURNS public.session_audience
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.session_audience;
  free_entry boolean;
BEGIN
  IF NOT public.session_is_open(_session) THEN
    RETURN NULL;
  END IF;

  SELECT s.allow_free_entry INTO free_entry FROM public.sessions s WHERE s.id = _session;

  UPDATE public.session_audience a
  SET last_seen_at = now(),
      display_name = COALESCE(NULLIF(btrim(_name), ''), a.display_name),
      status = CASE
        WHEN a.status = 'removed' THEN a.status
        WHEN _claim_free_entry AND COALESCE(free_entry, false) THEN 'approved'
        ELSE a.status
      END
  WHERE a.session_id = _session
    AND a.guest_token = _token
  RETURNING a.* INTO row;

  RETURN row;
END;
$$;

REVOKE ALL ON FUNCTION public.live_audience_me(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.live_audience_touch(uuid, text, text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.live_audience_me(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.live_audience_touch(uuid, text, text, boolean) TO anon, authenticated;