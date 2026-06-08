
-- Add column to classes FIRST so later policies can reference it
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS smartboard_visibility text NOT NULL DEFAULT 'teacher_only';

-- 1. profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  mathgpl_student_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_mathgpl_id()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  LOOP
    candidate := 'MGP-' || lpad((floor(random()*900000)::int + 100000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE mathgpl_student_id = candidate);
    tries := tries + 1;
    IF tries > 20 THEN RAISE EXCEPTION 'Could not generate unique MathGPL ID'; END IF;
  END LOOP;
  RETURN candidate;
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, mathgpl_student_id)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), public.generate_mathgpl_id())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

INSERT INTO public.profiles (user_id, display_name, mathgpl_student_id)
SELECT u.id, split_part(u.email, '@', 1), public.generate_mathgpl_id()
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- 2. class_members
CREATE TABLE public.class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_members TO authenticated;
GRANT ALL ON public.class_members TO service_role;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_class_owner(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(_class_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.class_members WHERE class_id = _class_id AND user_id = auth.uid())
$$;

CREATE POLICY "Owner manages members" ON public.class_members FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Member sees own membership" ON public.class_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. class_invitations
CREATE TABLE public.class_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, invitee_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_invitations TO authenticated;
GRANT ALL ON public.class_invitations TO service_role;
ALTER TABLE public.class_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages invitations" ON public.class_invitations FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Invitee views own invitations" ON public.class_invitations FOR SELECT TO authenticated
  USING (invitee_user_id = auth.uid());
CREATE POLICY "Invitee updates own invitations" ON public.class_invitations FOR UPDATE TO authenticated
  USING (invitee_user_id = auth.uid()) WITH CHECK (invitee_user_id = auth.uid());

-- 4. class_lesson_notes
CREATE TABLE public.class_lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  visibility text NOT NULL DEFAULT 'teacher_only',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, notebook_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_lesson_notes TO authenticated;
GRANT ALL ON public.class_lesson_notes TO service_role;
ALTER TABLE public.class_lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages class notes" ON public.class_lesson_notes FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Members read visible class notes" ON public.class_lesson_notes FOR SELECT TO authenticated
  USING (visibility = 'student_access_enabled' AND public.is_class_member(class_id));

-- 5. class_smartboard_state
CREATE TABLE public.class_smartboard_state (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  notebook_id uuid,
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_smartboard_state TO authenticated;
GRANT ALL ON public.class_smartboard_state TO service_role;
ALTER TABLE public.class_smartboard_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner writes board state" ON public.class_smartboard_state FOR ALL TO authenticated
  USING (public.is_class_owner(class_id)) WITH CHECK (public.is_class_owner(class_id));
CREATE POLICY "Members read board when enabled" ON public.class_smartboard_state FOR SELECT TO authenticated
  USING (public.is_class_member(class_id) AND EXISTS (
    SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.smartboard_visibility = 'student_access_enabled'
  ));

-- 6. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.class_smartboard_state;

-- 7. Allow members to read class meta
CREATE POLICY "Members can view their class" ON public.classes FOR SELECT TO authenticated
  USING (public.is_class_member(id));
