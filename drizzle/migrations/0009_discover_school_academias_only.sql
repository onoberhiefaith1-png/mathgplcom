CREATE OR REPLACE FUNCTION public.discover_academias(_q text DEFAULT ''::text)
 RETURNS TABLE(id uuid, org_id uuid, name text, description text, cover_path text, presentation_path text, visibility text, school_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT a.id, a.org_id, a.name, a.description, a.cover_path, a.presentation_path, a.visibility, o.name
  FROM academia a JOIN organizations o ON o.id = a.org_id
  WHERE o.kind = 'school'
    AND (a.visibility = 'public' OR is_org_owner(a.org_id) OR is_workspace_member(a.org_id))
    AND (coalesce(_q,'') = '' OR a.name ILIKE '%'||_q||'%' OR o.name ILIKE '%'||_q||'%')
  ORDER BY a.name LIMIT 60
$function$;