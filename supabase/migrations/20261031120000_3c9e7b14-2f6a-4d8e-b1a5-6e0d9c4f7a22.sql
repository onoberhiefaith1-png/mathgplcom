-- Academia next edition §1: three video slots per Session, one per tier.
-- Beginner keeps the original video_url column, so every existing Session
-- video becomes its Beginner video. Intermediate and Expert start empty; an
-- empty slot shows that tier's empty state (no fallback to another tier).
-- Session-level columns: the activity tier lock / reorder-within-tier rules
-- from 0022 are untouched.
-- Idempotent: safe to apply after the matching supabase/migrations file.
ALTER TABLE public.academia_sessions ADD COLUMN IF NOT EXISTS intermediate_video_url text;
ALTER TABLE public.academia_sessions ADD COLUMN IF NOT EXISTS expert_video_url text;
COMMENT ON COLUMN public.academia_sessions.video_url IS 'Beginner tier video (original single slot).';
COMMENT ON COLUMN public.academia_sessions.intermediate_video_url IS 'Intermediate tier video. NULL = empty state, never falls back.';
COMMENT ON COLUMN public.academia_sessions.expert_video_url IS 'Expert tier video. NULL = empty state, never falls back.';
