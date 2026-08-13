update public.site_sections
set media = coalesce(draft->'media', media),
    eyebrow = coalesce(draft->>'eyebrow', eyebrow),
    headline = coalesce(draft->>'headline', headline),
    subline = coalesce(draft->>'subline', subline),
    cta_label = coalesce(draft->>'cta_label', cta_label),
    cta_href = coalesce(draft->>'cta_href', cta_href),
    items = coalesce(draft->'items', items),
    draft = null,
    published_at = now()
where draft is not null and draft <> '{}'::jsonb;