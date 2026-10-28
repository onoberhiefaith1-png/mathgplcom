## Build steps
1. Add the Download Academia button and the device picker to the front page.
2. Add a standalone student Academia app page that opens without login and gives each device its own local student identity.
3. Add an on-device store for the public school catalogue, added schools, sessions, activities, uploaded media and attempts.
4. Run Practice and Play marking fully on the device, and keep finished attempts in a queue until the device is online.
5. Add background sync that pulls updated public content and pushes queued scores.
6. Make the app installable and able to open offline, without affecting the editor preview.

## Technical details
- New route `/academia-app` (public, no RequireAuth). The manifest's `start_url` and `scope` point at it, with `display: standalone`, and icons go in `public/`.
- Offline shell uses `vite-plugin-pwa` (generateSW), following the PWA skill. A guarded register wrapper blocks dev, iframe and preview hosts and supports `?sw=off`. Navigations are NetworkFirst, `/~oauth` is excluded, and hashed assets are CacheFirst.
- `src/lib/offline/academiaStore.ts` uses IndexedDB for the catalogue, packs, media blobs and an attempts queue. The local id is a uuid generated in `useEffect`.
- Public catalogue comes from a server function that reads only public Academia rows through the publishable client, plus an additive `is_public` flag where needed. The flag is staged as a migration and applied when the draft is accepted.
- Marking reuses `predictiveLine.ts` / `instantAward.ts` with no edge calls. The Imagine player is used for Play.
- Sync goes through a `/api/public/academia-sync` route that validates the device id. It only writes guest-style attempt records and returns no private data.
- `beforeinstallprompt` drives the one-tap button on Android, Windows and Mac. iOS shows instructions instead.
- An `AGENTS.md` rule records the offline Academia app boundary.
