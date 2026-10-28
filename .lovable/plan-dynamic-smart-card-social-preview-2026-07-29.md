# Dynamic Smart Card Social Preview

## What is true today (verified)

- The shared link is `https://golden-hour-academy.lovable.app/c/<slug>` — clean and working.
- `index.html` carries one site-wide head for every URL: title "MathGPL Academy — Interactive Math Teaching Hub", the long description, and a fixed `og:image` (the site screenshot). That is exactly the preview WhatsApp shows.
- A per-card head already exists in the `smart-card-preview` backend function (per-card title, no description, card snapshot as `og:image`) — but nothing points crawlers at it when a `/c/<slug>` link is shared.
- Card snapshots are already generated on publish at 1200x630 (landscape) and stored privately, served through that function.

So the image pipeline mostly exists. Two things block the result you want: the preview is landscape, and the clean `/c/<slug>` URL cannot serve a per-card head on a static single-page site.

## The one hard requirement

WhatsApp, Facebook, X, LinkedIn, Telegram and Discord crawlers do not run JavaScript. On a static site every URL returns the same `index.html`, so a clean `/c/<slug>` link can only ever show the site-wide preview. YouTube achieves per-video previews because each URL is rendered on the server.

To get a per-card preview on a clean short link, this project needs server-rendered pages: upgrade to Lovable's SSR template (TanStack Start) — [what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start). All pages, engines, database and backend functions stay; the only change is that a request to `/c/<slug>` is answered by the server.

## Plan

### 1. Move `/c/:slug` to server-rendered head
After the SSR upgrade, the server loader reads the card row (title, slug, snapshot) and returns, for that URL only:
- `og:title` — the card title alone (e.g. "Example 3")
- no description at all (no "Interactive Math Teaching Hub", no Lesson Notes / SmartBoard / Floating Number AI text)
- `og:image` / `twitter:image` — the card snapshot
- `og:url` + canonical — the short `/c/<slug>` URL itself
- `og:site_name` = MathGPL Life, `twitter:card` = `summary_large_image`

The site-wide head in `index.html` stays untouched for every other route.

### 2. Square poster snapshot (1:1)
Regenerate the snapshot at 1080x1080 instead of 1200x630, with the Smart Card scaled to fill nearly the whole square (thin margin only), the MathGPL Life badge in the top-left, and the card's own background. Landscape framing is removed.

Note on platforms: WhatsApp and Telegram render a square image large and clean. Facebook, X and LinkedIn crop toward landscape in some placements — the square is still the right master image, but it will not always be shown edge to edge there.

### 3. Regenerate on every publish and republish
Snapshot capture stays on the publish action, overwriting the same storage path so a re-styled card always shares its current look. Cards published before this change get a fresh square snapshot on their next publish; a one-off note in the editor tells the teacher to republish once.

### 4. Copy / Share stay clean
Copy Smart Card and Share Smart Card keep putting exactly one line on the clipboard: `https://<site>/c/<slug>`. No backend function URL, no preview-domain URL, no HTML.

### 5. Verify
Check the deployed link through a crawler-style fetch (no JavaScript) and confirm the response head contains the card title, the square card image, the self-referencing canonical, and no description. Then paste into WhatsApp to confirm the visual.

## Technical notes

- Template migration to TanStack Start, preserving routes, engines and backend.
- Server route loader for `/c/:slug` (plus `/card/:slug`, `/challenge/:slug` aliases) reading `smart_cards` and emitting head tags.
- Snapshot bytes continue to be served by the `smart-card-preview` function's `image=1` endpoint (stable, cacheable URL).
- `src/lib/smartcards/preview.ts`: canvas changes from 1200x630 to 1080x1080 with fill-the-square layout; `og:image:width`/`height` updated to 1080.
- Once `mathgpl.live` (or `mathgpl.app`) is connected in Project settings > Domains, links become `mathgpl.live/c/<slug>` with no code change.

## Decision needed

This plan assumes the SSR upgrade, because it is the only way to get a per-card preview on the clean `/c/<slug>` link. If you would rather not migrate yet, the alternative is sharing the backend preview URL, which shows the correct per-card image today but is a long ugly link — tell me and I will switch the plan.
