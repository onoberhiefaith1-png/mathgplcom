
ALTER TABLE public.class_members REPLICA IDENTITY FULL;
ALTER TABLE public.class_join_requests REPLICA IDENTITY FULL;
ALTER TABLE public.class_invitations REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.class_members; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.class_join_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.class_invitations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
