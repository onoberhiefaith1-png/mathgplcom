CREATE TABLE public.guest_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('course','assignment')),
  resource_id uuid NOT NULL,
  class_id uuid,
  code text NOT NULL UNIQUE,
  title text,
  enabled boolean NOT NULL DEFAULT true,
  ask_name boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, resource_id, class_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_links TO authenticated;
GRANT ALL ON public.guest_links TO service_role;
ALTER TABLE public.guest_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages guest links" ON public.guest_links
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.guest_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.guest_links(id) ON DELETE CASCADE,
  guest_token uuid NOT NULL,
  guest_name text,
  assessment_id uuid NOT NULL,
  block_id uuid,
  solved_lines jsonb NOT NULL DEFAULT '{}'::jsonb,
  score numeric NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, guest_token, assessment_id)
);

CREATE INDEX guest_attempts_link_idx ON public.guest_attempts (link_id, updated_at DESC);

GRANT SELECT ON public.guest_attempts TO authenticated;
GRANT ALL ON public.guest_attempts TO service_role;
ALTER TABLE public.guest_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads guest attempts" ON public.guest_attempts
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.guest_links l WHERE l.id = guest_attempts.link_id AND l.owner_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.guest_links_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER guest_links_touch BEFORE UPDATE ON public.guest_links
  FOR EACH ROW EXECUTE FUNCTION public.guest_links_touch();
CREATE TRIGGER guest_attempts_touch BEFORE UPDATE ON public.guest_attempts
  FOR EACH ROW EXECUTE FUNCTION public.guest_links_touch();

-- Security: anonymous visitors must only read sanitized live_public_* results.
DROP POLICY IF EXISTS "Audience reads open notebooks" ON public.notebooks;
DROP POLICY IF EXISTS "Audience reads open notebook sections" ON public.notebook_sections;
DROP POLICY IF EXISTS "Audience reads open notebook subsections" ON public.notebook_subsections;
DROP POLICY IF EXISTS "Audience reads open notebook blocks" ON public.notebook_blocks;