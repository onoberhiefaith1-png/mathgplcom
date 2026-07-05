UPDATE public.notebook_subsections
SET floating_highlights = jsonb_set(floating_highlights::jsonb, '{0,precedingNotebook}', '"The quadratic formula is:"'::jsonb)
WHERE id = 'af356327-58d0-4f7d-9736-d3d08d8013b1';