# Sign out only after 15 minutes away from MathGPL

## What changes

Right now the 15 minutes counts from your last tap or keystroke, so leaving MathGPL open on screen without touching it eventually signs you out. That is wrong.

New rule: the clock only runs while MathGPL is **not** the page you are looking at.

- MathGPL visible on screen — the countdown never runs, no matter how long you sit still. No warning, no sign-out.
- You switch to another tab or app, minimise the browser, or the screen/laptop turns off — the clock starts at that moment.
- You come back within 15 minutes — the clock resets to zero and nothing happens.
- You come back after 15 minutes (or reopen the browser later) — you are signed out and land on the sign-in page with the short explanation.

Public pages (shared challenge links, guest and join flows) stay untouched, since there is no account to sign out of.

## Warning message

Because nothing counts while you are watching the page, the "you will be signed out shortly" warning is no longer useful and is removed. Returning after the limit simply shows the sign-out message on the sign-in page.

## Technical notes

In `src/lib/auth/useIdleSignOut.ts`:

- Replace last-user-activity tracking with a hidden-since timestamp. On `visibilitychange`/`blur` to hidden (or `pagehide`), store `mathgpl.hiddenSince = Date.now()` in localStorage; on becoming visible, clear that key and reset state.
- The interval check only measures elapsed time when `document.visibilityState === "hidden"`; when visible it does nothing.
- On mount (covers browser reopened or laptop resumed), if `hiddenSince` exists and `Date.now() - hiddenSince >= 15 min`, run the existing `signOut({ reason: "idle" })` path immediately.
- Keep cross-tab behaviour: only sign out when **no** tab is visible — a tab becoming visible clears the shared key, so other hidden tabs stop counting.
- Drop the pointer/key/scroll listeners, the throttle, and the 60-second warning toast; keep the same sign-out routine, message copy, and public-path exclusions.
