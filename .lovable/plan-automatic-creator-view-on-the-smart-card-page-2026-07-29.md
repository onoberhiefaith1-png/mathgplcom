# Automatic creator view on the Smart Card page

Today the creator toolbar (Copy / Share / Create Share Card / Creator Test Mode) only appears when the URL carries `?creator=1`. That means you have to copy and edit the link by hand.

## What changes

- When the signed-in user is the card's owner, `/c/:slug` opens in creator view automatically — no `?creator=1` needed.
- Everyone else (signed out, guests, students, other teachers) keeps the exact public view they see today: title, question, Start Challenge, statistics below the card. No creator toolbar, no test-mode banner, no Share Mode.
- `?creator=1` still works as a manual override for the owner only, so existing links you already shared to yourself don't break. It no longer unlocks creator tools for anyone who simply types it into the URL.
- Same rule applies to the game challenge dashboard route so both publish modes behave identically.

Nothing about the challenge, grading, leaderboard, statistics or the shared URL changes.

## Technical notes

- The public `smart-card` edge function already reads `owner_id`; the `get` / `dashboard` payloads return the card object, so expose `ownerId` on the public card (a UUID only, no personal data).
- In `src/pages/public/SmartCardPage.tsx`, replace `const creator = params.get("creator") === "1"` with an ownership check: read the current session user via `supabase.auth.getUser()` and set `isCreator = user?.id === payload.card.ownerId`. Keep `?creator=1` as an extra opt-in that is gated by the same ownership check.
- Creator state must resolve after the payload and auth both load, so default to the public view while loading to avoid a flash of the toolbar.
- Mirror the same detection in `src/pages/public/SmartCardGamePage.tsx` / the game dashboard entry.
- Preview/test-mode flagging (`is_preview`) continues to follow the creator flag, so owner activity still stays out of public statistics.
