# Fix the Guest Link duplicate-key error

## What is actually happening (verified)

- The Guest Link dialog calls `ensureGuestLink` in an effect: it first looks for an existing link, and only inserts when none is found.
- The database has a global uniqueness rule on (kind, resource id, class), which is exactly the constraint named in the error.
- A guest link for this assignment card **already exists**, created at 20:13:44 — seconds before the 20:14 error. Only one row exists, so the failing click was a second insert attempt for the same card while the first one was still in flight (the dialog effect can run twice, e.g. re-open/remount), so both attempts saw "no link yet" and both tried to create one.

So the link itself is fine; the code just doesn't handle "someone/something already created it".

## Fix

1. **Make link creation collision-proof** in `src/lib/guests/guestLinks.ts`
   - Attempt the insert; if the database reports a duplicate (unique violation), immediately re-read the existing link and return that instead of surfacing an error.
   - Same handling for the rare case of a duplicate short code: retry with a new code a couple of times.
   - Keep the existing "find first, reuse forever" behaviour — one link per card, never a new link per guest.

2. **Stop concurrent creation attempts**
   - Cache the in-flight promise per (kind, resource, class) so two simultaneous calls share one result rather than racing.

3. **Handle links owned by someone else**
   - Read access is restricted to the link's owner, so a card whose link was created by another teacher would look "missing" and hit the same wall. Add a clear, plain-language message in the dialog for that case ("A guest link for this card already exists and belongs to another teacher") instead of showing raw database text.

4. **Never show raw database errors in the dialog**
   - The dialog maps failures to readable messages, with a Retry action.

## Verification

- Open the Guest Link dialog on the assignment card in the screenshot: it shows the existing link (`/a/<code>`) with no error.
- Open, close and re-open rapidly, and open the same card twice: still one link, no duplicate-key error.
- Copy the link and confirm it opens the assignment card with no sign-in.
- Confirm a fresh card still creates its link on first open, and the Guest Link on a course card is unaffected.
- Typecheck plus the existing guest-link tests.

## Technical notes

- Files: `src/lib/guests/guestLinks.ts` (duplicate-safe create, in-flight de-duplication), `src/components/guests/GuestLinkDialog.tsx` (friendly error mapping + retry).
- No schema change, no migration, no change to guest attempt/marking data.
