
CREATE TABLE public.floating_assistant_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  notebook_id uuid,
  subsection_id uuid,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_assistant_threads TO authenticated;
GRANT ALL ON public.floating_assistant_threads TO service_role;
ALTER TABLE public.floating_assistant_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages threads" ON public.floating_assistant_threads
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.floating_assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.floating_assistant_threads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  role text NOT NULL,
  content jsonb NOT NULL,
  tool_name text,
  tool_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX floating_assistant_messages_thread_idx ON public.floating_assistant_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_assistant_messages TO authenticated;
GRANT ALL ON public.floating_assistant_messages TO service_role;
ALTER TABLE public.floating_assistant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages messages" ON public.floating_assistant_messages
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.floating_chip_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  subsection_id uuid NOT NULL,
  line_id text NOT NULL,
  chips jsonb NOT NULL,
  scaffolds jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX floating_chip_snapshots_line_idx ON public.floating_chip_snapshots(subsection_id, line_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_chip_snapshots TO authenticated;
GRANT ALL ON public.floating_chip_snapshots TO service_role;
ALTER TABLE public.floating_chip_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages snapshots" ON public.floating_chip_snapshots
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.floating_knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  kind text NOT NULL,
  filename text NOT NULL,
  storage_path text,
  parsed_text text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.floating_knowledge_documents TO authenticated;
GRANT ALL ON public.floating_knowledge_documents TO service_role;
ALTER TABLE public.floating_knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages knowledge" ON public.floating_knowledge_documents
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.floating_law_library
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exceptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;
