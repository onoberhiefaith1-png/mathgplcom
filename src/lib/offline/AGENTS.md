# Offline Academia rules
- The offline Academia app (`/academia-app`, `src/pages/academiaApp`, `src/lib/offline`) is a login-free student app: it reads only public Academias from `/api/public/academia-pack`, keeps them in IndexedDB, marks lines on-device with the predictive engine (no AI), and queues attempts to `/api/public/academia-sync`, so it runs with no network after first load.
- The offline Academia app's install route is decided by the pure `installTargetFor` helper (iOS Safari guide, other iOS browsers -> open Safari, Android file, desktop prompt), and media it saves offline is marked `_aof=1` so only those requests are served cache-first by the worker.
- The offline Academia app fetches activity images/videos only through `/api/public/academia-media`, which serves a path only when it belongs to a public Academia activity, so offline caching gets one stable address without exposing the private bucket.
- Offline Academia uses the connected board/Game renderers; the installed app only adapts persistence, grading, cached URLs, and a bundled castle fallback beneath unavailable Game media.
- Offline Game look files (surface frames, castle) ship under `public/offline-game/` so they precache with the app.
- The offline worker precaches only the Academia shell (built `assets/*` code/fonts, `public/offline-game/`, icons), never all of `public/`; the time-boxed `getReady` download marks Ready (`readyAt.v5`) once the content list reads back, skipping late pictures, so first open finishes within a minute and later opens never wait.

- Character media uses exact references on an attached public Game through the existing media endpoint; the bundled fallback supplies local reactions without videos.
- Offline History/My Evaluation use Session attempts in IndexedDB `sessionAttempts`, built only by the pure `src/lib/offline/evaluation.ts` (start on first maths input, idempotent marks, scaled to the Session total); screens never compute scores themselves.
