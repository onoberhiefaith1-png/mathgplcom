-- Mirror of supabase/migrations/20261105210000_classroom_audio_mute_and_claims.sql

CREATE OR REPLACE FUNCTION public.classroom_audio_command(
  _class_id uuid, _command text, _student_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  actor uuid := auth.uid();
  teacher boolean := public.is_class_owner(_class_id);
  floor public.classroom_audio_floor;
  can_moderate boolean;
  current_time_utc timestamptz;
BEGIN
  IF actor IS NULL OR NOT (coalesce(teacher, false) OR coalesce(public.is_class_member(_class_id), false)) THEN
    RAISE EXCEPTION 'Classroom access required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.classroom_audio_floor (class_id) VALUES (_class_id)
    ON CONFLICT (class_id) DO NOTHING;
  SELECT * INTO STRICT floor FROM public.classroom_audio_floor
    WHERE class_id = _class_id FOR UPDATE;
  current_time_utc := clock_timestamp();
  can_moderate := teacher OR coalesce(floor.moderator_id = actor, false);
  IF floor.lease_until <= current_time_utc THEN
    floor.speaker_id := NULL;
    floor.lease_until := NULL;
  END IF;

  CASE _command
    WHEN 'status' THEN NULL;
    WHEN 'request' THEN
      IF NOT teacher AND NOT floor.students_muted AND floor.speaker_id IS NULL THEN
        floor.speaker_id := actor;
        floor.lease_until := current_time_utc + interval '30 seconds';
      END IF;
    WHEN 'renew' THEN
      IF floor.speaker_id = actor THEN
        floor.lease_until := current_time_utc + interval '30 seconds';
      END IF;
    WHEN 'release' THEN
      IF can_moderate OR floor.speaker_id = actor THEN
        floor.speaker_id := NULL;
        floor.lease_until := NULL;
      END IF;
    WHEN 'mute' THEN
      IF NOT can_moderate THEN RAISE EXCEPTION 'Moderator required' USING ERRCODE = '42501'; END IF;
      IF _student_id IS NULL THEN RAISE EXCEPTION 'Student is required' USING ERRCODE = '22023'; END IF;
      IF EXISTS (SELECT 1 FROM public.classes WHERE id = _class_id AND owner_id = _student_id) THEN
        RAISE EXCEPTION 'The classroom teacher cannot be muted from this control' USING ERRCODE = '42501';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.class_members WHERE class_id = _class_id AND user_id = _student_id
      ) THEN
        RAISE EXCEPTION 'Student is not a classroom member' USING ERRCODE = '22023';
      END IF;
      IF floor.speaker_id = _student_id THEN
        floor.speaker_id := NULL;
        floor.lease_until := NULL;
      END IF;
    WHEN 'mute-all' THEN
      IF NOT can_moderate THEN RAISE EXCEPTION 'Moderator required' USING ERRCODE = '42501'; END IF;
      floor.students_muted := true;
      floor.speaker_id := NULL;
      floor.lease_until := NULL;
    WHEN 'allow-students' THEN
      IF NOT can_moderate THEN RAISE EXCEPTION 'Moderator required' USING ERRCODE = '42501'; END IF;
      floor.students_muted := false;
    WHEN 'pass', 'appoint' THEN
      IF NOT can_moderate OR (_command = 'appoint' AND NOT teacher) THEN
        RAISE EXCEPTION 'Insufficient classroom permissions' USING ERRCODE = '42501';
      END IF;
      IF _student_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.class_members WHERE class_id = _class_id AND user_id = _student_id
      ) THEN
        RAISE EXCEPTION 'Student is not a classroom member' USING ERRCODE = '22023';
      END IF;
      IF _command = 'appoint' THEN
        floor.moderator_id := _student_id;
      ELSE
        floor.speaker_id := _student_id;
        floor.lease_until := CASE WHEN _student_id IS NOT NULL THEN current_time_utc + interval '30 seconds' END;
      END IF;
    ELSE RAISE EXCEPTION 'Unknown classroom audio command' USING ERRCODE = '22023';
  END CASE;

  UPDATE public.classroom_audio_floor SET speaker_id = floor.speaker_id,
    moderator_id = floor.moderator_id, students_muted = floor.students_muted,
    lease_until = floor.lease_until WHERE class_id = _class_id;
  RETURN jsonb_build_object('speakerId', floor.speaker_id, 'moderatorId', floor.moderator_id,
    'studentsMuted', floor.students_muted, 'leaseUntil', floor.lease_until, 'teacher', teacher);
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_classroom_audio_control(_class_id uuid, _command text, _actor uuid, _student_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  state jsonb;
  lock_id uuid := gen_random_uuid();
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Authenticated actor required' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _actor::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _actor::text, 'role', 'authenticated')::text, true);
  state := public.classroom_audio_command(_class_id, 'status', NULL);
  PERFORM 1 FROM public.classroom_audio_floor WHERE class_id = _class_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.classroom_audio_floor WHERE class_id = _class_id AND control_lock IS NOT NULL) THEN
    RAISE EXCEPTION 'Audio control is busy or needs recovery' USING ERRCODE = '55000';
  END IF;
  state := public.classroom_audio_command(_class_id, _command, _student_id);
  UPDATE public.classroom_audio_floor SET control_lock = lock_id WHERE class_id = _class_id;
  RETURN state || jsonb_build_object('controlLock', lock_id, 'roomName', (
    SELECT 'classroom-' || room_key::text FROM public.classroom_audio_floor WHERE class_id = _class_id
  ));
END;
$$;
