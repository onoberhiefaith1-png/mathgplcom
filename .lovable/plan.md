# Smart Card Public Sharing — YouTube-style links

## What is true today (verified in code)

- The share/copy link is already built as `https://golden-hour-academy.lovable.app/c/<slug>` (`PUBLIC_SITE` + `cardUrl` in `src/lib/smartcards/smartCards.ts`). The `lovableproject.com/c/3vge7se` link in your screenshot is an old preview-domain link copied before that change — preview domains always demand a Lovable login, which is the "Access denied / authorized workspace members" page you saw. Any link on the published domain has no such gate.
- The public routes exist and are open to anyone: `/c/:slug` (dashboard), `/c/:slug/solve`, `/c/:slug/game`.
- The card snapshot image already generates on publish and is served through the preview function.
- `index.html` carries one site-wide title, description and og:image for the whole app.
- No custom domain is connected, so `mathgpl.live` does not resolve yet.

## The one real blocker

This app is a static single-page site. Every URL — including `/c/8GJ2` — serves the same `index.html`. WhatsApp, Facebook, Telegram, X, LinkedIn and Discord crawlers do not run JavaScript, so they read that one static head and show the site-wide preview. A clean per-card preview (your Smart Card image as the big thumbnail) is **impossible on a static site** no matter how the metadata is written.

YouTube does this with server-side rendering: `youtube.com/watch?v=abc` is rendered on the server, so each video URL returns its own `og:image`. To match it, this app needs the same capability.

## Plan

### Step 1 — Move to server-rendered pages (required for the YouTube behaviour)
Upgrade the project to Lovable's SSR template (TanStack Start) — [what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start). All existing pages, engines and backend stay; the difference is that a request to `/c/8GJ2` is answered by the server.

### Step 2 — Per-card head on the public route
The server response for `/c/:slug` includes, generated from that card's row:
- `og:title` — the card title only (short, e.g. "Example 3")
- `og:description` — one short line (or omitted entirely, since you want the image to carry everything)
- `og:image` / `twitter:image` — the card snapshot at 1200x630
- `og:url` + canonical — the short `/c/<slug>` URL itself
- `og:type=website`, `og:site_name=MathGPL Life`, `twitter:card=summary_large_image`

Result when pasted into WhatsApp: full-width Smart Card image, one short title line, the short link. No workspace URL, no long description.

### Step 3 — Shorter, cleaner slugs
Move to 4-character uppercase-safe slugs (`/c/8GJ2` style), collision-checked at publish. Existing slugs keep working forever.

### Step 4 — Snapshot on every publish
Confirm the snapshot regenerates and overwrites on each republish so the shared preview always matches the current card, and that the image URL is stable and cacheable.

### Step 5 — Copy / Share buttons
- **Copy Smart Card** → clipboard gets exactly one line: the short public URL. Never HTML, JSON, or a preview-domain URL.
- **Share Smart Card** → `navigator.share({ title, url })`, falling back to copy where unsupported.
- Add a guard so a link can never be copied from the preview domain — the copied value is always built from the published origin.

### Step 6 — Landing flow (no login walls for players)
Verify end to end on the published site: link opens `/c/<slug>` directly, Challenge cards go to the Smartboard solve flow with no account, Game Challenge cards ask for sign-in only at the point of play and return to `/c/<slug>/game` afterwards, presence and stats update live, and Creator Test Mode stays out of public statistics.

### Step 7 — mathgpl.live
Publish the app, then connect `mathgpl.live` in Project settings > Domains. Once it is active every share link becomes `mathgpl.live/c/8GJ2` automatically — no further code change.

## Important note about testing

Always test shared links from the **published** URL. Preview links (`*.lovableproject.com`, `id-preview--*.lovable.app`) are private by design and will always show "Access denied" to anyone who is not a workspace member.

## Technical summary

- Template migration to TanStack Start (SSR), preserving routes, engines and backend.
- Server loader for `/c/:slug` reading `smart_cards` (title, slug, `preview_image_path`, `publish_mode`) and emitting head tags.
- Snapshot bytes served through the existing `smart-card-preview` function image endpoint.
- `generateSlug` shortened; `cardUrl` / `shareUrl` hardened against non-published origins.
- The standalone `smart-card-preview` HTML redirect page is retired once SSR serves the head directly.
