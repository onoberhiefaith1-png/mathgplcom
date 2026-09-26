CREATE TABLE public.flow_library_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  background_path text, background_type text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.flow_library_settings TO authenticated;
GRANT ALL ON public.flow_library_settings TO service_role;
ALTER TABLE public.flow_library_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flow lib read" ON public.flow_library_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "flow lib insert" ON public.flow_library_settings FOR INSERT TO authenticated WITH CHECK (public.is_flow_admin(auth.uid()));
CREATE POLICY "flow lib update" ON public.flow_library_settings FOR UPDATE TO authenticated USING (public.is_flow_admin(auth.uid()));