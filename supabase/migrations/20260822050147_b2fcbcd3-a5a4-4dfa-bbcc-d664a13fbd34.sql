CREATE OR REPLACE FUNCTION public.enforce_class_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cap integer;
  _count integer;
BEGIN
  IF NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Internal, non-classroom surfaces (Live sessions, Floating Number test
  -- boards) never consume a teacher's plan class allowance.
  IF coalesce(NEW.workspace, 'classroom') <> 'classroom' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.owner_id AND role IN ('platform_owner', 'co_admin')
  ) THEN
    RETURN NEW;
  END IF;

  _cap := public.effective_limit(NEW.owner_id, 'max_classes');
  IF _cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _count
  FROM public.classes
  WHERE owner_id = NEW.owner_id
    AND coalesce(workspace, 'classroom') = 'classroom';

  IF _count >= _cap THEN
    RAISE EXCEPTION 'plan_limit_reached: your plan allows % class(es). Upgrade your plan to create more.', _cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;