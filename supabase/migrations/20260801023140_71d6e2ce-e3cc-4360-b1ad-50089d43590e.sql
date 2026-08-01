CREATE TABLE IF NOT EXISTS public.member_gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('background','building','asset')),
  title text NOT NULL DEFAULT 'Untitled',
  media_url text,
  storage_path text,
  media_type text,
  source text,
  source_resource_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_gallery_items TO authenticated;
GRANT ALL ON public.member_gallery_items TO service_role;

ALTER TABLE public.member_gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage their own gallery items"
ON public.member_gallery_items FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS member_gallery_items_owner_kind_idx
  ON public.member_gallery_items (owner_id, kind, created_at DESC);

CREATE TRIGGER update_member_gallery_items_updated_at
BEFORE UPDATE ON public.member_gallery_items
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();