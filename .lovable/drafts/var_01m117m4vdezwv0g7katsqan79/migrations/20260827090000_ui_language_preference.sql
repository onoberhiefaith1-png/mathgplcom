-- Remember each person's interface language.
--
-- ui_language holds the active language code (English is the default and the
-- permanent fallback); ui_languages holds the languages the user has chosen,
-- in the order they chose them. English is implicit and never stored.
alter table public.profiles
  add column if not exists ui_language text not null default 'en',
  add column if not exists ui_languages text[] not null default '{}'::text[];
