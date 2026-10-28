alter table public.aura_knowledge
  add column if not exists page text,
  add column if not exists control text;