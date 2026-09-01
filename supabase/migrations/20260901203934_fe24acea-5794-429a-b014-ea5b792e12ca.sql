INSERT INTO public.building_classrooms (building_id, door_id, name, kind, position)
SELECT d.building_id,
       d.id,
       COALESCE(NULLIF(TRIM(d.title_override), ''), 'Classroom'),
       'classroom',
       0
FROM public.building_doors d
WHERE NOT EXISTS (
  SELECT 1 FROM public.building_classrooms c WHERE c.door_id = d.id
);