# Eliminate the recurring blank-screen failure

## Verified diagnosis

- The current dev process is alive and serves Vite module files, but `/`, `/home`, and the affected Course Builder URL all return an **empty HTTP 404**. This explains the completely white page: the browser receives no application HTML, so React and the existing in-app watchdog never start.
- The server log shows Vite detected a `tsconfig.json` change immediately after startup, cleared its cache, and forced a full reload. After that reload, the TanStack request handler is no longer mounted even though the Vite process remains alive.
- A recent preview request for the affected Course Builder exercise also failed upstream with `502 Network connection lost`.
- Existing React error boundaries, SSR error HTML, stale-chunk recovery, and the stability watchdog are present, but they cannot handle this specific failure because all of them require either an application response or mounted client code.

## Implementation

1. **Make development-server recovery authoritative**
   - Add a small dev-only Vite lifecycle guard that watches configuration reloads which can detach the TanStack handler.
   - Instead of allowing the process to remain alive while returning empty 404 responses, terminate it once with a non-zero status so the platform supervisor performs a clean restart with the complete TanStack middleware stack.
   - Debounce and guard the restart so one config change cannot create a restart loop.

2. **Broaden browser bootstrap recovery**
   - Extend stale-module detection to cover the observed Vite 504/optimized-dependency responses and failed module-script fetch variants, while preserving the existing one-retry-per-route loop guard.
   - Keep the cache-busting reload so recovery requests cannot reuse an obsolete route document.

3. **Strengthen the visible failure path**
   - Ensure router/render errors always show the existing recovery screen rather than an empty document.
   - Add a lightweight bootstrap timeout that only activates when HTML loaded but the React application did not mount, then performs one guarded cache-busting recovery before showing a plain fallback.
   - Keep this independent of application providers so provider/import failures cannot suppress it.

4. **Regression coverage and verification**
   - Add focused tests for Vite 504 detection, retry-loop prevention, and bootstrap fallback behavior.
   - Verify `/`, `/home`, the affected Course Builder exercise, `/lesson-notes`, and `/admin/integrity` return non-empty HTML and render after repeated navigation/reload cycles.
   - Simulate a configuration reload and confirm the supervised clean restart restores HTTP 200 instead of leaving an alive-but-empty server.
   - Check browser console and server logs for new module optimization, hydration, and request-handler errors.

## Technical boundary

The permanent fix belongs below the normal application watchdog: a white page caused by an empty server response cannot be repaired by React code that never loaded. The server lifecycle guard restores the handler; browser and router safeguards cover failures that occur after HTML delivery.
