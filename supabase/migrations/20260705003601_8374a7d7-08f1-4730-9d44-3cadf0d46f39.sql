UPDATE public.notebook_subsections
SET floating_highlights = jsonb_set(
  floating_highlights::jsonb,
  '{0,precedingNotebook}',
  '""'::jsonb
)
WHERE id = '9082331a-1aaf-49b7-ae55-e08c4e1ad615';