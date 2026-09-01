# Fix the blank page (empty 404 from the dev server)

## What is happening

Every page — `/`, `/academy`, `/status` — currently returns HTTP 404 with an
empty body, so the browser shows a blank white screen. This is not a bug in the
Academy page or in any recent navigation change: the whole site is unreachable.

The dev-server log shows one event and nothing after it:

```text
[vite] changed tsconfig file detected: /dev-server/tsconfig.json -
Clearing cache and forcing full-reload ...
```

This is the exact failure the project already documents in `vite.config.ts`:
when Vite clears its transform cache after a tsconfig change, it does not
reinstall TanStack Start's HTML middleware, so the process looks healthy while
every document request answers an empty 404. The guard plugin
(`mathgpl-restart-after-tsconfig-change`) was added for this, but its
`[stability]` warning is absent from the log — it did not fire this time, so the
server stayed in the broken state.

## Fix

1. Restart the dev server process cleanly (the only recovery once the middleware
   is gone), then confirm `/`, `/academy` and `/academy/edit` return HTTP 200 with
   real HTML.
2. Harden the guard so this cannot leave the server wedged again:
   - also listen for `add` and `unlink` on the watcher, not only `change`
     (cache-clearing reload paths can surface as a different event);
   - additionally verify at request time — a tiny `configureServer` middleware
     that, after a recorded tsconfig invalidation, exits the process on the
     first document request that would otherwise 404 empty.
3. Re-verify the pages after the hardening, and confirm the Academy walking
   controls still render (forward / Turn around only).

## Notes

No application, route, or Academy code changes are part of this — the pages
themselves are intact. If after the restart a page is still blank, the next step
is to read the actual SSR error from the dev-server log rather than to change
page code.
