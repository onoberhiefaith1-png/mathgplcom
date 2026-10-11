# Rebuild the offline Academia download: fast, one-time, then always works offline

## Goal
- On the first visit with internet, the Academia app finishes getting ready in **30 seconds or less** (never more than 1 minute).
- After that, opening it from the phone's home screen **never shows loading again**. It opens straight away, even with no data.
- The castle picture is the **default background** for every Game and Session. The teacher's own picture or video replaces it only when it is already saved on the phone.
- New content arrives only when the student presses **Update**.

## What goes wrong now (suspected, checked first)
The current offline worker tries to save the **whole MathGPL website** on the phone: every page's code, all 3D Game Pro files and every image. The "ready" check waits for all of it, which on a phone can take a very long time or never finish. This is my best guess and isn't proven yet. Step 1 measures the real download size before anything is replaced.

## The new design

```text
First open (online)                      Every later open (online or offline)
-------------------                      -----------------------------------
1. Save the small app shell (~few MB)    Open the saved shell immediately
2. Save the Academia content list        Read content from the phone
3. Save Session pictures, castle,        Castle shows straight away; saved
   writing-surface frames                pictures/videos appear on top
4. Mark READY -> open the app            No loading screen, no network wait
5. Videos keep saving in the background  "Update" button refreshes content
```

1. **Measure first.** Build the app, record how big the current offline download is and how long it takes, and confirm the cause above.
2. **Remove the old download code.** Delete the current full-download and readiness code and the "save the whole website" rule. Keep the student screens, Practice/Play players and marking.
3. **New small offline shell.** Save only what the Academia app needs: its own page, its code, fonts, the castle and the surface frames. Game Pro, the 3D files, admin and teacher screens are left out. Target size: under about 10 MB.
4. **New one-step "Get ready" download**, with a visible progress bar:
   - The shell and content list download in parallel.
   - Pictures for added schools download 6 at a time, giving each up to 10 seconds.
   - There is a hard limit of 45 seconds. Anything still missing is skipped, and the castle/placeholder covers it.
   - Ready is marked only after a real check that the shell and content can be read back from the phone.
5. **Instant later opens.** The installed app always opens from what's saved on the phone first and never waits for the internet. A quiet check may show "Update available", but nothing changes until the student presses Update.
6. **Castle default everywhere.** The castle always shows under the Game, so a screen is never black. A saved teacher background or video replaces it only once it's actually on the phone.
7. **Videos.** These save in the background after Ready, with a small "Videos: 3 of 5 saved" note. A video that isn't saved yet shows the castle and a "Needs internet" label.
8. **Update button.** Re-runs the same download for new or changed content only, then switches over in one step.

## How I'll test it before you publish
- Run an automatic phone-sized browser test against a real production build:
  - The first download finishes in under 30 seconds.
  - The browser is then switched fully offline, closed and reopened.
  - The app opens in under 3 seconds with no loading screen.
  - The castle shows, the writing surfaces and text are visible, and Practice and Play both open and mark a line.
- I'll report the measured times and show screenshots.
- A final check on your real phone in airplane mode is still needed after you publish.

## Not changing
Online Academia, the normal Game, Game Pro, Smartboard, Courses, teacher tools and how marking works.

## Technical details
- In `vite.config.ts`, the precache `globPatterns` is replaced with an explicit Academia-only shell list. The navigation handler for `/academia-app` changes to CacheFirst with a stale-while-revalidate check that only flags an update. The `_aof=1` media rule stays.
- Delete `src/lib/offline/fullDownload.ts` and the readiness and worker-wait parts of `prepareOffline.ts`. Replace them with a new `src/lib/offline/getReady.ts` that has a staged, time-boxed pipeline, a hard 45 s deadline and a read-back verification. The new readiness key is `readyAt.v5`, so old half-finished states are ignored.
- `AcademiaApp.tsx`: when the readiness key exists, render from IndexedDB with no network gate, and add a manual Update action. The castle layer stays in `ImagineBackground`.
- Update `src/lib/offline/AGENTS.md` with the new shell and readiness rules. Add tests for the time limit, skip-and-fallback, and the readiness check. Add the Playwright offline test script under `/tmp/browser`.
