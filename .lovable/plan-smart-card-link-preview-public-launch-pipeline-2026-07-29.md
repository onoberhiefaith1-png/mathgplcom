# Smart Card Link Preview & Public Launch Pipeline

## What is true today (verified)

- The shared link is currently the raw backend function URL (`.../functions/v1/smart-card-preview?slug=...&origin=...`) — that is the "technical link" being pasted.
- Slugs are 8 random characters; the clean public route `/c/:slug` already exists.
- Public routing already works: `/c/:slug` (dashboard) automatically opens `/c/:slug/game` for Game Challenges and `/c/:slug/solve` for Challenges, and Creator Test Mode already excludes runs from stats and presence counters.
- The preview function already emits per-card title/description, but has no preview image.

So the missing pieces are: a real preview image, a clean short link, and preview refresh on republish.

## What will be built

### 1. Smart Card snapshot image
- On publish (and on every republish), capture the rendered Smart Card exactly as shown — background, title, question, emojis, maths, layout — using an in-browser DOM snapshot (`html-to-image`) at 1200x630.
- A small MathGPL Life logo is composited into the top-left corner of the snapshot.
- The image is uploaded to a new public storage bucket `smart-card-previews` at `<cardId>.png`, overwritten each republish so the shared preview always matches the latest version.
- A new column `preview_image_path` on `smart_cards` records it (additive migration only).

### 2. Clean short link
- Shortened slugs (5 characters) for newly created cards; existing slugs keep working.
- Copy Smart Card copies only `https://<site>/c/<slug>` — plain text, one line, no HTML, no image data.
- Share Smart Card opens the native share sheet with that same URL only.
- The backend function URL is never surfaced to users again.
- `mathgpl.live` requires connecting that domain in Project settings > Domains; once connected the links become `mathgpl.live/c/<slug>` automatically with no code change.

### 3. Metadata
- The crawler endpoint gains `og:image` / `twitter:image` pointing at the snapshot, plus title, the standard description ("Solve this interactive mathematics challenge using the MathGPL Smartboard."), and the short `/c/<slug>` canonical URL.
- The public card pages also set per-page title/description/og tags at runtime for crawlers that execute JavaScript.

### 4. Live pipeline confirmation
- Verify end to end that a shared link lands a visitor on the correct dashboard by card type, registers them as visitor then player, updates Visitors / Solving Now / Completed / Qualified live, launches the existing Student Smartboard with card, question, participant, timer, progress bar and pass mark already attached, and keeps creator runs out of every public statistic.
- Any gap found here is fixed in place; no new gameplay system is created.

## One honest limitation

This app is a static single-page site. WhatsApp, Facebook, X, LinkedIn and Telegram crawlers do not run JavaScript, so they read one shared static head — which means a *clean* `/c/<slug>` link cannot show a per-card preview on those platforms without server-side rendering. Two ways forward:

- **A (default in this plan):** ship the snapshot, short link and metadata now. Every card gets a real preview image, and the site-wide preview shows on social until SSR lands.
- **B:** additionally upgrade to Lovable's SSR template so each `/c/<slug>` serves its own head and the per-card snapshot appears on every platform — [what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start).

Tell me if you want B and I will fold the migration into this work.

## Technical notes

- New dependency: `html-to-image`.
- Migration: `ALTER TABLE public.smart_cards ADD COLUMN preview_image_path text;` plus a public storage bucket with owner-only write policies.
- Files touched: `src/lib/smartcards/smartCards.ts` (share/copy URL, slug length, snapshot upload), `src/pages/live/SmartCardEditorPage.tsx` (snapshot at publish), `src/pages/public/SmartCardPage.tsx` (copy/share text, per-page meta), `supabase/functions/smart-card-preview/index.ts` (og:image, canonical), `supabase/functions/smart-card/index.ts` (return preview URL).
