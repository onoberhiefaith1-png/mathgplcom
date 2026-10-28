ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS workspace text NOT NULL DEFAULT 'classroom';

ALTER TABLE public.smart_cards ADD COLUMN IF NOT EXISTS publish_mode text NOT NULL DEFAULT 'challenge';
ALTER TABLE public.smart_cards ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.smart_cards ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE public.smart_cards ADD COLUMN IF NOT EXISTS difficulty text;

ALTER TABLE public.smart_card_attempts ADD COLUMN IF NOT EXISTS is_preview boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.smart_card_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.smart_cards(id) ON DELETE CASCADE,
  participant_key text NOT NULL,
  display_name text,
  state text NOT NULL DEFAULT 'visitor',
  is_preview boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, participant_key)
);

GRANT ALL ON public.smart_card_presence TO service_role;
ALTER TABLE public.smart_card_presence ENABLE ROW LEVEL SECURITY;

UPDATE public.classes c SET workspace = 'live'
WHERE workspace = 'classroom'
  AND (EXISTS (SELECT 1 FROM public.sessions s WHERE s.class_id = c.id)
    OR EXISTS (SELECT 1 FROM public.smart_cards sc WHERE sc.class_id = c.id));