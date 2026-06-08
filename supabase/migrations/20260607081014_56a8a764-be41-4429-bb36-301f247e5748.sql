
-- 1) Move join_code out of classes into a separate owner-only table
CREATE TABLE IF NOT EXISTS public.class_join_codes (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  join_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_join_codes TO service_role;
-- Intentionally NO grants to anon/authenticated; access is via SECURITY DEFINER RPCs only.

ALTER TABLE public.class_join_codes ENABLE ROW LEVEL SECURITY;

-- Backfill from existing classes.join_code
INSERT INTO public.class_join_codes (class_id, join_code)
SELECT id, join_code FROM public.classes
ON CONFLICT (class_id) DO NOTHING;

-- Update RPCs to read from the new table
CREATE OR REPLACE FUNCTION public.get_class_join_code(_class_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT j.join_code
  FROM public.class_join_codes j
  JOIN public.classes c ON c.id = j.class_id
  WHERE j.class_id = _class_id AND c.owner_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_owned_class_codes()
RETURNS TABLE(id uuid, join_code text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, j.join_code
  FROM public.classes c
  JOIN public.class_join_codes j ON j.class_id = c.id
  WHERE c.owner_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.lookup_class_by_code(code text)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name
  FROM public.class_join_codes j
  JOIN public.classes c ON c.id = j.class_id
  WHERE j.join_code = upper(code)
  LIMIT 1
$$;

-- Auto-generate a join code whenever a class is created
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
  IF NEW.join_code IS NOT NULL AND NEW.join_code <> '' THEN
    INSERT INTO public.class_join_codes (class_id, join_code)
    VALUES (NEW.id, upper(NEW.join_code))
    ON CONFLICT (class_id) DO NOTHING;
    RETURN NEW;
  END IF;
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

DROP TRIGGER IF EXISTS classes_join_code_autocreate ON public.classes;
CREATE TRIGGER classes_join_code_autocreate
AFTER INSERT ON public.classes
FOR EACH ROW EXECUTE FUNCTION public.handle_new_class_join_code();

-- Drop the now-redundant column on classes (the source of the member-readable leak)
ALTER TABLE public.classes DROP COLUMN IF EXISTS join_code;

-- 2) Tighten shares_class_with: remove the join-request branch that leaked profiles
CREATE OR REPLACE FUNCTION public.shares_class_with(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.class_members m ON m.class_id = c.id
    WHERE c.owner_id = auth.uid() AND m.user_id = _other
  ) OR EXISTS (
    SELECT 1 FROM public.classes c
    JOIN public.class_members m ON m.class_id = c.id
    WHERE c.owner_id = _other AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.class_members a
    JOIN public.class_members b ON a.class_id = b.class_id
    WHERE a.user_id = auth.uid() AND b.user_id = _other
  );
$$;

-- 3) Let class members read notebook content for student-enabled shared notes
CREATE OR REPLACE FUNCTION public.notebook_shared_to_member(_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_lesson_notes cln
    JOIN public.class_members cm ON cm.class_id = cln.class_id
    WHERE cln.notebook_id = _notebook_id
      AND cln.visibility = 'student_access_enabled'
      AND cm.user_id = auth.uid()
  );
$$;

CREATE POLICY "Members read shared notebooks"
ON public.notebooks FOR SELECT
TO authenticated
USING (public.notebook_shared_to_member(id));

CREATE POLICY "Members read shared notebook sections"
ON public.notebook_sections FOR SELECT
TO authenticated
USING (public.notebook_shared_to_member(notebook_id));

CREATE POLICY "Members read shared notebook subsections"
ON public.notebook_subsections FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notebook_sections s
    WHERE s.id = notebook_subsections.section_id
      AND public.notebook_shared_to_member(s.notebook_id)
  )
);

CREATE POLICY "Members read shared notebook blocks"
ON public.notebook_blocks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.notebook_sections s
    WHERE s.id = notebook_blocks.section_id
      AND public.notebook_shared_to_member(s.notebook_id)
  )
);
