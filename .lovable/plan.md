# Application Stability & Self-Recovery

## What I checked first

- The live browser log from your session shows `THREE.WebGLRenderer: Context Lost.` — the 3D building/graphics context is being dropped. The homepage scene already tries to recover, but 3D surfaces elsewhere (3D geometry, adventure scenes, building archive, model viewer) have no loss handling, and a dropped context can leave a page painted but dead.
- No JavaScript runtime errors were recorded, which fits "the screen is alive but nothing responds" rather than a crash.
- The app runs a large number of repeating background timers (3–4 second pollers on smartboard state, evaluation panel, class join panels, adventure sync, admin refresh, plan gateway, smart cards, plus per-frame animation loops). Each page that opens creates more work; if any of them survives leaving the page, the browser gets progressively busier until it stops responding.
- Around 25 live-subscription sites and ~29 full-screen overlay layers exist. Either one is capable of producing the exact symptom (invisible overlay swallowing every click, or subscription/timer build-up).

The plan therefore starts with measurement, not guessing, then installs the protections you asked for.

## Stage 1 — Find the real freeze (before any "fix")

- Add a development-only instrumentation layer that counts, per page visit: live subscriptions, timers/intervals, animation loops and event listeners currently alive.
- Add a long-task detector that records when the interface is blocked for more than ~200 ms and what was running at that moment.
- Walk the app repeatedly (open/close Smartboard, lesson notes, floating number, test board, adventure, homepage 20 times) and read those counters. Anything that grows instead of returning to its starting number is a leak and gets fixed at its source.
- Record whether clicks are being eaten by an overlay: report the topmost element under the pointer when a freeze is observed.

## Stage 2 — Fix what the audit finds

- Every timer, interval, animation loop, listener and live subscription gets a matching cleanup, keyed so a page can only ever hold one of each.
- Pollers pause when the tab or page is hidden and resume on return, instead of running forever in the background.
- Repeating render loops with unstable dependencies get stabilised so they stop re-subscribing on every render.
- Heavy per-keystroke work (math checking, layout passes, large state rewrites) moves off the typing path.

## Stage 3 — Graphics context safety

- One shared recovery behaviour for every 3D surface: on context loss, pause the scene, show the static frame, wait for restore, then resume — never a dead canvas, never a reload loop.
- Only one 3D scene stays active at a time; scenes stop rendering when off-screen or when their page is left.

## Stage 4 — Never a permanent "Loading…"

- Route every remaining data call through the existing timeout + retry + friendly-message helper so no request can hang forever.
- Any screen that waits gets three outcomes only: content, or a small inline retry, or a recovered result — no full-screen spinner without an exit.
- Late responses from an abandoned request are discarded instead of overwriting current state.

## Stage 5 — Watchdog and silent recovery

- A single background heartbeat checks: network reachable, live connection joined, no stuck operation older than its budget, session still valid.
- On a problem: reconnect with increasing delays, re-fetch the latest server state, reconcile it with what is on screen, continue. No page refresh.
- The only thing you see is the small existing status chip: "Reconnecting…" then "Connection restored". Technical text stays in the logs.

## Stage 6 — Work is never lost, context is never lost

- Active work (current question, solution, line, marks, evaluation, board state, session) is checkpointed locally as you go, debounced to the server, and restored after any recovery or manual refresh.
- Recovery returns you to where you were — Test Smartboard returns to Test Smartboard, lesson to lesson, floating number to floating number — never to the waiting/building screen.
- Duplicate protection: each important operation carries one identity, so a double click or a retry can never create a second record (same rule that fixed the duplicate-key screen).

## Stage 7 — Smartboard stays responsive

- Evaluation, marking, AI editing and synchronisation run beside the board, never in front of it. Writing, typing, checking and navigation stay usable while they run, with a per-operation cancel.
- Component-level recovery boundaries: a failing panel recovers itself and the rest of the board keeps working.

## Acceptance tests

1. Write on the Smartboard while clicking repeatedly — no freeze.
2. Start evaluation, keep writing — board stays responsive.
3. Open and close each heavy page 20 times — subscription/timer counters return to baseline, no slowdown.
4. Cut the network — automatic reconnect and resync, no refresh needed.
5. Fire the same operation several times fast — one record, no lock.
6. Leave and return to Test Smartboard — fresh sitting.
7. Force a failing request — silent retry, work intact.
8. Manual refresh — returns to the same route and context.

## Technical notes

- Reuses existing `resilient()`, `withTimeout`, `singleFlight`, `localDraft`, and `useConnectionStatus` rather than adding a new framework.
- New pieces: a subscription/timer registry with leak counters, a long-task + freeze reporter (development only), a shared WebGL context-recovery hook, a watchdog heartbeat service, and a central app-context store (route, lesson, question, session, board, unsaved state, connection).
- No automatic page reloads anywhere; the existing stale-chunk recovery stays as the single exception.
- No data reset, no schema deletion, no backend restart.
