## Technical details
- APK: verify `public/mathgpl-academia.apk` (package `com.mathgpl.academia`, matching `assetlinks.json`) launches `/academia-app` full-screen; confirm the worker precaches the shell and `readyAt.v5` flow works offline; Update button re-runs `getReady`. Rebuild the APK only if it fails the check. Add a Windows note to `DownloadAcademiaDialog`.
- Layout: rework `completionLayout(width, height)` into a two-column fit (card column + character column with fixed gap, character width capped ~26%) on wide screens and a stacked compact mode on narrow; card uses viewport-height-based sizing (clamp/`dvh`) and a compact density below ~600px height so `.game-completion` never exceeds the viewport. Same in pause/fail views of `GameCompletionScene`.
- Update tests in `src/lib/imagine/__tests__` asserting card + character never overlap and the card height fits within 962x503, 393x503 and 1280x800.
- Playwright screenshots at those sizes, online and offline, before finishing.
