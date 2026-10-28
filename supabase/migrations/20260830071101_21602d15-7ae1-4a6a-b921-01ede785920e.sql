-- 3D ACADEMY WORLD — structure only. Products stay in their own tables and are
-- referenced by placements, never duplicated.

CREATE TABLE public.academies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Academy',
  welcome_message TEXT NOT NULL DEFAULT '',
  featured_title TEXT NOT NULL DEFAULT 'Featured',
  template TEXT NOT NULL DEFAULT 'modern-hallway',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX academies_org_unique ON public.academies (org_id) WHERE org_id IS NOT NULL;
CREATE UNIQUE INDEX academies_owner_unique ON public.academies (owner_id) WHERE org_id IS NULL;

CREATE TABLE public.academy_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  academy_id UUID NOT NULL REFERENCES public.academies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New room',
  description TEXT NOT NULL DEFAULT '',
  room_type TEXT NOT NULL DEFAULT 'course',
  image_url TEXT,
  icon_url TEXT,
  accent TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX academy_rooms_academy_idx ON public.academy_rooms (academy_id, position);

CREATE TABLE public.academy_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.academy_rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New category',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  icon_url TEXT,
  accent TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX academy_categories_room_idx ON public.academy_categories (room_id, position);

CREATE TABLE public.academy_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.academy_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New topic',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  icon_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX academy_topics_category_idx ON public.academy_topics (category_id, position);

CREATE TABLE public.academy_subtopics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.academy_topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New subtopic',
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  icon_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX academy_subtopics_topic_idx ON public.academy_subtopics (topic_id, position);

-- A placement is a REFERENCE to an existing product. Deleting a placement never
-- deletes the product; the same product may be placed many times.
CREATE TABLE public.academy_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtopic_id UUID NOT NULL REFERENCES public.academy_subtopics(id) ON DELETE CASCADE,
  product_kind TEXT NOT NULL,
  product_id UUID NOT NULL,
  title_override TEXT,
  description_override TEXT,
  image_url TEXT,
  badge TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academy_placements_kind_check
    CHECK (product_kind IN ('course', 'game', 'adventure', 'assessment'))
);
CREATE INDEX academy_placements_subtopic_idx ON public.academy_placements (subtopic_id, position);
CREATE INDEX academy_placements_product_idx ON public.academy_placements (product_kind, product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_subtopics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_placements TO authenticated;
GRANT ALL ON public.academies TO service_role;
GRANT ALL ON public.academy_rooms TO service_role;
GRANT ALL ON public.academy_categories TO service_role;
GRANT ALL ON public.academy_topics TO service_role;
GRANT ALL ON public.academy_subtopics TO service_role;
GRANT ALL ON public.academy_placements TO service_role;

-- Editing rights for one academy: creator, workspace owner, or platform admin.
CREATE OR REPLACE FUNCTION public.can_edit_academy(_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academies a
    WHERE a.id = _academy_id
      AND (
        a.owner_id = auth.uid()
        OR (a.org_id IS NOT NULL AND public.is_org_owner(a.org_id))
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'co_admin')
      )
  )
$$;

-- Read rights for one academy: any active member of its workspace, plus the owner.
CREATE OR REPLACE FUNCTION public.can_view_academy(_academy_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.academies a
    WHERE a.id = _academy_id
      AND (
        a.owner_id = auth.uid()
        OR (a.org_id IS NOT NULL AND public.is_workspace_member(a.org_id))
        OR public.has_role(auth.uid(), 'platform_owner')
        OR public.has_role(auth.uid(), 'co_admin')
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_edit_academy(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_view_academy(UUID) FROM anon;

-- Resolve the academy a nested row belongs to, without recursive RLS.
CREATE OR REPLACE FUNCTION public.academy_of_room(_room_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT academy_id FROM public.academy_rooms WHERE id = _room_id
$$;
CREATE OR REPLACE FUNCTION public.academy_of_category(_category_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.academy_id FROM public.academy_categories c
  JOIN public.academy_rooms r ON r.id = c.room_id WHERE c.id = _category_id
$$;
CREATE OR REPLACE FUNCTION public.academy_of_topic(_topic_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.academy_id FROM public.academy_topics t
  JOIN public.academy_categories c ON c.id = t.category_id
  JOIN public.academy_rooms r ON r.id = c.room_id WHERE t.id = _topic_id
$$;
CREATE OR REPLACE FUNCTION public.academy_of_subtopic(_subtopic_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.academy_id FROM public.academy_subtopics s
  JOIN public.academy_topics t ON t.id = s.topic_id
  JOIN public.academy_categories c ON c.id = t.category_id
  JOIN public.academy_rooms r ON r.id = c.room_id WHERE s.id = _subtopic_id
$$;
REVOKE EXECUTE ON FUNCTION public.academy_of_room(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_of_category(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_of_topic(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.academy_of_subtopic(UUID) FROM anon;

ALTER TABLE public.academies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "academies_read" ON public.academies FOR SELECT TO authenticated
  USING (public.can_view_academy(id));
CREATE POLICY "academies_insert" ON public.academies FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (org_id IS NULL OR public.is_workspace_member(org_id))
  );
CREATE POLICY "academies_update" ON public.academies FOR UPDATE TO authenticated
  USING (public.can_edit_academy(id)) WITH CHECK (public.can_edit_academy(id));
CREATE POLICY "academies_delete" ON public.academies FOR DELETE TO authenticated
  USING (public.can_edit_academy(id));

CREATE POLICY "academy_rooms_read" ON public.academy_rooms FOR SELECT TO authenticated
  USING (public.can_view_academy(academy_id) AND (is_visible OR public.can_edit_academy(academy_id)));
CREATE POLICY "academy_rooms_write" ON public.academy_rooms FOR ALL TO authenticated
  USING (public.can_edit_academy(academy_id)) WITH CHECK (public.can_edit_academy(academy_id));

CREATE POLICY "academy_categories_read" ON public.academy_categories FOR SELECT TO authenticated
  USING (
    public.can_view_academy(public.academy_of_room(room_id))
    AND (is_visible OR public.can_edit_academy(public.academy_of_room(room_id)))
  );
CREATE POLICY "academy_categories_write" ON public.academy_categories FOR ALL TO authenticated
  USING (public.can_edit_academy(public.academy_of_room(room_id)))
  WITH CHECK (public.can_edit_academy(public.academy_of_room(room_id)));

CREATE POLICY "academy_topics_read" ON public.academy_topics FOR SELECT TO authenticated
  USING (
    public.can_view_academy(public.academy_of_category(category_id))
    AND (is_visible OR public.can_edit_academy(public.academy_of_category(category_id)))
  );
CREATE POLICY "academy_topics_write" ON public.academy_topics FOR ALL TO authenticated
  USING (public.can_edit_academy(public.academy_of_category(category_id)))
  WITH CHECK (public.can_edit_academy(public.academy_of_category(category_id)));

CREATE POLICY "academy_subtopics_read" ON public.academy_subtopics FOR SELECT TO authenticated
  USING (
    public.can_view_academy(public.academy_of_topic(topic_id))
    AND (is_visible OR public.can_edit_academy(public.academy_of_topic(topic_id)))
  );
CREATE POLICY "academy_subtopics_write" ON public.academy_subtopics FOR ALL TO authenticated
  USING (public.can_edit_academy(public.academy_of_topic(topic_id)))
  WITH CHECK (public.can_edit_academy(public.academy_of_topic(topic_id)));

CREATE POLICY "academy_placements_read" ON public.academy_placements FOR SELECT TO authenticated
  USING (
    public.can_view_academy(public.academy_of_subtopic(subtopic_id))
    AND (is_visible OR public.can_edit_academy(public.academy_of_subtopic(subtopic_id)))
  );
CREATE POLICY "academy_placements_write" ON public.academy_placements FOR ALL TO authenticated
  USING (public.can_edit_academy(public.academy_of_subtopic(subtopic_id)))
  WITH CHECK (public.can_edit_academy(public.academy_of_subtopic(subtopic_id)));

CREATE OR REPLACE FUNCTION public.touch_academy_row()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_academies BEFORE UPDATE ON public.academies
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_academy_rooms BEFORE UPDATE ON public.academy_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_academy_categories BEFORE UPDATE ON public.academy_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_academy_topics BEFORE UPDATE ON public.academy_topics
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_academy_subtopics BEFORE UPDATE ON public.academy_subtopics
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();
CREATE TRIGGER touch_academy_placements BEFORE UPDATE ON public.academy_placements
  FOR EACH ROW EXECUTE FUNCTION public.touch_academy_row();