-- 1. Feature catalogue
CREATE TABLE public.feature_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  category text NOT NULL,
  applies_to text[] NOT NULL DEFAULT ARRAY['teacher','school','parent']::text[],
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_entitlements TO anon;
GRANT SELECT ON public.feature_entitlements TO authenticated;
GRANT ALL ON public.feature_entitlements TO service_role;
ALTER TABLE public.feature_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feature catalogue is public" ON public.feature_entitlements FOR SELECT USING (true);
CREATE POLICY "Platform owners write feature catalogue" ON public.feature_entitlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE TRIGGER feature_entitlements_touch BEFORE UPDATE ON public.feature_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Which features a plan turns on
CREATE TABLE public.plan_entitlements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.feature_entitlements(key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_key)
);
CREATE INDEX plan_entitlements_plan_idx ON public.plan_entitlements (plan_id);
GRANT SELECT ON public.plan_entitlements TO anon;
GRANT SELECT ON public.plan_entitlements TO authenticated;
GRANT ALL ON public.plan_entitlements TO service_role;
ALTER TABLE public.plan_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan entitlements are public" ON public.plan_entitlements FOR SELECT USING (true);
CREATE POLICY "Platform owners write plan entitlements" ON public.plan_entitlements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE TRIGGER plan_entitlements_touch BEFORE UPDATE ON public.plan_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Numeric caps per plan
CREATE TABLE public.plan_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  limit_key text NOT NULL,
  limit_value integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, limit_key)
);
GRANT SELECT ON public.plan_limits TO anon;
GRANT SELECT ON public.plan_limits TO authenticated;
GRANT ALL ON public.plan_limits TO service_role;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan limits are public" ON public.plan_limits FOR SELECT USING (true);
CREATE POLICY "Platform owners write plan limits" ON public.plan_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_owner') OR public.has_role(auth.uid(), 'co_admin'));
CREATE TRIGGER plan_limits_touch BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Catalogue seed
INSERT INTO public.feature_entitlements (key, label, category, applies_to, sort_order) VALUES
  ('personal_workspace','Personal Workspace','teaching',ARRAY['teacher','parent']::text[],10),
  ('community','Community','teaching',ARRAY['teacher','school','parent']::text[],20),
  ('community_lesson_notes','Community Lesson Notes','teaching',ARRAY['teacher','school']::text[],30),
  ('create_lesson_notes','Create Lesson Notes','teaching',ARRAY['teacher','school']::text[],40),
  ('smartboard','SmartBoard','teaching',ARRAY['teacher','school']::text[],50),
  ('classes','Classes','teaching',ARRAY['teacher','school']::text[],60),
  ('students','Students','teaching',ARRAY['teacher','school']::text[],70),
  ('assignments','Assignments','teaching',ARRAY['teacher','school','parent']::text[],80),
  ('adventure','Adventure','teaching',ARRAY['teacher','school','parent']::text[],90),
  ('skill_builder','Skill Builder','teaching',ARRAY['teacher','school']::text[],100),
  ('assessment','Assessment','assessment',ARRAY['teacher','school']::text[],110),
  ('advanced_assessment','Advanced Assessment','assessment',ARRAY['teacher','school']::text[],120),
  ('progress_tracking','Progress Tracking','assessment',ARRAY['teacher','school','parent']::text[],130),
  ('reports','Reports','assessment',ARRAY['teacher','school','parent']::text[],140),
  ('realtime_sessions','Real-Time Sessions','assessment',ARRAY['teacher','school']::text[],150),
  ('mathgpl_live','MathGPL Live','assessment',ARRAY['teacher','school']::text[],160),
  ('ai_generation','AI Generation','ai_usage',ARRAY['teacher','school']::text[],170),
  ('credits','Credits','ai_usage',ARRAY['teacher','school','parent']::text[],180),
  ('add_credits','Add Credits','ai_usage',ARRAY['teacher','school','parent']::text[],190),
  ('credit_activity','Credit Activity','ai_usage',ARRAY['teacher','school','parent']::text[],200),
  ('cloud_storage','Cloud Storage','ai_usage',ARRAY['teacher','school']::text[],210),
  ('export','Export','ai_usage',ARRAY['teacher','school']::text[],220),
  ('connect_schools','Connect to Schools','connections',ARRAY['teacher','parent']::text[],230),
  ('connect_teachers','Connect to Teachers','connections',ARRAY['school','parent']::text[],240),
  ('connect_parents','Connect to Parents','connections',ARRAY['teacher','school']::text[],250),
  ('school_workspace','School Workspace','school_admin',ARRAY['school']::text[],260),
  ('multiple_teachers','Multiple Teachers','school_admin',ARRAY['school']::text[],270),
  ('school_student_management','School-wide Student Management','school_admin',ARRAY['school']::text[],280),
  ('school_administration','School Administration','school_admin',ARRAY['school']::text[],290),
  ('school_progress_dashboard','School-wide Progress Dashboard','school_admin',ARRAY['school']::text[],300),
  ('school_assessment_dashboard','School-wide Assessment Dashboard','school_admin',ARRAY['school']::text[],310),
  ('centralised_credits','Centralised Credits','school_admin',ARRAY['school']::text[],320);

-- 5. Plan configurations
INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p
JOIN public.feature_entitlements f ON f.key = ANY (ARRAY[
  'personal_workspace','community','community_lesson_notes','smartboard','classes','students',
  'connect_schools','connect_parents'])
WHERE p.key = 'teacher_free'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p
JOIN public.feature_entitlements f ON f.key = ANY (ARRAY[
  'personal_workspace','community','community_lesson_notes','create_lesson_notes','smartboard','classes',
  'students','assignments','adventure','skill_builder','assessment','advanced_assessment',
  'progress_tracking','reports','realtime_sessions','mathgpl_live','ai_generation','credits',
  'add_credits','credit_activity','cloud_storage','export','connect_schools','connect_parents'])
WHERE p.key IN ('teacher_pro','teacher_super_pro')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p
JOIN public.feature_entitlements f ON f.key = ANY (ARRAY[
  'school_workspace','multiple_teachers','school_student_management','school_administration',
  'school_progress_dashboard','school_assessment_dashboard','centralised_credits',
  'community','community_lesson_notes','create_lesson_notes','smartboard','classes','students',
  'assignments','adventure','skill_builder','assessment','advanced_assessment','progress_tracking',
  'reports','realtime_sessions','mathgpl_live','ai_generation','credits','add_credits',
  'credit_activity','cloud_storage','export','connect_teachers','connect_parents'])
WHERE p.key IN ('school_pro','school_super_pro')
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p
JOIN public.feature_entitlements f ON f.key = ANY (ARRAY[
  'personal_workspace','community','connect_schools','assignments','adventure','progress_tracking','reports'])
WHERE p.key = 'parent_free'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_entitlements (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p
JOIN public.feature_entitlements f ON f.key = ANY (ARRAY[
  'personal_workspace','community','connect_schools','connect_teachers','assignments','adventure',
  'progress_tracking','reports','credits','add_credits','credit_activity'])
WHERE p.key = 'parent_pro'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
SELECT p.id, l.k, l.v FROM public.plans p
CROSS JOIN (VALUES ('max_classes', 1), ('max_students', 5)) AS l(k, v)
WHERE p.key = 'teacher_free'
ON CONFLICT DO NOTHING;

INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
SELECT p.id, l.k, NULL::integer FROM public.plans p
CROSS JOIN (VALUES ('max_classes'), ('max_students')) AS l(k)
WHERE p.key IN ('teacher_pro','teacher_super_pro','school_pro','school_super_pro')
ON CONFLICT DO NOTHING;

-- 6. Which plan audience an account belongs to
CREATE OR REPLACE FUNCTION public.account_audience(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'school') THEN 'school'
    WHEN public.has_role(_user_id, 'teacher') THEN 'teacher'
    WHEN public.has_role(_user_id, 'parent') THEN 'parent'
    ELSE NULL
  END
$$;

-- 7. The plan an account is currently on: its subscription, else the free plan
CREATE OR REPLACE FUNCTION public.account_plan_id(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _plan uuid;
  _aud text := public.account_audience(_user_id);
BEGIN
  SELECT s.plan_id INTO _plan
  FROM public.subscriptions s
  WHERE s.user_id = _user_id
    AND s.status IN ('active','trialing','past_due','expired')
    AND s.plan_id IS NOT NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF _plan IS NOT NULL THEN
    RETURN _plan;
  END IF;

  IF _aud IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id INTO _plan
  FROM public.plans p
  WHERE p.audience = _aud AND p.active AND p.is_free
  ORDER BY p.sort_order
  LIMIT 1;

  RETURN _plan;
END;
$$;

-- 8. Effective entitlements: own plan plus anything provided by a connection
CREATE OR REPLACE FUNCTION public.effective_entitlements(_user_id uuid)
RETURNS TABLE (feature_key text, source text, payer_user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH aud AS (SELECT public.account_audience(_user_id) AS audience),
  own_plan AS (SELECT public.account_plan_id(_user_id) AS plan_id),
  -- No catalogue configured for this audience: stay permissive.
  configured AS (
    SELECT EXISTS (
      SELECT 1 FROM public.plan_entitlements pe
      JOIN public.plans p ON p.id = pe.plan_id
      WHERE p.audience = (SELECT audience FROM aud)
    ) AS ok
  ),
  own AS (
    SELECT pe.feature_key, 'own_plan'::text AS source, _user_id AS payer_user_id
    FROM public.plan_entitlements pe
    WHERE pe.plan_id = (SELECT plan_id FROM own_plan)
      AND (SELECT ok FROM configured)
    UNION ALL
    SELECT f.key, 'unconfigured'::text, _user_id
    FROM public.feature_entitlements f
    WHERE NOT (SELECT ok FROM configured)
      AND (SELECT audience FROM aud) IS NOT NULL
      AND (SELECT audience FROM aud) = ANY (f.applies_to)
  ),
  -- Features a connected school or teacher provides, capped to what the
  -- connected account itself holds through its own plan.
  provided AS (
    SELECT pe.feature_key,
           CASE WHEN c.relation IN ('school_teacher','parent_school') THEN 'via_school' ELSE 'via_teacher' END AS source,
           other.other_id AS payer_user_id
    FROM public.connections c
    CROSS JOIN LATERAL (
      SELECT CASE WHEN c.from_user_id = _user_id THEN c.to_user_id ELSE c.from_user_id END AS other_id
    ) other
    JOIN public.plan_entitlements pe ON pe.plan_id = public.account_plan_id(other.other_id)
    WHERE c.status = 'accepted'
      AND (c.from_user_id = _user_id OR c.to_user_id = _user_id)
      AND c.relation IN ('school_teacher','parent_school','parent_teacher')
      AND (SELECT ok FROM configured)
      AND (
        -- a teacher inside a paying school inherits the school's teaching features
        (c.relation = 'school_teacher' AND (SELECT audience FROM aud) = 'teacher')
        -- a parent sees only student-facing information through the relationship
        OR (c.relation IN ('parent_school','parent_teacher')
            AND (SELECT audience FROM aud) = 'parent'
            AND pe.feature_key IN ('assignments','adventure','progress_tracking','reports'))
      )
  )
  SELECT DISTINCT ON (e.feature_key) e.feature_key, e.source, e.payer_user_id
  FROM (SELECT * FROM own UNION ALL SELECT * FROM provided) e
  JOIN public.feature_entitlements f ON f.key = e.feature_key
  WHERE (SELECT audience FROM aud) IS NULL
     OR (SELECT audience FROM aud) = ANY (f.applies_to)
  ORDER BY e.feature_key, (e.source = 'own_plan') DESC;
$$;

-- 9. Single checks
CREATE OR REPLACE FUNCTION public.has_entitlement(_user_id uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'platform_owner')
      OR public.has_role(_user_id, 'co_admin')
      OR public.has_role(_user_id, 'student')
      OR EXISTS (SELECT 1 FROM public.effective_entitlements(_user_id) e WHERE e.feature_key = _feature)
$$;

CREATE OR REPLACE FUNCTION public.effective_limit(_user_id uuid, _limit text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pl.limit_value
  FROM public.plan_limits pl
  WHERE pl.plan_id = public.account_plan_id(_user_id)
    AND pl.limit_key = _limit
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.effective_entitlements(uuid) FROM public;
REVOKE ALL ON FUNCTION public.has_entitlement(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.effective_limit(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.account_plan_id(uuid) FROM public;
REVOKE ALL ON FUNCTION public.account_audience(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.effective_entitlements(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_entitlement(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_limit(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_plan_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.account_audience(uuid) TO authenticated, service_role;