CREATE TABLE public.guest_presence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.guest_links(id) ON DELETE CASCADE,
  guest_token uuid NOT NULL,
  guest_name text,
  assessment_id uuid,
  question_id text,
  score integer NOT NULL DEFAULT 0,
  total_marks integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, guest_token)
);

GRANT SELECT ON public.guest_presence TO authenticated;
GRANT ALL ON public.guest_presence TO service_role;

ALTER TABLE public.guest_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Link owner reads guest presence"
ON public.guest_presence
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.guest_links l
  WHERE l.id = guest_presence.link_id AND l.owner_id = auth.uid()
));

CREATE INDEX guest_presence_link_seen_idx ON public.guest_presence (link_id, last_seen_at DESC);