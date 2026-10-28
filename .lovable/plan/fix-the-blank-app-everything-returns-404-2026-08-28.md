# Fix the blank app (everything returns 404)

## What's happening

The app isn't broken in code — the running preview server is in a bad state. Every URL (`/`, `/home`, `/index.html`) currently answers with an empty `404`, with no page HTML and no errors logged. The server log's last entry is a forced full reload triggered by a `tsconfig.json` change at 16:33; after that reload the server stopped serving pages while still accepting connections. No runtime errors and no console errors were recorded, and the route tree file is intact and up to date.

## Plan

1. Restart the preview server process and wait for the port to answer again.
2. Re-request the homepage and confirm real HTML comes back with a `200` instead of an empty `404`.
3. Spot-check a couple of other routes (a dashboard route and a Speed Builder / lesson-note route) so the whole app is confirmed reachable, not just the homepage.
4. Check the fresh server log for startup errors that the earlier bad state was hiding.

## If the restart doesn't fix it

Then the 404s come from the server entry, not the stale process, and the next step is to verify the SSR entry chain (`src/server.ts` → TanStack server entry) and the route-tree regeneration, and fix whatever the fresh startup log reports. No source changes are made unless that log points to one.

## Notes

No lesson-note, floating-number, or Speed Builder logic is touched by this work.
