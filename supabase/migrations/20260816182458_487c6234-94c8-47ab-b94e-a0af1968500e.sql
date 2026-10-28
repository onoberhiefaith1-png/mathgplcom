CREATE OR REPLACE FUNCTION public.effective_limit(_user_id uuid, _limit text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub uuid;
  _value integer;
  _found boolean := false;
BEGIN
  -- Free-access accounts (platform owner test accounts, access-code holders)
  -- have no caps at all.
  IF _user_id IS NOT NULL AND public.has_free_access(_user_id) THEN
    RETURN NULL;
  END IF;

  _sub := public.account_subscription_id(_user_id);

  IF _sub IS NOT NULL THEN
    SELECT sl.limit_value, true INTO _value, _found
    FROM public.subscription_limits sl
    WHERE sl.subscription_id = _sub AND sl.limit_key = _limit
    LIMIT 1;
    IF _found THEN RETURN _value; END IF;
  END IF;

  SELECT pl.limit_value INTO _value
  FROM public.plan_limits pl
  WHERE pl.plan_id = public.account_plan_id(_user_id) AND pl.limit_key = _limit
  LIMIT 1;

  RETURN _value;
END $$;

REVOKE ALL ON FUNCTION public.effective_limit(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.effective_limit(uuid, text) TO authenticated, service_role;