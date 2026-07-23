## Problem

On the student game/adventure page, the three visual layers appear at different times:

1. Background image loads first (or last)
2. Reward images (progress-bar effects / slot effects) trickle in seconds later
3. Progress bar chrome is up before its reward artwork

Root cause, confirmed by reading the code:

- `SignedMedia` (`src/components/gamebuilder/SignedMedia.tsx`) always starts with `url = null` and does an async `getSignedUrl` on mount, even when the URL is already cached from prefetch. Each element mounts independently, so each fades in on its own async tick.
- `prefetchGame` (`src/lib/games/prefetch.ts`) fetches URLs for reward effects and warms them, but `waitForSceneReady` only awaits the main element source — it does NOT wait for `progress.effectStoragePath` or `progress.slotEffects[*].effectStoragePath`. So rewards decode after the gate has already resolved.
- `GamePlayPage` renders `GameCanvas` as soon as `waitForSceneReady` resolves, before rewards have decoded.

## Fix — three small, contained changes

### 1. Synchronous cache read in the URL layer
`src/lib/games/urls.ts`
- Add `getCachedSignedUrl(path)` — synchronous, returns the URL if a non-expired entry exists in the existing `cache` Map, else `null`. No new state, no new cache.

### 2. First-paint uses the cache
`src/components/gamebuilder/SignedMedia.tsx`
- In `useSignedUrl`, initialise state with `getCachedSignedUrl(path)` when `source === "storage"` (and with `path` directly when `source === "url"`). Only run the async fetch if the initial value is `null`.
- Result: after prefetch has warmed URLs, every `<SignedMedia>` renders its real `<img>`/`<video>` on the very first render — no "empty then pop in" per element.

### 3. Extend the readiness gate to include rewards
`src/lib/games/prefetch.ts` — `waitForSceneReady`
- Collect URLs for every element's main source AND for `el.progress.effectStoragePath` and every `el.progress.slotEffects[*].effectStoragePath`.
- Await image `decode()` / video `canplaythrough` for all of them (existing pattern, just applied to the extra paths).
- Keep the existing 6s timeout as a safety net.

`src/pages/student/GamePlayPage.tsx`
- No structural change. The existing "hide until `loading=false`" gate already exists; extending `waitForSceneReady` is enough to make it wait for rewards too.
- Add a single `opacity-0 → opacity-100` fade (200ms) on the canvas wrapper the first time `loading` flips false, so the three layers appear as one visual event.

## What stays untouched

- No DB schema changes.
- No changes to `GameCanvas`, `CanvasElementView`, `ProgressColumn`, teacher pages, adventure sync, or heartbeat.
- No behavioural change for the teacher preview — only the student play view fades in atomically.

## Verification

- Open a student session where the game has a background + progress bar + reward. Reload. All three should appear in the same frame after the "Opening game…" spinner disappears, with a single short fade-in.
- Toggle offline/online to confirm the cache path (second load) is instant with no per-element pop-in.
