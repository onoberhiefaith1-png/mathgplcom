# MathGPL Access, Reliability & No-Single-Point-of-Failure

## What the audit actually found (checked live, just now)

Good news first: **the domain and certificates are healthy**, so this is not a broken deployment.

- `mathgpl.com` and `www.mathgpl.com` are both **connected and active** (12 days in that state, bought through Lovable).
- Valid certificates issued by **Google Trust Services**, hostnames match exactly, valid **8 Aug 2026 → 6 Nov 2026** (not expired, auto-renewing).
- `http://mathgpl.com` → `https://mathgpl.com` (301). `www` → root (302). Both resolve to the correct Lovable IP `185.158.133.1`. No conflicting or stale records found.
- HTTPS returns **200 OK** from outside.

So the browser warning you saw is **not** caused by our certificate. The evidence points to **network-level HTTPS inspection**: the same FortiGuard system that blocked `https://mathgpl.com/` as "Unrated" also intercepts HTTPS and re-signs it with its own certificate. The browser then correctly reports "this may be impersonating mathgpl.com". That is why it happened in three browsers on that network and not on the open internet. It is an external filtering policy on a new domain, not a MathGPL fault — and it is fixed by domain classification, not by code.

What is genuinely missing on our side is **everything that tells us when something breaks, and everything that protects a teacher mid-lesson**: there is no health endpoint, no uptime/certificate monitoring, no connection or save indicator, no offline draft protection, and crash isolation exists only at the router root — so one broken panel can blank a whole page.

## Plan

### A. Domain trust and classification (no DNS changes needed)
- Submit legitimate reclassification requests for `mathgpl.com` to FortiGuard and the other major web-category services (Google Safe Browsing check, Cisco/Umbrella, Netcraft), and document the process so it can be repeated. No filter bypassing of any kind.
- Strengthen the signals classifiers look for: security headers (HSTS, referrer policy, permissions policy, frame options), unique per-route titles/descriptions, a real favicon and app identity, and clearly linked Privacy, Terms, Refund and Contact pages from the homepage footer (these pages already exist).
- Add a short internal runbook: what to do when a school reports a block, including the reclassification links and the wording to give a school IT administrator.

### B. Health checks and monitoring
- Public `/api/public/health` returning **healthy / degraded / critical** per service (frontend, database, auth, storage, AI) with response times, plus a human-readable `/status` page that keeps working when the app's data layer is failing.
- Certificate and uptime watch: a scheduled check on the live domain reporting HTTP status, redirect behaviour, response time and certificate days-remaining, escalating at 30 / 14 / 7 / 3 / 1 days, surfaced in the admin console.
- Point an external uptime monitor at `/api/public/health` so an outage is reported even when the app is completely down (this one step is done outside the app; the endpoint is what makes it possible).

### C. One failure must not take down the platform
- Per-feature error boundaries around Co-Pilot, Geometry, Charts, Adventure, Game Builder, Slides and Analytics, so a crash in one shows a small inline "this panel couldn't load — retry" card while the lesson stays open and editable.
- Lazy-load the heavy modules (3D geometry, Adventure, Game Builder, analytics) so Lesson Notes opens without waiting on them.
- Asset failures (image, diagram, 3D, video) render a clean placeholder instead of breaking the surrounding lesson.

### D. Never lose a teacher's work
- Local draft mirror for the lesson editor: every debounced save also writes to local storage, keyed by note id, and is restored and re-synced after a failed save, a session expiry, or a reload.
- Explicit status pill in the editor: `Saved` / `Saving…` / `Unsaved changes` / `Offline — changes stored locally` / `Reconnecting… syncing`.
- Global connection indicator driven by real online/offline events plus health pings.
- Session expiry keeps the draft, shows "Your session has expired — sign in to continue", and restores the draft and syncs after re-auth.

### E. No infinite loading, no raw technical errors
- Every network call goes through one wrapper with timeout, bounded retry with exponential backoff, 429 respect, and cancellation on route change — reusing the existing timeout helper.
- Audit each remaining spinner so it must resolve to success, empty, error+retry, degraded or cancelled.
- Friendly mapped messages for 400/401/403/404/408/409/429/500/502/503/504, each with an action button. Technical detail goes to logs only, never to the teacher.
- Idempotency keys on generate/save/submit/approve so a double-click or retry cannot produce two lessons.
- AI unavailability shows "MathGPL Co-Pilot is temporarily unavailable. Your lesson content is safe — you can keep editing manually." and never blanks the note. Long generations report per-stage progress and resume from the last completed stage rather than regenerating everything.

### F. Verification
- Force each failure in turn — offline, slow network, Wi-Fi/mobile switching, 401/429/500/503/504, AI down, database down, refresh mid-generation, double-click generate — and confirm the app always returns to a usable state with the work intact.
- Check Safari (macOS + iOS), Chrome, Edge and Firefox on phone, tablet and desktop.

## Technical notes

- Health endpoint lives at `src/routes/api/public/health.ts` (that prefix is exempt from site auth); it performs shallow, cheap probes only and never returns internal error text.
- Error boundaries reuse the existing `RouterErrorBoundary` pattern and `reportLovableError`, added as feature-scoped wrappers rather than replacing the root boundary.
- Retry/timeout builds on `src/lib/async/withTimeout.ts`; no new HTTP client and no provider libraries are swapped out.
- AI calls already funnel through the Math Engine client and `notebook-ai`; the provider-fallback work is limited to making that single layer the only place provider choice is decided, so a future provider change needs no UI changes.
- No DNS or certificate changes are made — the audit shows the current configuration is correct and touching it would risk a real outage.
- Also fixes a live hydration error on the homepage caused by the AdSense `<ins>` element being server-rendered, and the `fetchpriority` casing warning.

## Out of scope
No change to lesson-note structure, the pedagogical standards, the Math Engine's mathematics, pricing, credits or any working feature behaviour.
