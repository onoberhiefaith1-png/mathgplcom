ALTER TABLE public.game_time_bars
  ADD COLUMN IF NOT EXISTS default_duration_seconds integer NOT NULL DEFAULT 600;

UPDATE public.game_time_bars SET default_duration_seconds = duration_seconds;