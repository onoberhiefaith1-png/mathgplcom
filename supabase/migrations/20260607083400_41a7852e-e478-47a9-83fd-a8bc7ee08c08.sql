REVOKE ALL ON public.class_join_codes FROM anon, authenticated;
GRANT ALL ON public.class_join_codes TO service_role;

DROP POLICY IF EXISTS "Deny direct access to class_join_codes" ON public.class_join_codes;
CREATE POLICY "Deny direct access to class_join_codes"
  ON public.class_join_codes
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);