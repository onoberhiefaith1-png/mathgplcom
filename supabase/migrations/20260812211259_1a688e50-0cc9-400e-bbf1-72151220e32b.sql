DROP POLICY IF EXISTS "accounts read their own usage events" ON public.usage_events;
REVOKE SELECT ON public.usage_events FROM anon;
REVOKE SELECT ON public.usage_events FROM authenticated;