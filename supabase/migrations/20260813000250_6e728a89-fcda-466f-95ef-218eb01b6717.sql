DROP FUNCTION IF EXISTS public.gateway_by_handle(text);

CREATE FUNCTION public.gateway_by_handle(_handle text)
 RETURNS TABLE(owner_id uuid, owner_kind text, owner_name text, username text, plan_id uuid, slot text, name text, description text, price_amount numeric, currency text, items text[], billing_mode text, payments_active boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id,
         g.owner_kind,
         COALESCE(NULLIF(p.display_name, ''), NULLIF(p.full_name, ''), p.username),
         p.username,
         g.id,
         g.slot,
         g.name,
         g.description,
         g.price_amount,
         g.currency,
         g.items,
         g.billing_mode,
         COALESCE(a.payments_active AND a.charges_enabled, false)
  FROM public.profiles p
  JOIN public.gateway_plans g ON g.owner_id = p.user_id AND g.is_published
  LEFT JOIN public.gateway_payout_accounts a
         ON a.owner_id = g.owner_id AND a.owner_kind = g.owner_kind
  WHERE lower(p.username) = lower(btrim(_handle, '@'))
    AND (
      COALESCE(g.price_amount, 0) <= 0
      OR COALESCE(a.payments_active AND a.charges_enabled, false)
    )
  ORDER BY CASE g.slot WHEN 'free' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END
$function$;

REVOKE ALL ON FUNCTION public.gateway_by_handle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gateway_by_handle(text) TO anon, authenticated, service_role;