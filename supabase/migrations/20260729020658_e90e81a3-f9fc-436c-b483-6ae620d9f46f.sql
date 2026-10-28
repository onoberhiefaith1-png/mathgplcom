INSERT INTO public.profiles (user_id, display_name, mathgpl_student_id)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Student'),
       public.generate_mathgpl_id()
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

CREATE OR REPLACE FUNCTION public.get_class_member_names(_class_id uuid)
 RETURNS TABLE(user_id uuid, display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.user_id,
         COALESCE(NULLIF(p.display_name, ''), 'Student ' || left(m.user_id::text, 4)) AS display_name
  FROM public.class_members m
  LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.class_id = _class_id
    AND (public.is_class_owner(_class_id) OR public.is_class_member(_class_id));
$function$;