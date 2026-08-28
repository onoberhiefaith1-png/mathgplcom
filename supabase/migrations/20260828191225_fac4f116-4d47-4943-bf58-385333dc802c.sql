ALTER TABLE public.community_resources DROP CONSTRAINT community_resources_kind_check;
ALTER TABLE public.community_resources ADD CONSTRAINT community_resources_kind_check
CHECK (kind = ANY (ARRAY['lesson_note','class','adventure','background','building','asset','lesson_asset','decoration','effect','reward','session','course']));