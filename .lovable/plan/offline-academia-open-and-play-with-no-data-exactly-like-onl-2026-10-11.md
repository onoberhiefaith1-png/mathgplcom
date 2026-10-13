# Offline Academia: open and play with no data, exactly like online

## Honest review of the previous plan

The earlier plan would have only partly worked. Checking the code shows why the phone screen looked like your screenshot:

1. **Writing-surface frames and the castle picture are never saved.** They're hosted as remote assets (`/__l5e/assets-v1/...`), not as app files. The offline saver ignores them because it only saves files it marks as offline media, and the Game's own frame pictures aren't on its list. When you're offline they come up as broken pictures, which are the `?` boxes in your screenshot. Adding a fallback picture alone would not fix this.
2. **The app's start page isn't saved as a real offline start page.** Page loads always try the internet first, and nothing guarantees a fallback copy exists. After you closed the app, iPhone asked the internet for the page and showed "No internet".
3. **"100% Ready" can be wrong.** The download marks itself ready even if the app files never finished saving or some media failed to save.
4. **The text is missing because the Game page broke partway through loading**, after its pictures and fonts failed. Fix 1 and Fix 2 remove that cause. We will still test it, not assume it.

Real offline games (Temple Run, etc.) work because **every file they need is bundled inside the app**. We'll do the same. Everything the Game needs to draw itself gets bundled, not fetched.

## The method

### 1. Bundle every Game look file inside the app
- Copy all writing-surface frame pictures, the castle default background, reward and coin artwork, sounds the Game uses, and fonts into the app's own files, so they install with the app.
- Point the Game at these local copies. Online the Game looks and plays exactly as it does now, since it's the same pictures served from the app.
- A build check fails if any Game picture still points to a remote address, so this can't come back.

### 2. A real offline start page
- Save a complete start page for the offline app when it installs, and always serve it when the phone has no data, whether it's the first screen or a reopen after you swipe the app away.
- The app then reads the saved Academias and your work from the phone's storage, so it never needs the internet to open.

### 3. Truthful download: ready only when everything is really saved
- First online open shows one "Downloading for offline" screen. It waits until:
  - every app file is saved (checked file by file, not assumed),
  - the start page is saved,
  - every Session's content, activity images and teaching videos are saved.
- Before showing 100% Ready, it checks every saved item is really there. If something is missing, it retries and then shows "Some items didn't download, tap Retry". It never shows a false Ready.
- It asks the phone to keep the storage permanent, so iPhone is less likely to clear it.

### 4. Frozen until Update
- Nothing changes on the phone until the student taps **Update**. Update downloads the new copy in full, checks it, and only then replaces the old one, so a dropped connection never leaves a half copy.

### 5. Authored backgrounds
- The castle shows straight away, every time. A teacher's own background or video goes on top once it's saved on the phone. If it isn't saved yet, the castle stays.

## How we'll prove it before telling you it's done
- An automated phone test: install, download to 100%, cut the network, close the app completely, reopen it, then open Practice and Play.
- Screenshots must show the castle, the framed writing surfaces with their text, line 1, the Floating Numbers and a marked line, with zero broken pictures.
- After that, you do a final check on your iPhone in airplane mode after publishing.

## Limits to know
- YouTube videos can't play offline. Videos uploaded to MathGPL can.
- iPhone may still clear a website app's storage if the phone runs very low on space. The permanent-storage request makes that much less likely. The only full guarantee is the App Store build, which already exists as a next step.
- The app download gets bigger, by roughly the size of the pictures and fonts, a few MB.

## Technical details
- Move `src/assets/imagine/surfaces/*.webp`, the default background and the Game reward/sound assets the Imagine player uses from `.asset.json` pointers to real files under `public/offline-game/` (downloaded once). Update `surfaceSkins.ts`, `defaultBackground.ts` and the reward/sound lookups to use those paths. Workbox precache picks them up automatically. Add a vitest that scans the Imagine and offline modules for `/__l5e/` URLs.
- `vite.config.ts`: add `/academia-app` as a precached shell (additionalManifestEntries with a revision), plus a navigation route for `/academia-app*` that uses NetworkFirst with a cached-shell fallback instead of `navigateFallback: null`. Make sure the shell boots from the client only (no SSR data needed).
- `fullDownload.ts`: fail if `workerReady` times out. Check that `caches.match` works for every precache entry and every saved media URL. Treat any skipped item from `prepareOffline` as incomplete. Call `navigator.storage.persist()`. Bump to `readyAt.v4` so existing installs download again.
- `prepareOffline.ts`: return detailed per-item results and retry failures twice.
- Playwright script with `context.set_offline(True)` and a fresh page reload to simulate a cold launch, then assert there are no failed image requests and that the surface frames have loaded `naturalWidth`.
- Game/Smartboard runtime and the online look stay unchanged. Practice stays on the Smartboard, Play stays on the Game.
