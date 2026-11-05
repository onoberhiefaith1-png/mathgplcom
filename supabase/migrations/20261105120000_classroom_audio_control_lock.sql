ALTER TABLE public.classroom_audio_floor ADD COLUMN control_lock uuid;

CREATE FUNCTION public.begin_classroom_audio_control(_class_id uuid, _command text, _student_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  state jsonb;
  lock_id uuid := gen_random_uuid();
BEGIN
  state := public.classroom_audio_command(_class_id, 'status', NULL);
  PERFORM 1 FROM public.classroom_audio_floor WHERE class_id = _class_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.classroom_audio_floor WHERE class_id = _class_id AND control_lock IS NOT NULL) THEN
    RAISE EXCEPTION 'Audio control is busy or needs recovery' USING ERRCODE = '55000';
  END IF;
  state := public.classroom_audio_command(_class_id, _command, _student_id);
  UPDATE public.classroom_audio_floor SET control_lock = lock_id WHERE class_id = _class_id;
  RETURN state || jsonb_build_object('controlLock', lock_id);
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

REVOKE ALL ON FUNCTION public.begin_classroom_audio_control(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_classroom_audio_control(uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.finish_classroom_audio_control(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_classroom_audio_control(uuid,uuid) TO service_role;
