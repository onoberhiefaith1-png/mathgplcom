# Stability Recovery Plan

## Goal
Restore reliable navigation, session continuity, page loading, and AI generation without resetting or deleting user work.

## Confirmed problems

- The app-level Back handler removes two history entries for one Back action, causing users to become trapped or sent to the wrong fallback page.
- Several student and class course pages can remain on a spinner forever when authentication or data loading fails.
- Protected student pages repeat their own session checks after the shared authentication guard has already approved access. Recent backend logs confirm rejected session lookups during the reported period.
- Session restoration has no timeout or recovery path, so a delayed request can hold the whole protected app on a full-screen loader.
- AI generation calls have no client or server timeout. The lesson generator can perform many sequential AI correction calls, so one delayed request can freeze the generating state for a long time.
- The hosted backend is currently healthy, and recent database query timings do not indicate a general database outage. Restarting it would add downtime without addressing these application faults.

## Implementation

### 1. Repair navigation and escape routes
- Correct the navigation-history tracker so one Back action removes exactly one entry.
- Preserve a safe role-appropriate fallback when no genuine browser history exists.
- Verify Back behavior from student class, course, SmartBoard, and login-return flows.

### 2. Stabilize authentication and session restoration
- Give initial session restoration a bounded timeout, error handling, and one controlled retry.
- Distinguish a confirmed sign-out from a temporary session/network failure before redirecting to login.
- Use the shared authentication provider as the single source of truth in protected pages instead of immediately repeating `getUser()` checks.
- Preserve the requested destination through login and return the user there only after the session is ready.

### 3. Eliminate endless page loaders
- Wrap the complete loading lifecycle of Class Courses, Student Courses, and Course Runner in `try/catch/finally`.
- Apply the same failure-safe pattern to the existing student class, report, assignment, lesson-note, game, and adventure loaders that currently lack a complete error exit.
- Replace indefinite spinners with a clear error state offering Retry and Back/Home actions while keeping already loaded content intact where possible.
- Prevent state updates after navigation or component unmount.

### 4. Put hard limits around AI generation
- Add a reusable timeout wrapper for lesson-note AI, scanning, floating-number generation, editing, and geometry generation.
- Add server-side time budgets to AI gateway requests and to the multi-round validation/correction loop.
- Stop further correction rounds when the remaining time budget is insufficient and return the best valid result available.
- Ensure every generating/busy flag resets in `finally`, with Retry or Cancel available after timeout.
- Process multi-image scans with bounded concurrency instead of an unlimited serial wait.

### 5. Contain background work
- Time-limit notebook document synchronization so one stalled sync cannot hold multiple notebook views.
- Cancel or ignore late AI and data responses when the user changes route, closes the editor, or starts a newer request.
- Keep optional geometry generation non-blocking and prevent it from modifying a section after that section has changed.

### 6. Verification
- Test signed-out, active-session, expired-session, refresh, login-return, logout, and browser/app Back flows.
- Test all affected student routes with successful, rejected, and intentionally delayed requests.
- Test lesson generation, AI edit, scan, floating numbers, and geometry with forced timeout/failure conditions; confirm the UI always becomes usable again.
- Check desktop, tablet, and phone layouts for blank overlays or navigation elements that block interaction.
- Recheck runtime errors and authentication/backend logs after the fixes.

## Technical notes

- No data reset, table deletion, or backend restart is planned.
- Existing course, class, notebook, progress, and account records remain unchanged.
- Changes will be limited to navigation, authentication lifecycle, loading/error handling, request cancellation/timeouts, and stability verification.