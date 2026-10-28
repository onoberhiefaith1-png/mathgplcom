ALTER TABLE public.academia ADD COLUMN IF NOT EXISTS cover_path text, ADD COLUMN IF NOT EXISTS presentation_path text, ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.academia_sessions ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS thumbnail_path text;
ALTER TABLE public.academia_activities ADD COLUMN IF NOT EXISTS thumbnail_path text;

CREATE OR REPLACE FUNCTION public.academia_can_build_subject(_subject uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT (is_workspace_member(academia_org_of_subject(_subject))
    AND EXISTS (SELECT 1 FROM academia_subject_teachers WHERE subject_id=_subject AND teacher_id=auth.uid()))
  OR EXISTS (SELECT 1 FROM organizations o WHERE o.id=academia_org_of_subject(_subject)
             AND o.kind <> 'school' AND o.owner_user_id=auth.uid()) $$;

CREATE TABLE public.academia_session_positions (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  session_id uuid NOT NULL REFERENCES public.academia_sessions(id) ON DELETE CASCADE,
  activity_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academia_session_positions TO authenticated;
GRANT ALL ON public.academia_session_positions TO service_role;
ALTER TABLE public.academia_session_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own positions" ON public.academia_session_positions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Storage paths: <academia_id>/...
CREATE OR REPLACE FUNCTION public.academia_media_can_view(_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM academia a WHERE a.id::text = split_part(_path,'/',1) AND academia_can_view_org(a.org_id)) $$;
CREATE OR REPLACE FUNCTION public.academia_media_can_write(_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM academia a WHERE a.id::text = split_part(_path,'/',1)
    AND (is_org_owner(a.org_id) OR is_workspace_member(a.org_id))) $$;
REVOKE EXECUTE ON FUNCTION public.academia_media_can_view(text), public.academia_media_can_write(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.academia_media_can_view(text), public.academia_media_can_write(text) TO authenticated;

CREATE POLICY "academia media read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='academia-media' AND public.academia_media_can_view(name));
CREATE POLICY "academia media write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='academia-media' AND public.academia_media_can_write(name));
CREATE POLICY "academia media update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='academia-media' AND public.academia_media_can_write(name));