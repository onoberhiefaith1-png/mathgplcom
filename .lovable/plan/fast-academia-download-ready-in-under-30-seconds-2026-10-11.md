# Fast Academia download (ready in under 30 seconds)

## Goal
With internet, the Academia app becomes usable offline in about 30 seconds and never more than one minute. Big videos stop blocking the student.

## Why it is slow now
- Every file is downloaded one at a time, so each one waits for the one before it.
- Large teaching videos (up to 300 MB each) are part of the "must finish" list, so the bar sits for minutes.
- A slow or stuck file is retried three times with no time limit.
- When no school is added yet, every public school's media is downloaded.
- The app waits up to 60 seconds for the whole app bundle before content even starts.

## New approach: two stages

```text
Stage 1  "Essentials"  (target under 30 s, blocks the Ready screen)
  app page + app files, castle background, writing-surface frames,
  fonts, Game sounds, the schools' content, activity pictures,
  each Game's background picture
        -> "Ready - works offline" shown

Stage 2  "Videos"  (background, never blocks)
  teaching videos and Game background videos
        -> small per-video badge: "Saved offline" / "Downloading 40%"
```

## What changes
1. Parallel downloading: 6 files at the same time instead of one by one.
2. Each file gets a 15-second time limit; one quick retry; then it moves on.
3. Essentials only include the student's added schools (or none of the media when nothing is added yet - only the app, castle and frames).
4. Files already saved are skipped instantly, so Update only fetches what changed.
5. App-file wait is shortened: content download starts in parallel while the app finishes saving.
6. Ready is truthful for Stage 1 only. If an essential failed, the student sees Retry for that item; videos never cause a failure.
7. Offline, a video not yet saved shows the castle/still picture instead of a black screen; it plays once saved.
8. Progress shows real numbers: "Essentials 12 of 18" then "Videos 1 of 3 (in background)".

## Testing before you publish
- Automated tests for: the essential/video split, parallel limit, time limits, and that Ready never waits on videos.
- A timed run in the sandbox browser against the published-style build, with a throttled connection, recording how long Stage 1 takes (pass = under 30 s).

## Technical details
- `src/lib/offline/prepareOffline.ts`: split `mediaToSave` into `essentialMedia` / `videoMedia`; add a concurrency pool (6), `AbortController` 15 s timeout, single retry, `media.match` skip.
- `src/lib/offline/fullDownload.ts`: run `workerReady` and pack fetch concurrently; stage percentages (essentials 0-100, videos reported separately); background video task continues after Ready, stored in kv per URL.
- `src/pages/academiaApp/AcademiaApp.tsx`: two-line progress, background-video status.
- `ImagineBackground` / Session video: fall back to poster when cached video missing offline.
- `vite.config.ts`: keep precache limited to app files (no large media in precache).
