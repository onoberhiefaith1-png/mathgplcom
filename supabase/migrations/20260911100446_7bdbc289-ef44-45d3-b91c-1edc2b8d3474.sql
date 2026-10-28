-- When a lesson note is deleted, no class may keep pointing at it.
CREATE OR REPLACE FUNCTION public.clear_class_board_on_notebook_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.class_smartboard_state
     SET notebook_id = NULL,
         state_json = '{}'::jsonb,
         updated_at = now()
   WHERE notebook_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS clear_class_board_on_notebook_delete ON public.notebooks;
CREATE TRIGGER clear_class_board_on_notebook_delete
BEFORE DELETE ON public.notebooks
FOR EACH ROW EXECUTE FUNCTION public.clear_class_board_on_notebook_delete();

-- One-off repair for classes already pointing at a deleted lesson note.
UPDATE public.class_smartboard_state s
   SET notebook_id = NULL,
       state_json = '{}'::jsonb,
       updated_at = now()
 WHERE s.notebook_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.notebooks n WHERE n.id = s.notebook_id);