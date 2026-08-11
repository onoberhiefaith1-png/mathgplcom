-- 1. Peer relations
ALTER TYPE public.connection_relation ADD VALUE IF NOT EXISTS 'teacher_teacher';
ALTER TYPE public.connection_relation ADD VALUE IF NOT EXISTS 'student_student';
ALTER TYPE public.connection_relation ADD VALUE IF NOT EXISTS 'school_school';

-- 2. Public username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.username_is_valid(_username text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _username ~ '^[A-Za-z0-9_]{3,20}$'
$$;

CREATE OR REPLACE FUNCTION public.default_username(_name text)
RETURNS text LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE
  v_base text;
  v_try text;
  v_n int := 0;
BEGIN
  v_base := regexp_replace(split_part(COALESCE(_name, ''), ' ', 1), '[^A-Za-z0-9_]', '', 'g');
  IF length(v_base) < 3 THEN
    v_base := 'mathgpl' || v_base;
  END IF;
  v_base := left(v_base, 18);
  v_try := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(v_try)) LOOP
    v_n := v_n + 1;
    v_try := v_base || v_n::text;
  END LOOP;
  RETURN v_try;
END $$;

-- Backfill every existing account
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id, COALESCE(NULLIF(first_name, ''), NULLIF(display_name, ''), 'MathGPL') AS n
           FROM public.profiles WHERE username IS NULL ORDER BY created_at LOOP
    UPDATE public.profiles SET username = public.default_username(r.n) WHERE user_id = r.user_id;
  END LOOP;
END $$;

-- New accounts get one automatically
CREATE OR REPLACE FUNCTION public.profiles_set_default_username()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := public.default_username(
      COALESCE(NULLIF(NEW.first_name, ''), NULLIF(NEW.display_name, ''), 'MathGPL'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_default_username ON public.profiles;
CREATE TRIGGER profiles_default_username
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_default_username();

-- Changing my own username
CREATE OR REPLACE FUNCTION public.set_my_username(_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_clean text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_clean := trim(COALESCE(_username, ''));
  IF NOT public.username_is_valid(v_clean) THEN RAISE EXCEPTION 'username_invalid'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p
             WHERE lower(p.username) = lower(v_clean) AND p.user_id <> auth.uid()) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;
  UPDATE public.profiles SET username = v_clean WHERE user_id = auth.uid();
  RETURN v_clean;
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.default_username(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.username_is_valid(text) TO authenticated;