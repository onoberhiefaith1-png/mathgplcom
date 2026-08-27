-- Rejected requests are temporary history, not a permanent database.
--
-- Two additive pieces:
--   1. how long an account keeps rejected requests visible (default 24 hours)
--   2. a reader that returns rejected requests *with* the time they were
--      rejected, so the app can expire them on its own.
--
-- The rejection time already exists on public.connections.responded_at; it is
-- simply not exposed by my_connections(), whose return type cannot be widened
-- additively.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rejected_retention_hours integer NOT NULL DEFAULT 24;

CREATE OR REPLACE FUNCTION public.my_rejected_requests()
RETURNS TABLE(
  id uuid,
  relation connection_relation,
  status text,
  direction text,
  counterpart_user_id uuid,
  counterpart_name text,
  counterpart_username text,
  counterpart_role app_role,
  org_id uuid,
  org_name text,
  message text,
  created_at timestamp with time zone,
  responded_at timestamp with time zone,
  child_user_id uuid,
  child_name text,
  child_confirmed_at timestamp with time zone,
  counterpart_accepted_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.relation, c.status,
         CASE WHEN c.from_user_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END,
         other.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'MathGPL account'),
         COALESCE(p.username, 'mathgpl'), a.role,
         c.org_id, o.name,
         c.message, c.created_at, COALESCE(c.responded_at, c.updated_at, c.created_at),
         c.child_user_id,
         COALESCE(NULLIF(cp.display_name, ''), NULL),
         c.child_confirmed_at, c.counterpart_accepted_at
  FROM public.connections c
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.from_user_id = auth.uid() THEN c.to_user_id ELSE c.from_user_id END AS user_id
  ) other
  LEFT JOIN public.profiles p ON p.user_id = other.user_id
  LEFT JOIN public.account_ids a ON a.user_id = other.user_id
  LEFT JOIN public.organizations o ON o.id = c.org_id
  LEFT JOIN public.profiles cp ON cp.user_id = c.child_user_id
  WHERE auth.uid() IS NOT NULL
    AND c.status = 'rejected'
    AND (c.from_user_id = auth.uid() OR c.to_user_id = auth.uid() OR c.child_user_id = auth.uid())
  ORDER BY COALESCE(c.responded_at, c.updated_at, c.created_at) DESC
$$;

REVOKE ALL ON FUNCTION public.my_rejected_requests() FROM public;
GRANT EXECUTE ON FUNCTION public.my_rejected_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_rejected_requests() TO service_role;