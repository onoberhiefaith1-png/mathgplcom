CREATE TABLE public.classroom_audio_floor (
  class_id uuid PRIMARY KEY REFERENCES public.classes(id) ON DELETE CASCADE,
  speaker_id uuid,
  moderator_id uuid,
  students_muted boolean NOT NULL DEFAULT false,
  lease_until timestamptz
);

ALTER TABLE public.classroom_audio_floor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.classroom_audio_floor FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.classroom_audio_command(
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

REVOKE ALL ON FUNCTION public.classroom_audio_command(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classroom_audio_command(uuid,text,uuid) TO authenticated;
