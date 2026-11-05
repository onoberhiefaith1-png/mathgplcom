-- Mirror of supabase/migrations/20261105211000_shared_template_game_assets.sql

CREATE OR REPLACE FUNCTION public.jsonb_has_exact_text(value jsonb, needle text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  found boolean;
BEGIN
  IF value IS NULL OR needle IS NULL OR needle = '' THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(value) = 'string' THEN
    RETURN value = to_jsonb(needle);
  END IF;
  IF jsonb_typeof(value) = 'array' THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(value) AS element(item)
      WHERE public.jsonb_has_exact_text(element.item, needle)
    ) INTO found;
    RETURN coalesce(found, false);
  END IF;
  IF jsonb_typeof(value) = 'object' THEN
    SELECT EXISTS (
      SELECT 1
      FROM jsonb_each(value) AS entry(key, item)
      WHERE public.jsonb_has_exact_text(entry.item, needle)
    ) INTO found;
    RETURN coalesce(found, false);
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.shared_template_references_asset(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _name IS NOT NULL
    AND split_part(_name, '/', 2) = 'slate-assets'
    AND _name !~ '\.\.'
    AND EXISTS (
      SELECT 1
      FROM public.slate_games g
      WHERE g.library IS TRUE
        AND (
          public.jsonb_has_exact_text(g.background, _name)
          OR public.jsonb_has_exact_text(g.settings, _name)
          OR public.jsonb_has_exact_text(g.slots, _name)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.jsonb_has_exact_text(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shared_template_references_asset(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shared_template_references_asset(text) TO authenticated;

DROP POLICY IF EXISTS "Shared template media is readable" ON storage.objects;
CREATE POLICY "Shared template media is readable"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'game-assets'
  AND public.shared_template_references_asset(name)
);
