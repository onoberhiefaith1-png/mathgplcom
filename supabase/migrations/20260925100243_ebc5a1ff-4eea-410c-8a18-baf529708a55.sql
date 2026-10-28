CREATE TABLE public.flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Flow',
  scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('mathgpl','personal')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  cover_path text, cover_type text,
  clips jsonb NOT NULL DEFAULT '[]', scenes jsonb NOT NULL DEFAULT '[]',
  trail jsonb NOT NULL DEFAULT '{}', position jsonb NOT NULL DEFAULT '{}',
  source_flow_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flows TO authenticated;
GRANT ALL ON public.flows TO service_role;
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.is_flow_admin(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('platform_owner','co_admin'))
$$;
CREATE POLICY "flows read" ON public.flows FOR SELECT TO authenticated USING (owner_id = auth.uid() OR (scope = 'mathgpl' AND (status = 'published' OR public.is_flow_admin(auth.uid()))));
CREATE POLICY "flows insert" ON public.flows FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND (scope = 'personal' OR public.is_flow_admin(auth.uid())));
CREATE POLICY "flows update" ON public.flows FOR UPDATE TO authenticated USING ((scope = 'personal' AND owner_id = auth.uid()) OR (scope = 'mathgpl' AND public.is_flow_admin(auth.uid())));
CREATE POLICY "flows delete" ON public.flows FOR DELETE TO authenticated USING ((scope = 'personal' AND owner_id = auth.uid()) OR (scope = 'mathgpl' AND public.is_flow_admin(auth.uid())));
CREATE OR REPLACE FUNCTION public.flows_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER flows_touch BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION public.flows_touch();
ALTER TABLE public.notebooks ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES public.flows(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS flow_enabled boolean NOT NULL DEFAULT false;
CREATE POLICY "flow videos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'flow-videos');
CREATE POLICY "flow videos upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'flow-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "flow videos update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'flow-videos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "flow videos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'flow-videos' AND (storage.foldername(name))[1] = auth.uid()::text);