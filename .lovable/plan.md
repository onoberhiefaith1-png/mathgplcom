# Fix "Copy to phone" and Download on every device

## What the photo shows
The iPhone opened Academia as a bare page with no styling and stuck on "Opening...". The live site itself is fine: I fetched mathgpl.com/academia-app as an iPhone and its styling file loads normally (checked today). So the phone is being handed an **old saved copy** of the Academia page. That old copy points to styling and code files that no longer exist after the latest updates, so nothing loads.

Why: Academia saves its page on the phone for offline use. When the connection is slow (over 3 seconds), it shows the saved page instead of waiting. After each update the old files are deleted, so the saved page breaks. This hits Copy to phone and the installed app the same way, which matches what you saw. I have not reproduced it on a real iPhone; the first build step confirms it.

## Fixes
1. **Saved page and its files stay together.** The offline app keeps the files the saved page needs until a newer page has fully replaced it, so a saved page can never point at missing files.
2. **Online means the fresh page.** With internet, Academia waits longer for the live page instead of jumping to the saved copy after 3 seconds. The saved copy is only used when there is really no connection.
3. **Self-repair.** If Academia ever opens without its styling or stays on "Opening..." for too long, it clears its own broken saved copy once and reloads the live page. Saved schools and student results are kept.
4. **Copy to phone flow checked per device:**
   - iPhone/iPad (Safari): the page opens styled, then shows Share, Add to Home Screen, Add.
   - iPhone in Chrome/WhatsApp: shows "open in Safari" with copy link.
   - Android: install prompt or Add to Home screen.
   - Windows/Mac: browser install button.
5. **Download checked per device:** Android APK, Windows zip and both Mac zips each answer with the right file and size. iPhone keeps "Use Copy to phone".

## Verification
- Test on a simulated iPhone: open once, publish a change, open again over a slow connection. It must load styled, not bare.
- Tests for the self-repair rule and the download list.
- After you approve publishing, re-test on your iPhone. If it is still stuck, open mathgpl.com/academia-app?sw=off once to clear the old copy.

## Technical details
- `vite.config.ts` workbox: keep `cleanupOutdatedCaches` but stop caching navigations with a short `networkTimeoutSeconds: 3`; raise it and cache the HTML only together with its precache revision (or fall back only when `navigator.onLine` is false / fetch fails).
- `prepareOffline.ts` "academia-pages": store the HTML alongside the current build id; on activate, drop saved pages whose build id differs.
- Boot watchdog in `AcademiaApp`/root: if the stylesheet is missing or hydration does not finish in ~8s, unregister `/sw.js`, delete only `academia-pages` and precache, reload once (sessionStorage guard against loops). IndexedDB is not touched.
- Playwright WebKit iPhone profile for the end-to-end check; curl HEAD checks for every release URL.
