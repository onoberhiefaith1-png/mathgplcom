ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS time_zone text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS subjects_taught text,
  ADD COLUMN IF NOT EXISTS school_name text,
  ADD COLUMN IF NOT EXISTS children_count integer,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS school_type text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS country text;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.profiles (
    user_id, display_name, mathgpl_student_id,
    first_name, last_name, country, time_zone, date_of_birth,
    subjects_taught, school_name, children_count,
    marketing_opt_in, terms_accepted_at
  )
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(m->>'display_name',''),
      NULLIF(trim(COALESCE(m->>'first_name','') || ' ' || COALESCE(m->>'last_name','')), ''),
      split_part(NEW.email, '@', 1)
    ),
    public.generate_mathgpl_id(),
    NULLIF(m->>'first_name',''),
    NULLIF(m->>'last_name',''),
    NULLIF(m->>'country',''),
    NULLIF(m->>'time_zone',''),
    NULLIF(m->>'date_of_birth','')::date,
    NULLIF(m->>'subjects_taught',''),
    NULLIF(m->>'school_name',''),
    NULLIF(m->>'children_count','')::int,
    COALESCE((m->>'marketing_opt_in')::boolean, false),
    CASE WHEN COALESCE((m->>'terms_accepted')::boolean, false) THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $function$;