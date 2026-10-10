# Offline Academia: full first-time download, then a manual Update button

## What the student will see

1. **First open (needs data, once).** The installed Academia icon opens a full-screen loading page that looks like the Game's own loading screen ("Preparing Academia… 42%"). It stays there until everything is saved to the phone: the app, the Game and Smartboard screens, writing styles, backgrounds, surfaces, rewards, sounds, images and uploaded videos for every school the student has added. When it reaches 100% it says "Ready to use offline" and opens Explore.
2. **Every open after that (no data needed).** It opens straight away from the phone. It does **not** update by itself, even if data is on. What was saved stays exactly the same.
3. **Update button on the first page.** A clear "Update" button at the top of the home page. Pressing it (with data) checks for changes the Academia creator made (new, changed or removed activities), shows the same loading progress, and replaces the saved copy only when the download finished completely. If the download fails part-way, the old copy keeps working. It also shows "Last updated: <date>". Without data, Update says "Connect to the internet to update" and changes nothing.
4. **Adding a new school** downloads that school straight away with the same progress bar, so it also works offline immediately.
5. Results made offline still upload quietly whenever data is available (that is not an "update" and doesn't change content).

## Why the Game was black before data was switched on

To be confirmed as the first step: the Game screen and its pictures are only saved to the phone the first time they are actually opened, and the app currently re-downloads content on every open with data. So the first offline Play had nothing saved yet (black), and turning data on fetched the missing pieces. The fix is to download everything up front instead of on first use.

## Steps

1. Confirm the cause in an offline browser test: install, go offline before ever opening Play, open Play, and list which files fail.
2. Build the "complete download" step: save the whole app (all screens, including Game and Smartboard pieces, fonts, surface pictures, reward art, sounds) plus every added school's content and media; report real progress; mark the device "ready" only at 100%.
3. Show the loading screen on first open until ready; block opening activities before then (with a retry if data drops).
4. Stop automatic content refreshing on open; add the Update button, "Last updated" date, and safe swap (keep old copy until the new one is complete).
5. Download a newly added school immediately.
6. Test: first open with data → 100% → airplane mode → close and reopen → Practice and Play (Game must show its real background and writing) → results saved; then Update with a changed activity.

## Technical details

- `AcademiaApp.tsx`: remove the auto `refresh()` on mount/`online`; keep `syncAttempts`. New `kv` keys: `readyVersion`, `lastUpdated`. First-run gate renders a `GameLoadingScreen`-style component until `readyVersion` is set.
- New `src/lib/offline/fullDownload.ts` (pure progress helpers + tests): fetch pack → stage in a temporary `kv` key → `prepareOffline` media → warm app chunks → commit catalogue + `readyVersion` atomically. Failure leaves the previous catalogue intact.
- App chunks: the Game/Smartboard routes are lazy chunks; ensure the worker precache finishes (`navigator.serviceWorker.ready` + check the precache) and additionally warm lazy imports (`import()` of `ImaginePlayPage`, `PresentationView`, `OfflineActivity`) during the download. Verify the precache size limit (8 MB) isn't excluding a large chunk.
- `vite.config.ts`: change `academia-pack` from NetworkFirst to CacheFirst-only-when-offline semantics is unnecessary once the app no longer auto-fetches; Update calls with `cache: "no-store"`. Switch `registerType` to `prompt` so a new app version installs only on Update (Update calls `registration.update()` then `skipWaiting`).
- Tests: progress milestones, "no auto-update on open", "failed update keeps old catalogue".
