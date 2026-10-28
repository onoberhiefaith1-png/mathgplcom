CREATE OR REPLACE FUNCTION public.ensure_school_academia(_org uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _name text; _kind text;
BEGIN
  SELECT name, kind INTO _name, _kind FROM organizations WHERE id=_org;
  IF _kind IS DISTINCT FROM 'school' THEN RAISE EXCEPTION 'Only a school can create an Academia'; END IF;
  SELECT id INTO _id FROM academia WHERE org_id=_org;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT is_org_owner(_org) THEN RAISE EXCEPTION 'not allowed'; END IF;
  INSERT INTO academia(org_id,name) VALUES (_org, coalesce(_name,'School')||' Academia') RETURNING id INTO _id;
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.academia_school_only()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT kind FROM organizations WHERE id = NEW.org_id) IS DISTINCT FROM 'school' THEN
    RAISE EXCEPTION 'Only a school can create an Academia';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS academia_school_only ON public.academia;
CREATE TRIGGER academia_school_only BEFORE INSERT ON public.academia
FOR EACH ROW EXECUTE FUNCTION public.academia_school_only();