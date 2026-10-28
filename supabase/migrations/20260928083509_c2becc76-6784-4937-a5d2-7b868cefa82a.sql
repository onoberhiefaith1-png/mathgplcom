
CREATE TABLE public.academia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  allow_teacher_assign boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id uuid NOT NULL REFERENCES public.academia(id) ON DELETE CASCADE,
  name text NOT NULL, position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.academia_classes(id) ON DELETE CASCADE,
  name text NOT NULL, position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_subject_teachers (
  subject_id uuid NOT NULL REFERENCES public.academia_subjects(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, teacher_id)
);
CREATE TABLE public.academia_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.academia_subjects(id) ON DELETE CASCADE,
  name text NOT NULL, position int NOT NULL DEFAULT 0, created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.academia_subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.academia_topics(id) ON DELETE CASCADE,
  name text NOT NULL, position int NOT NULL DEFAULT 0, created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academia, public.academia_classes, public.academia_subjects, public.academia_subject_teachers, public.academia_topics, public.academia_subtopics TO authenticated;
GRANT ALL ON public.academia, public.academia_classes, public.academia_subjects, public.academia_subject_teachers, public.academia_topics, public.academia_subtopics TO service_role;

CREATE OR REPLACE FUNCTION public.academia_org_of_subject(_subject uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT a.org_id FROM academia_subjects s JOIN academia_classes c ON c.id=s.class_id JOIN academia a ON a.id=c.academia_id WHERE s.id=_subject $$;
CREATE OR REPLACE FUNCTION public.academia_org_of_class(_class uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT a.org_id FROM academia_classes c JOIN academia a ON a.id=c.academia_id WHERE c.id=_class $$;
CREATE OR REPLACE FUNCTION public.academia_can_view_org(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT is_org_owner(_org) OR is_workspace_member(_org)
    OR EXISTS (SELECT 1 FROM academia WHERE org_id=_org AND visibility='public') $$;
CREATE OR REPLACE FUNCTION public.academia_can_build_subject(_subject uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT is_workspace_member(academia_org_of_subject(_subject))
    AND EXISTS (SELECT 1 FROM academia_subject_teachers WHERE subject_id=_subject AND teacher_id=auth.uid()) $$;

ALTER TABLE public.academia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_subject_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_subtopics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view academia" ON public.academia FOR SELECT TO authenticated USING (academia_can_view_org(org_id));
CREATE POLICY "school manages academia" ON public.academia FOR ALL TO authenticated USING (is_org_owner(org_id)) WITH CHECK (is_org_owner(org_id));

CREATE POLICY "view classes" ON public.academia_classes FOR SELECT TO authenticated USING (academia_can_view_org(academia_org_of_class(id)));
CREATE POLICY "school manages classes" ON public.academia_classes FOR ALL TO authenticated
  USING (is_org_owner((SELECT org_id FROM academia WHERE id=academia_id)))
  WITH CHECK (is_org_owner((SELECT org_id FROM academia WHERE id=academia_id)));

CREATE POLICY "view subjects" ON public.academia_subjects FOR SELECT TO authenticated USING (academia_can_view_org(academia_org_of_class(class_id)));
CREATE POLICY "school manages subjects" ON public.academia_subjects FOR ALL TO authenticated
  USING (is_org_owner(academia_org_of_class(class_id))) WITH CHECK (is_org_owner(academia_org_of_class(class_id)));

CREATE POLICY "view subject teachers" ON public.academia_subject_teachers FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR is_org_owner(academia_org_of_subject(subject_id)));
CREATE POLICY "school assigns teachers" ON public.academia_subject_teachers FOR ALL TO authenticated
  USING (is_org_owner(academia_org_of_subject(subject_id))) WITH CHECK (is_org_owner(academia_org_of_subject(subject_id)));

CREATE POLICY "view topics" ON public.academia_topics FOR SELECT TO authenticated USING (academia_can_view_org(academia_org_of_subject(subject_id)));
CREATE POLICY "teachers build topics" ON public.academia_topics FOR ALL TO authenticated
  USING (academia_can_build_subject(subject_id)) WITH CHECK (academia_can_build_subject(subject_id));

CREATE POLICY "view subtopics" ON public.academia_subtopics FOR SELECT TO authenticated
  USING (academia_can_view_org(academia_org_of_subject((SELECT subject_id FROM academia_topics WHERE id=topic_id))));
CREATE POLICY "teachers build subtopics" ON public.academia_subtopics FOR ALL TO authenticated
  USING (academia_can_build_subject((SELECT subject_id FROM academia_topics WHERE id=topic_id)))
  WITH CHECK (academia_can_build_subject((SELECT subject_id FROM academia_topics WHERE id=topic_id)));

CREATE OR REPLACE FUNCTION public.academia_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER t1 BEFORE UPDATE ON public.academia FOR EACH ROW EXECUTE FUNCTION academia_touch();
CREATE TRIGGER t1 BEFORE UPDATE ON public.academia_classes FOR EACH ROW EXECUTE FUNCTION academia_touch();
CREATE TRIGGER t1 BEFORE UPDATE ON public.academia_subjects FOR EACH ROW EXECUTE FUNCTION academia_touch();
CREATE TRIGGER t1 BEFORE UPDATE ON public.academia_topics FOR EACH ROW EXECUTE FUNCTION academia_touch();
CREATE TRIGGER t1 BEFORE UPDATE ON public.academia_subtopics FOR EACH ROW EXECUTE FUNCTION academia_touch();

-- Returns (and creates on first use) the school's Academia.
CREATE OR REPLACE FUNCTION public.ensure_school_academia(_org uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id uuid; _name text;
BEGIN
  SELECT id INTO _id FROM academia WHERE org_id=_org;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT is_org_owner(_org) THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT name INTO _name FROM organizations WHERE id=_org;
  INSERT INTO academia(org_id,name) VALUES (_org, coalesce(_name,'School')||' Academia') RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_school_academia(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_school_academia(uuid) TO authenticated;
