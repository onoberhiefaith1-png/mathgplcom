
CREATE OR REPLACE FUNCTION public.handle_new_class_join_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  LOOP
    candidate := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    BEGIN
      INSERT INTO public.class_join_codes (class_id, join_code) VALUES (NEW.id, candidate);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 10 THEN RAISE EXCEPTION 'Could not generate unique join code'; END IF;
    END;
  END LOOP;
  RETURN NEW;
END $$;
