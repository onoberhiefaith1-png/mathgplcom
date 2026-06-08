
CREATE OR REPLACE FUNCTION public.accept_class_invitation(_invitation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_class_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT class_id INTO v_class_id
  FROM public.class_invitations
  WHERE id = _invitation_id
    AND invitee_user_id = auth.uid()
    AND status = 'pending'
  FOR UPDATE;

  IF v_class_id IS NULL THEN
    RAISE EXCEPTION 'invitation not found or not pending';
  END IF;

  INSERT INTO public.class_members (class_id, user_id)
  VALUES (v_class_id, auth.uid())
  ON CONFLICT DO NOTHING;

  UPDATE public.class_invitations
  SET status = 'accepted'
  WHERE id = _invitation_id;

  RETURN v_class_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_class_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_class_invitation(uuid) TO authenticated;
