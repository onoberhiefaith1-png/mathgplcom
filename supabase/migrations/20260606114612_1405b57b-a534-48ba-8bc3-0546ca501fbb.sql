
-- classes table
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_code text NOT NULL,
  join_code text NOT NULL UNIQUE,
  name text NOT NULL,
  school text,
  description text,
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select their classes" ON public.classes
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners can insert their classes" ON public.classes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their classes" ON public.classes
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their classes" ON public.classes
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER classes_touch_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- class_join_requests table
CREATE TABLE public.class_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_join_requests TO authenticated;
GRANT ALL ON public.class_join_requests TO service_role;

ALTER TABLE public.class_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters can insert own requests" ON public.class_join_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Requesters can view own requests" ON public.class_join_requests
  FOR SELECT TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "Class owners can view requests" ON public.class_join_requests
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_id AND c.owner_id = auth.uid())
  );

-- secure lookup
CREATE OR REPLACE FUNCTION public.lookup_class_by_code(code text)
RETURNS TABLE (id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name FROM public.classes c WHERE c.join_code = upper(code) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_class_by_code(text) TO authenticated;
