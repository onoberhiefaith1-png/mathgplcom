-- Timer upgrade: My Best Time + Overall Best Time.
--
-- The student timer layer (assessment_timer_attempts) is unchanged. This adds
-- the guest side of the same benchmark and one aggregate reader that returns
-- ONLY two numbers — never a name, an identity, or a row.

CREATE TABLE IF NOT EXISTS public.guest_question_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.guest_links(id) ON DELETE CASCADE,
  guest_token uuid NOT NULL,
  assessment_id uuid NOT NULL,
  question_id text NOT NULL,
  elapsed_ms bigint NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, guest_token, assessment_id, question_id)
);

GRANT ALL ON public.guest_question_times TO service_role;

ALTER TABLE public.guest_question_times ENABLE ROW LEVEL SECURITY;

-- Written only by the guest endpoint (service role). Read by the link owner.
DROP POLICY IF EXISTS "owner reads guest question times" ON public.guest_question_times;
CREATE POLICY "owner reads guest question times"
ON public.guest_question_times
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.guest_links l
  WHERE l.id = guest_question_times.link_id AND l.owner_id = auth.uid()
));

CREATE INDEX IF NOT EXISTS guest_question_times_question_idx
  ON public.guest_question_times (assessment_id, question_id)
  WHERE success;

CREATE INDEX IF NOT EXISTS assessment_timer_attempts_question_idx
  ON public.assessment_timer_attempts (assessment_id, question_id)
  WHERE success;

-- Two aggregates for one question: the caller's own best, and the best by
-- anyone (registered students AND eligible guests through a public link).
CREATE OR REPLACE FUNCTION public.question_best_times(_assessment_id uuid, _question_id text)
RETURNS TABLE (my_best_ms bigint, overall_best_ms bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT min(a.elapsed_ms)
       FROM public.assessment_timer_attempts a
      WHERE a.assessment_id = _assessment_id
        AND a.question_id = _question_id
        AND a.success
        AND a.student_id = auth.uid()) AS my_best_ms,
    LEAST(
      (SELECT min(a.elapsed_ms)
         FROM public.assessment_timer_attempts a
        WHERE a.assessment_id = _assessment_id
          AND a.question_id = _question_id
          AND a.success),
      (SELECT min(g.elapsed_ms)
         FROM public.guest_question_times g
        WHERE g.assessment_id = _assessment_id
          AND g.question_id = _question_id
          AND g.success)
    ) AS overall_best_ms;
$$;

GRANT EXECUTE ON FUNCTION public.question_best_times(uuid, text) TO authenticated, anon;
