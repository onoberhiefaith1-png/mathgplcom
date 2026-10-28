## What changes

**The link**
- Session Code and Join Link are always built from the public site address, never the internal preview address, so the link you copy in the preview is the same link a student can open.
- The link field shows the whole link, is selectable, and selects itself on click so it can be copied by hand if the browser blocks the button.

**Copy**
- Copy tries the clipboard API and, when the browser blocks it, falls back to a hidden-selection copy. Only a genuine failure shows a message, and it then says to select the link and copy it manually.
- Same behaviour for the Session Code, the session dashboard link and the Audience page invite link, so all three copy controls behave identically.

**Entering without an account**
- Opening `/live/join/CODE` resolves the code and goes straight into the session for a visitor with no account — no sign-in page, no join form, no class join request.
- If free entry is off, the visitor sees the waiting screen instead of an error.
- If the code cannot be resolved, the message distinguishes "this room does not exist" from "the room is not open yet".

## Technical notes

- Move `publicOrigin()` out of `src/lib/smartcards/smartCards.ts` into a shared `src/lib/links/publicUrl.ts` (re-exported so Smart Cards keep working) and add `joinUrl(code)`.
- Add `src/lib/clipboard/copyText.ts`: clipboard API, then `document.execCommand("copy")` on a temporary textarea, returning success so callers can toast correctly.
- Use both in `src/pages/live/CreateSessionPage.tsx`, `src/pages/live/SessionDashboardPage.tsx` and `src/pages/live/SessionAudiencePage.tsx`.
- `src/components/live/JoinSessionPanel.tsx`: for a visitor with no account, resolve the code and navigate to `/live/s/:id`; never create a `class_join_requests` row; keep the existing signed-in behaviour unchanged.
- Anonymous code lookup and open-session reads depend on the grants already staged in this draft (`anon` select on `sessions`, `anon` execute on `lookup_session_by_code`). They apply when the draft is accepted, so the guest link is fully verifiable only after that; the copy behaviour and link shape are verifiable now.
- Unit test for the code/link builder and the copy fallback; browser check of the copy button and the guest route.
