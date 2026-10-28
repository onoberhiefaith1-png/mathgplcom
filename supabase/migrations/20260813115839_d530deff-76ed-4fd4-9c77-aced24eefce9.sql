-- Plan limits are enforced where the data is written, so the cap holds no
-- matter which screen or client attempts the insert.

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

  SELECT count(*) INTO _count FROM public.classes WHERE owner_id = NEW.owner_id;
  IF _count >= _cap THEN
    RAISE EXCEPTION 'plan_limit_reached: your plan allows % class(es). Upgrade your plan to create more.', _cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_class_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_class_limit_trg ON public.classes;
CREATE TRIGGER enforce_class_limit_trg
BEFORE INSERT ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.enforce_class_limit();

CREATE OR REPLACE FUNCTION public.enforce_class_student_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _cap integer;
  _count integer;
BEGIN
  SELECT owner_id INTO _owner FROM public.classes WHERE id = NEW.class_id;
  IF _owner IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _owner AND role IN ('platform_owner', 'co_admin')
  ) THEN
    RETURN NEW;
  END IF;

  _cap := public.effective_limit(_owner, 'max_students');
  IF _cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _count FROM public.class_members WHERE class_id = NEW.class_id;
  IF _count >= _cap THEN
    RAISE EXCEPTION 'plan_limit_reached: this class is full on the current plan (% students). Upgrade the plan to add more.', _cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_class_student_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_class_student_limit_trg ON public.class_members;
CREATE TRIGGER enforce_class_student_limit_trg
BEFORE INSERT ON public.class_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_class_student_limit();