# Fix the Smart Card link pipeline (404 → working public page)

## What I verified

- The public routes **do exist** in the app code: `/c/:slug`, `/c/:slug/solve`, `/c/:slug/game`, plus the editor/dashboard routes under `/live/smart-cards/...`.
- The two published cards are live in the database: `3vge7tse` ("Example 3", game mode, snapshot image present) and `egk546a5` ("Example", game mode).
- `https://golden-hour-academy.lovable.app/c/3vge7tse` returns HTTP 200 and serves the app shell, so hosting and SPA fallback are fine.
- **Root cause of the 404:** the currently published JavaScript bundle is old. I downloaded it and it contains no Smart Card code at all — no `/c/:slug` route, no `smart-card-game` calls, no Smart Card strings. The live site literally does not know these pages exist, so React Router falls through to the generic 404 page. The card, the link, the image and the metadata are all correct; only the deployed build is stale.

So step one is not a code change — the app has to be **published** so the live site contains the Smart Card routes.

## Plan

### 1. Publish, then verify as a real end user
Publish the app, then load `https://golden-hour-academy.lovable.app/c/3vge7tse` in a clean browser session (no login, no workspace cookies) and confirm the Challenge Dashboard renders instead of 404. I'll check both cards and both modes.

### 2. Unknown slug shows a Smart Card message, never a generic 404
`/c/:slug` already renders "Smart Card not available" when the slug is missing. I'll extend that to a proper branded page: "This Smart Card does not exist or is no longer published", with a link back to MathGPL Live — and make `/card/:slug` and `/challenge/:slug` permanent aliases of `/c/:slug` so any URL shape you or anyone else shares resolves.

### 3. Public page first, sign-in only at Start Challenge
- Opening the link never asks for anything: title, question, marks, statistics and leaderboard are all visible to anonymous visitors.
- Pressing **Start Challenge** / **Enter Game Challenge** checks the session. Signed in → straight to the SmartBoard or the Adventure stage. Not signed in → the auth page.

### 4. Destination is never lost
The sign-in link carries `next=/c/<slug>/solve` (or `/game`). After email or Google sign-in the visitor lands back on exactly that page — never Home, Dashboard or Teaching Hub. The Google flow returns to the site origin and then completes the hop to the stored path once the session is confirmed, so the redirect works in-browser and in the preview.

### 5. Google sign-in and the player profile
Google sign-in is the primary button on the auth page for card visitors. On first sign-in a MathGPL Live player profile is created (display name and avatar taken from the Google account), so returning visitors are recognised automatically and their leaderboard name stays consistent.

### 6. Activity statuses
Confirm end to end that opening the page records **Visitor active**, pressing Start switches to **Solving**, and finishing switches to **Completed**, with the dashboard counters updating live. Creator Test Mode stays excluded from public statistics.

### 7. Test as an end user
Drive the published URL in a headless browser: open link → view card → press Start → sign in → confirm return to the same card → confirm the board/stage opens and the counters move.

## Technical notes

- Aliases added in `src/App.tsx`; `/c/:slug` remains the canonical short form used by Copy/Share.
- `src/pages/Auth.tsx` already accepts `next`/`redirect`; it will be hardened to only ever accept same-origin paths and to complete the Google hop after the session is hydrated.
- Not-found handling lives in `src/pages/public/SmartCardPage.tsx` rather than the app-wide `NotFound` route.
- Per-card WhatsApp/Facebook thumbnails still require the SSR migration discussed earlier; that is separate from this routing fix and not included here.
