CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'platform_owner') OR public.has_role(_user_id, 'co_admin')
$$;

CREATE TABLE public.assistant_training_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','assistant')),
  body text NOT NULL,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assistant_training_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  kind text NOT NULL,
  source_id uuid,
  title text NOT NULL,
  verdict text NOT NULL DEFAULT 'correct' CHECK (verdict IN ('correct','incorrect','partial')),
  explanation text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot jsonb,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assistant_training_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL,
  title text NOT NULL,
  example_ids uuid[] NOT NULL DEFAULT '{}',
  body text NOT NULL DEFAULT '',
  corrections text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','corrected','approved')),
  usage jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assistant_guidance_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL,
  mandatory text NOT NULL DEFAULT '',
  recommended text NOT NULL DEFAULT '',
  techniques text NOT NULL DEFAULT '',
  change_note text NOT NULL DEFAULT '',
  report_id uuid,
  example_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  created_by uuid NOT NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_training_messages, public.assistant_training_examples, public.assistant_training_reports, public.assistant_guidance_versions TO authenticated;
GRANT ALL ON public.assistant_training_messages, public.assistant_training_examples, public.assistant_training_reports, public.assistant_guidance_versions TO service_role;

ALTER TABLE public.assistant_training_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_training_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_guidance_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage training messages" ON public.assistant_training_messages FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "admins manage training examples" ON public.assistant_training_examples FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "admins manage training reports" ON public.assistant_training_reports FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));
CREATE POLICY "admins manage guidance versions" ON public.assistant_guidance_versions FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.approved_assistant_guidance()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'version', g.version, 'approvedAt', g.approved_at,
    'mandatory', g.mandatory, 'recommended', g.recommended, 'techniques', g.techniques,
    'examples', COALESCE((SELECT jsonb_agg(jsonb_build_object('title', e.title, 'kind', e.kind, 'verdict', e.verdict, 'explanation', e.explanation, 'snapshot', e.snapshot))
       FROM public.assistant_training_examples e WHERE e.approved AND e.id = ANY(g.example_ids)), '[]'::jsonb))
  FROM public.assistant_guidance_versions g WHERE g.status = 'approved' ORDER BY g.version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.approved_assistant_guidance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approved_assistant_guidance() TO authenticated;

CREATE POLICY "admins read training files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'assistant-training' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "admins add training files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assistant-training' AND public.is_platform_admin(auth.uid()));
CREATE POLICY "admins remove training files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'assistant-training' AND public.is_platform_admin(auth.uid()));