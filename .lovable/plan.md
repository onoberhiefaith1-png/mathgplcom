# Stability pass, then login and admin security

## What I verified just now

Against the running app, these pages already respond successfully: `/`, `/login`, `/signup`, `/home`, `/lesson-notes`, `/adventure`, `/community`, `/admin`. `/classes` is not a route on its own (classes live under the Teaching Hub and class workspace paths), so that 404 is expected, not a regression.

The generated route tree currently contains no duplicate route IDs. The remaining reported failures are a 500 on `/` and a failed dynamic import for an old `login-*.js` asset — the signature of a preview tab still holding a stale build manifest, plus a render-time fault on the home path that needs to be pinned down rather than swallowed by the error boundary.

## Phase 1 — Diagnose (no error-boundary masking)

- Reproduce `GET /` in a real browser session and capture the actual server-side exception from dev output instead of the boundary's message.
- Trace the home path's render chain (root route, home dispatcher, rotating building scene, providers) to find the component or loader throwing during initial render.
- Check for broken imports, missing providers/contexts, and circular imports introduced by the recent Course Builder and Class Courses work.
- Confirm which asset hashes the preview requests versus what the current build emits, to separate genuine faults from stale-chunk noise.

## Phase 2 — Restore stability

Load every listed surface independently and fix the real cause of each failure: Login, Create Account, home/dashboard, Rotating Building, Lesson Notes, Adventure, class workspace (including the new Courses area), and Community. Each must render with no runtime errors and no indefinite loader.

## Phase 3 — Login

Restore the normal Login page workflow (email, password, submit) with no blank screen, no crash, and no forced reload loop. The existing visual design stays exactly as it is.

## Phase 4 — Development-only workspace shortcut

Add a "Go to My Workspace" button at the top of the Login page, visible only when the app is running in the Lovable development/preview environment and hidden in production. Per your choice, it is a link only: it navigates to the administrator workspace when a session already exists, and otherwise leaves the normal login form in place. No credentials are stored and the login system is unchanged.

## Phase 5 — Administrator Security page

Add an Administrator Security page inside the admin console where the administrator can update their own administrator email and password and save the changes. These are real account credentials, so the updated email/password work from any browser, not only inside the editor. Changing the email sends a confirmation to the new address before it takes effect.

## Phase 6 — Preserve existing UI

No redesigns, no layout or styling changes, no component replacements. Only broken behaviour is repaired.

## Technical notes

- Expected areas of change: the home/root render chain, any loader or provider that throws or hangs, the login page (dev-only button), and a new admin security page plus its route under `/admin`.
- The dev-only button is gated on the preview/development host, not on a build flag alone, so it cannot appear on the published site.
- Administrator credential changes go through the platform's own auth account update; no new tables and no schema changes.
- Nothing is reverted or deleted: existing courses, classes, notes, and account data stay as they are.

## On your rollback suggestion

I do not recommend reverting to an earlier version here — the routes verified above are working, and a revert would drop the Course Builder and Class Courses work. If the diagnosis in Phase 1 shows a specific recent change is at fault, I will repair that change directly and tell you which one it was.
