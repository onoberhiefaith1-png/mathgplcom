# Add Section / Delete Section — Website Editor Toolkit

Goal: turn the homepage editor into a self-service builder. You get a **+ Add section** button at the bottom of `/admin/website`, a picker showing every ready-made block used on the current homepage, and a **Delete section** action on each card. No new content is created for you — you build "Monetize your passion" yourself.

## What you'll be able to do

1. Scroll to the bottom of the website editor and click **+ Add section**.
2. Pick a block from the section library. Each block is a preset with a name, a small visual thumbnail-style description, and the fields it exposes:
   - Cinematic hero — eyebrow, headline, subline, button label + link, background image/video
   - Statement — big headline + subline
   - Product video — headline, subline, video + poster still
   - Four-panel row — 2-6 panels, each with label, headline, subline, image
   - Platform showcase — headline + horizontal media cards
   - Cinematic media band — full-width image/video with overlay text
   - Before / after compare — two panels of text + media
   - Numbers strip — headline + live platform counters (toggleable)
   - Audience cards — one card per role, text + image
   - Testimonials — pulls from your approved testimonial list
   - Interactive demo — headline, subline, button
   - Final call to action — headline, subline, button label + link
   - Footer — footer text and links
3. Name the section (e.g. "Monetize your passion"), choose the block, and it's inserted at the end, hidden by default, with empty fields.
4. Edit text, upload/pick media (File or GPL Assets), set the button label and link, then toggle **Visible** — it saves and publishes as it already does today.
5. Move it up/down with the existing arrows, or **Delete section** (confirmation required) to remove any section, including the ones already there.

Every block already exists in the live homepage renderer, so anything you add renders in the same premium style as the current site.

## Technical notes

- `src/lib/site/types.ts`: add a `SECTION_TEMPLATES` catalogue — one entry per existing `SiteSectionKind` with label, description, default item count, and which fields it uses. Make `SECTION_TITLES` a fallback so custom sections display their own title (store the display name in `eyebrow`-independent `key`-derived label; add optional `title` column usage via existing `key` slug + a `label` field stored in `draft`-free column `eyebrow`? — instead store the admin display name in a new nullable column).
- Additive migration: `alter table public.site_sections add column if not exists title text;` (nullable, no other change). Editor shows `title ?? SECTION_TITLES[key] ?? key`.
- `src/lib/site/useSiteAdmin.ts`: add `createSection({ kind, title })` — slugified unique `key`, `position = max + 1`, `visible = false`, empty fields, default items for item-based kinds; and `deleteSection(row)`. Platform-owner ALL policy already permits both.
- `src/pages/admin/WebsiteContentPage.tsx`: bottom **+ Add section** button opening an `AddSectionDialog` (new component: title input + block grid); per-card overflow menu gains **Delete section** with confirm dialog.
- Renderer untouched: `SiteSections.tsx` already switches on `kind`, and unknown/empty sections stay hidden until visible.
