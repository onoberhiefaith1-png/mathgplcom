CREATE POLICY "Members can leave their class"
  ON public.class_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());