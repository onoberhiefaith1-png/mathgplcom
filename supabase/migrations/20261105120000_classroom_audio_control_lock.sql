ALTER TABLE public.classroom_audio_floor ADD COLUMN control_lock uuid;
ALTER TABLE public.classroom_audio_floor ADD COLUMN room_key uuid NOT NULL DEFAULT gen_random_uuid();

CREATE FUNCTION public.begin_classroom_audio_control(_class_id uuid, _command text, _actor uuid, _student_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  state jsonb;
  lock_id uuid := gen_random_uuid();
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Authenticated actor required' USING ERRCODE = '42501'; END IF;
  PERFORM set_config('request.jwt.claim.sub', _actor::text, true);
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

CREATE FUNCTION public.finish_classroom_audio_control(_class_id uuid, _lock uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.classroom_audio_floor SET control_lock = NULL
    WHERE class_id = _class_id AND control_lock = _lock;
  IF NOT FOUND THEN RAISE EXCEPTION 'Audio control lock mismatch'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_classroom_audio_control(uuid,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_classroom_audio_control(uuid,text,uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.finish_classroom_audio_control(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_classroom_audio_control(uuid,uuid) TO service_role;

CREATE FUNCTION public.classroom_audio_room(_class_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.classroom_audio_command(_class_id, 'status', NULL);
  RETURN (SELECT 'classroom-' || room_key::text FROM public.classroom_audio_floor WHERE class_id = _class_id);
END;
$$;
REVOKE ALL ON FUNCTION public.classroom_audio_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classroom_audio_room(uuid) TO authenticated;

CREATE FUNCTION public.reset_classroom_audio(_class_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_room text;
BEGIN
  IF NOT coalesce(public.is_class_owner(_class_id), false) OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Classroom owner required' USING ERRCODE = '42501';
  END IF;
  SELECT 'classroom-' || room_key::text INTO old_room FROM public.classroom_audio_floor
    WHERE class_id = _class_id FOR UPDATE;
  UPDATE public.classroom_audio_floor SET room_key = gen_random_uuid(), control_lock = NULL,
    speaker_id = NULL, lease_until = NULL, moderator_id = NULL, students_muted = false
    WHERE class_id = _class_id;
  RETURN old_room;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_classroom_audio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_classroom_audio(uuid) TO authenticated;
