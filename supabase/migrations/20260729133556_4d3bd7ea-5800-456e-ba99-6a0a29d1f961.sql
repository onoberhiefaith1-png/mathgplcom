CREATE TABLE public.smart_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  notebook_id uuid,
  section_id uuid,
  subsection_id uuid,
  class_id uuid,
  assessment_id uuid,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Smart Card',
  presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
  geometry jsonb,
  total_marks integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_cards TO authenticated;
GRANT SELECT ON public.smart_cards TO anon;
GRANT ALL ON public.smart_cards TO service_role;

ALTER TABLE public.smart_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their smart cards"
  ON public.smart_cards FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Published smart cards are public"
  ON public.smart_cards FOR SELECT TO anon, authenticated
  USING (published = true);

CREATE TRIGGER smart_cards_touch_updated_at
  BEFORE UPDATE ON public.smart_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.smart_card_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.smart_cards(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  participant_key text NOT NULL,
  user_id uuid,
  percent numeric NOT NULL DEFAULT 0,
  duration_ms bigint NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX smart_card_attempts_card_idx ON public.smart_card_attempts (card_id, duration_ms);

GRANT SELECT ON public.smart_card_attempts TO anon, authenticated;
GRANT ALL ON public.smart_card_attempts TO service_role;

ALTER TABLE public.smart_card_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attempts on published cards are public"
  ON public.smart_card_attempts FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.smart_cards c
    WHERE c.id = card_id AND c.published = true
  ));