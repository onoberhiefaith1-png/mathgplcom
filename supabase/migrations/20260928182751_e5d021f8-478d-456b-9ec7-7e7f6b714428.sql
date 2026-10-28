ALTER TABLE public.academia_activities ADD COLUMN IF NOT EXISTS game_link_code text;
ALTER TABLE public.assessments ALTER COLUMN timer_enabled SET DEFAULT true;