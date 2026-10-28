CREATE TABLE public.emoji_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'New session',
  content text NOT NULL DEFAULT '',
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.emoji_categories TO authenticated;
GRANT ALL ON public.emoji_categories TO service_role;

ALTER TABLE public.emoji_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their emoji categories"
ON public.emoji_categories FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE INDEX emoji_categories_owner_order_idx ON public.emoji_categories (owner_id, order_index);

CREATE TRIGGER emoji_categories_touch_updated_at
BEFORE UPDATE ON public.emoji_categories
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();