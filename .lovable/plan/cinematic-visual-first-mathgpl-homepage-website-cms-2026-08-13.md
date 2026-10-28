# Cinematic, visual-first MathGPL homepage + Website CMS

Rebuild the signed-out front door (`/`) as a scroll-driven, visual-first experience, and make every section editable from the admin dashboard. Current `/` for signed-out visitors is a single centred card with three buttons — that becomes the new journey page.

## The journey (13 sections)

```text
01 HOOK          cinematic hero, media background, "Mathematics, Reimagined." + Get Started / Log In
02 CURIOSITY     one line, full-bleed: "This isn't just another way to learn mathematics."
03 PRODUCT       full-width product video (poster image, click-to-play, lazy)
04 WHAT IT IS    LEARN / INTERACT / PLAY / MEASURE — 4 large visual panels, 2-4 words each
05 PLATFORM      Smartboard, Lesson Notes, Assignments, Adventure, Assessment — alternating large stills
06 MATH WORLD    signature cinematic band using the existing MathGPL building artwork
07 TRANSFORMATION  "From mathematics on the page..." -> "...to mathematics you can experience."
08 BY THE NUMBERS  real counts from the database; admin chooses which metrics show
09 WHO IT'S FOR    Students / Teachers / Schools — three tall visual cards
10 SOCIAL PROOF    testimonials; hidden entirely until real entries exist
11 EXPERIENCE      large product demonstration + "Explore MathGPL"
12 FINAL CTA       cinematic close: "The future of mathematics learning starts here."
13 FOOTER          existing legal links, seller statement, pricing
```

Copy rule enforced everywhere: headline plus at most one short line. No paragraphs, no icon grids, no repeated rounded-card rows. Visual carries the meaning.

## Motion and feel

Subtle only: fade-and-rise on entry, slow parallax on full-bleed media, scale-on-scroll for the world section, cross-fade between platform stills. All animation respects `prefers-reduced-motion`. Dark navy/violet base with the existing amber accent — same identity as the app, no new palette.

## Admin control

New `/admin/website` console (platform owner only) lists every section as a row with: show/hide toggle, reorder, headline text, sub-line, CTA label + target, and media upload/replace (image or video, plus poster for video). Draft edits then **Publish** — the public page reads only published content. A **Preview** link opens `/?preview=1` rendering the draft. Empty sections stay hidden automatically so the page never shows a blank slot.

Nothing is fabricated: no invented statistics, no invented testimonials, no stock photos. Sections ship with the platform's own artwork where it exists and stay hidden otherwise.

## Statistics

Counts come from real tables (learners, teachers, schools, questions solved, adventures completed). Each metric has an admin on/off switch; the section hides itself when no metric is enabled. Values render as `0+` style until they are meaningful.

## Performance

Native lazy loading for below-fold media, poster images for every video with playback started on intersection (never all at once), responsive widths, one preloaded hero asset marked as the LCP candidate, smaller/static media on mobile, and CDN-hosted assets.

## Technical notes

- New table `site_sections` (public schema): `key`, `kind`, `position`, `visible`, `headline`, `subline`, `cta_label`, `cta_href`, `media` (jsonb: path/source/type/poster), `draft` jsonb, `published_at`. GRANTs plus RLS: `anon`/`authenticated` SELECT of published rows; writes restricted to platform owner via `has_role`. New table `site_testimonials` with the same read/write shape. Migration seeds the 13 section rows with the structure and the platform's existing artwork; text-only, no fake proof data.
- Stats read through one security-definer function returning aggregate counts only (no rows, no PII), plus a `site_stats_settings` row for which metrics are enabled.
- Homepage split into `src/components/home/*` section components consumed by `src/pages/WelcomePage.tsx`; each takes its content row as a prop so hidden/empty sections simply don't render.
- Media upload reuses the existing storage + signed-URL helpers (`getSignedUrl`, `resolveMediaUrl`) already used by homepage customisation, so admin uploads behave like building/background uploads.
- `/` keeps its existing behaviour for signed-in users (rotating building `Index`); only the signed-out branch changes.
- Route `head()` metadata on `/` updated for the new positioning, including `og:image` from the hero asset's absolute URL.

## Build order

1. Migration: `site_sections`, `site_testimonials`, stats function + settings, seeds, GRANTs/RLS.
2. Content hook + section components; rebuild the signed-out homepage through sections 01-13.
3. Scroll/motion layer and performance handling.
4. `/admin/website` editor with draft/publish, reorder, media upload, preview.
5. Wire real statistics and the testimonial section's hide-when-empty rule.
