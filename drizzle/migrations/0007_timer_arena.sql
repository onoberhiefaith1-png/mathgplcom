CREATE TABLE public.arena_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  display_code text NOT NULL UNIQUE,
  owner_id uuid NOT NULL,
  source_kind text NOT NULL DEFAULT 'academia_session' CHECK (source_kind IN ('academia_session','assignment')),
  source_id uuid NOT NULL,
  guest_code text NOT NULL,
  title text NOT NULL DEFAULT 'Timer Arena',
  entry_config jsonb NOT NULL DEFAULT '{"name":"optional","photo":"optional"}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX arena_shares_owner_source ON public.arena_shares(owner_id, source_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arena_shares TO authenticated;
GRANT ALL ON public.arena_shares TO service_role;
ALTER TABLE public.arena_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena owner manages shares" ON public.arena_shares FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.arena_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.arena_shares(id) ON DELETE CASCADE,
  device_token uuid NOT NULL,
  display_name text,
  anon_label text NOT NULL,
  avatar_key text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (share_id, device_token),
  UNIQUE (share_id, anon_label)
);
GRANT SELECT ON public.arena_participants TO authenticated;
GRANT ALL ON public.arena_participants TO service_role;
ALTER TABLE public.arena_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena owner reads participants" ON public.arena_participants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_shares s WHERE s.id = share_id AND s.owner_id = auth.uid()));

CREATE TABLE public.arena_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.arena_shares(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.arena_participants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  question_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  elapsed_ms bigint,
  success boolean NOT NULL DEFAULT false
);
CREATE INDEX arena_attempts_open ON public.arena_attempts(participant_id, assessment_id, question_id) WHERE completed_at IS NULL;
GRANT SELECT ON public.arena_attempts TO authenticated;
GRANT ALL ON public.arena_attempts TO service_role;
ALTER TABLE public.arena_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena owner reads attempts" ON public.arena_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_shares s WHERE s.id = share_id AND s.owner_id = auth.uid()));

CREATE TABLE public.arena_bests (
  share_id uuid NOT NULL REFERENCES public.arena_shares(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.arena_participants(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  question_id text NOT NULL,
  best_ms bigint NOT NULL,
  achieved_at timestamptz NOT NULL,
  attempt_id uuid NOT NULL,
  PRIMARY KEY (share_id, participant_id, assessment_id, question_id)
);
CREATE INDEX arena_bests_rank ON public.arena_bests(share_id, assessment_id, question_id, best_ms, achieved_at, attempt_id);
GRANT SELECT ON public.arena_bests TO authenticated;
GRANT ALL ON public.arena_bests TO service_role;
ALTER TABLE public.arena_bests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arena owner reads bests" ON public.arena_bests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.arena_shares s WHERE s.id = share_id AND s.owner_id = auth.uid()));