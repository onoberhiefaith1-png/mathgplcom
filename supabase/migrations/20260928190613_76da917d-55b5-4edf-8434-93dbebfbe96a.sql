ALTER TABLE public.academia_activities
  ADD COLUMN IF NOT EXISTS assessment_id uuid,
  ADD COLUMN IF NOT EXISTS game_id uuid,
  ADD COLUMN IF NOT EXISTS class_id uuid,
  ADD COLUMN IF NOT EXISTS question_key text;

CREATE OR REPLACE FUNCTION public.enforce_class_student_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid; _cap integer; _count integer; _ws text;
BEGIN
  SELECT owner_id, workspace INTO _owner, _ws FROM public.classes WHERE id = NEW.class_id;
  IF _owner IS NULL OR _ws = 'academia' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _owner AND role IN ('platform_owner', 'co_admin')) THEN
    RETURN NEW;
  END IF;
  _cap := public.effective_limit(_owner, 'max_students');
  IF _cap IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _count FROM public.class_members WHERE class_id = NEW.class_id;
  IF _count >= _cap THEN
    RAISE EXCEPTION 'plan_limit_reached: this class is full on the current plan (% students). Upgrade the plan to add more.', _cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.class_member_enrols_workspace()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_ws text;
BEGIN
  SELECT org_id, workspace INTO v_org, v_ws FROM public.classes WHERE id = NEW.class_id;
  IF v_org IS NOT NULL AND v_ws IS DISTINCT FROM 'academia' THEN
    INSERT INTO public.account_memberships (user_id, org_id, role, status)
    VALUES (NEW.user_id, v_org, 'student', 'active')
    ON CONFLICT (user_id, org_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.academia_enter_activity(_activity uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; v_ws text; v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;
  SELECT * INTO a FROM public.academia_activities WHERE id = _activity;
  IF a.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  IF NOT public.academia_can_view_org(public.academia_org_of_session(a.session_id)) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;
  IF a.class_id IS NULL THEN
    RETURN jsonb_build_object('ready', false);
  END IF;
  SELECT workspace, owner_id INTO v_ws, v_owner FROM public.classes WHERE id = a.class_id;
  IF v_ws IS DISTINCT FROM 'academia' THEN RETURN jsonb_build_object('ready', false); END IF;
  IF v_owner <> auth.uid() THEN
    INSERT INTO public.class_members (class_id, user_id) VALUES (a.class_id, auth.uid())
    ON CONFLICT (class_id, user_id) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ready', true, 'class_id', a.class_id, 'assessment_id', a.assessment_id,
    'game_id', a.game_id, 'question_key', a.question_key, 'session_id', a.session_id, 'title', a.title);
END $function$;

REVOKE ALL ON FUNCTION public.academia_enter_activity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.academia_enter_activity(uuid) TO authenticated;