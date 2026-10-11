# Verify the offline Academia app from my end

## Goal
Prove, before you publish, that the Academia app downloads fully, then opens and plays with no internet — so you don't have to publish-and-check each time.

## What I can and cannot test here
- I CAN test in this sandbox: a headless browser (Chromium) that loads the app, runs the full download, then goes offline (network switched off) and reloads — checking the page opens, the Game shows its background, writing surfaces and text, and Practice/Play work.
- I CANNOT fully reproduce an iPhone home-screen app (iOS Safari's storage rules differ), but the service-worker caching logic is the same code path, so a pass here catches the failures you saw (blank surfaces, "no internet" on relaunch, missing background).

## Plan
1. Build a production copy of the app locally and serve it (service workers only run on production builds, not the dev preview — this is why the preview alone can't prove offline).
2. Drive it with a headless browser script that:
   - Opens `/academia-app`, runs the full download to 100%, and confirms the readiness marker is only set when every asset truly saved.
   - Switches the browser offline, fully closes and reopens the page, and checks: app opens with no "no internet" message, castle background visible, writing-surface frames render (no "?" boxes), question and solution lines visible, Floating Numbers present.
   - Opens Practice and Play offline and screenshots both.
3. Verify the cache contents directly: confirm the app shell, fonts, surface frame images, castle fallback, and Game asset URLs are all in Cache Storage after download.
4. Fix anything that fails and re-run until the offline reload passes cleanly.
5. Report exactly what passed, with screenshots, so your one publish-and-check on your phone is a confirmation, not a test.

## Technical details
- Serve a `vite build` output locally with a static server on localhost (service worker registers because localhost is a secure context).
- Playwright `context.setOffline(true)` simulates no data; a fresh browser context simulates a full app restart.
- Assert on Cache Storage entries and on rendered pixels (screenshots), not just "no errors".
- No changes to normal online Game/Practice behavior; fixes only touch offline caching and fallback paths if a failure is found.
