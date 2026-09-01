-- Signed-out visitors must be able to read published tutorials. The page_guides
-- read policy calls public.has_capability(), which anon may not execute, so the
-- whole select fails with "permission denied for function has_capability".
grant execute on function public.has_capability(text) to anon, authenticated;
grant execute on function public.can_manage_tutorials() to anon, authenticated;