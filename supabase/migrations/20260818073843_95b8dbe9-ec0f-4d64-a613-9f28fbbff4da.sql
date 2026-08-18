CREATE TABLE public.emoji_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.emoji_categories(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'glyph',
  glyph text,
  storage_path text,
  external_url text,
  name text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emoji_items TO authenticated;
GRANT ALL ON public.emoji_items TO service_role;

ALTER TABLE public.emoji_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their emoji items"
ON public.emoji_items FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX emoji_items_category_order_idx ON public.emoji_items (category_id, order_index);