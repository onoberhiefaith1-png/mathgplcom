ALTER TABLE public.class_smartboard_state REPLICA IDENTITY FULL;
ALTER TABLE public.classes REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_smartboard_state;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;