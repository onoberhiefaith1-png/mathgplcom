CREATE TABLE public.notebook_slides (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks(id) on delete cascade,
  name text not null default 'Slide',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX notebook_slides_notebook_idx ON public.notebook_slides(notebook_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_slides TO authenticated;
GRANT ALL ON public.notebook_slides TO service_role;
ALTER TABLE public.notebook_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all notebook slides" ON public.notebook_slides FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_slides.notebook_id AND n.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_slides.notebook_id AND n.owner_id = auth.uid()));
CREATE POLICY "members read shared notebook slides" ON public.notebook_slides FOR SELECT TO authenticated
USING (private.notebook_shared_to_member(notebook_id));
CREATE POLICY "school reads notebook slides in its workspace" ON public.notebook_slides FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = notebook_slides.notebook_id AND n.org_id IS NOT NULL AND is_org_owner(n.org_id) AND n.owner_id <> auth.uid()));

CREATE TABLE public.notebook_slide_items (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.notebook_slides(id) on delete cascade,
  kind text not null check (kind in ('screenshot','image','video')),
  storage_path text not null,
  x real not null default 0.1,
  y real not null default 0.1,
  w real not null default 0.4,
  h real not null default 0.3,
  z integer not null default 0,
  step integer not null default 1,
  created_at timestamptz not null default now()
);
CREATE INDEX notebook_slide_items_slide_idx ON public.notebook_slide_items(slide_id, step, z);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_slide_items TO authenticated;
GRANT ALL ON public.notebook_slide_items TO service_role;
ALTER TABLE public.notebook_slide_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all notebook slide items" ON public.notebook_slide_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebook_slides s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_slide_items.slide_id AND n.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.notebook_slides s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_slide_items.slide_id AND n.owner_id = auth.uid()));
CREATE POLICY "members read shared notebook slide items" ON public.notebook_slide_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebook_slides s WHERE s.id = notebook_slide_items.slide_id AND private.notebook_shared_to_member(s.notebook_id)));
CREATE POLICY "school reads notebook slide items" ON public.notebook_slide_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.notebook_slides s JOIN public.notebooks n ON n.id = s.notebook_id WHERE s.id = notebook_slide_items.slide_id AND n.org_id IS NOT NULL AND is_org_owner(n.org_id) AND n.owner_id <> auth.uid()));