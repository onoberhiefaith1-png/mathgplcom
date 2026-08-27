## Guest experience after the fix

1. Open the link (or type the code) — no sign-up, no sign-in.
2. If the teacher asks for names, one name field; otherwise straight in.
3. The session home shows exactly four tiles: **Notes**, **SmartBoard**, **Challenge**, **Game Challenge**.
4. Nothing else on the platform is reachable — no dashboard, no other class, no history.
5. At the bottom: **Visit MathGPL — Mathematics Reimagined**, which now leads to the sign-in page so a visitor can become a member.

## Technical work

**Staged migration (applies when this draft is accepted)**

- Grant anonymous `SELECT` on `public.sessions` and add a policy that exposes a session row only while its status is `published` or `live`, independent of the `visibility` flag — the link itself is the credential.
- Grant anonymous `EXECUTE` on `lookup_session_by_code` so the code path resolves for guests, and keep it returning only `id`, `title`, `class_id`, `status`.
- Keep the already-staged `allow_free_entry` column, `session_audience` roll, helper functions and scoped read policies from this draft in one applied set.

**App changes**

- `SessionDashboardPage.tsx` — Free Entry icon-toggle in the header beside the Join Link/code, calling the existing `setAllowFreeEntry`; label states "Free entry on / Approval required". Same control stays on the Audience page.
- `JoinSessionPanel.tsx` — for a guest, resolve the code and navigate to `/live/s/:id`; when free entry is off, land on the waiting state instead of creating a class join request (guests never become class members).
- `useAudienceAccess.ts` / `AudienceShell.tsx` — distinguish "session genuinely missing" from "not readable"; only show "Session unavailable" for a real miss, and surface a plain message when the session has ended or has not opened yet.
- `AudienceShell.tsx` footer — point **Visit MathGPL** at the sign-in page.
- Head metadata on the guest routes stays session-appropriate; no dashboards leak into the audience routes.

**Verification**

- Anonymous browser run: open a live session link with no session, confirm entry, the four tiles, Notes and SmartBoard reads, and the footer link reaching sign-in.
- Toggle Free Entry off, re-open in a fresh anonymous context, confirm the waiting screen and that approval from the Audience page admits the visitor without a reload.
