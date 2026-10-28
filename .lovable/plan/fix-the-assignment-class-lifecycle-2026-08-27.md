# Fix the Assignment → Class lifecycle

## Confirmed cause

The active/previous lifecycle is split across two records:

- The teacher’s deadline is saved on the child `assessments` rows.
- Duplicate prevention is controlled by the parent `learning_assignments.status`.
- The existing expiry helper checks only the parent deadline, is not called anywhere, and therefore never archives parents whose child deadline has passed.

This leaves an expired assignment marked `active`, so both the Assign dialog and the database uniqueness guard continue to block a fresh assignment instance. Current database rows confirm this state exists: active parent instances with no parent deadline and already-expired child deadlines.

## Implementation

1. **Make expiry reconciliation authoritative**
   - Update the lifecycle helper to determine an assignment instance’s effective deadline from its linked assessment rows when the parent deadline is absent.
   - Archive each expired parent through the existing archive path so its child rows receive `unassigned_at`, while questions, board work, grades, progress, reports, and results remain stored.
   - Keep the archived parent immutable as the historical assignment instance.

2. **Release reassignment before duplicate checks**
   - Reconcile expired instances before `ensureAssignment` and before the Assign dialog calculates checked classes.
   - An active instance still blocks duplicates; an expired or teacher-unassigned instance does not.
   - Reassigning creates a new `learning_assignments` parent and new active assessment rows rather than reviving or overwriting archived history.

3. **Keep parent and child deadlines synchronized**
   - When the teacher changes an assignment end date/time, update both the linked active parent instance and its child assessment rows.
   - Preserve the existing student edit lock and deadline behavior.

4. **Add Active and Previous Assignments views**
   - Reconcile expiry when the teacher opens the class Assignments page.
   - Keep current cards in the active section.
   - Add a `Previous Assignments` section sourced from archived instances, including expired and manually unassigned history, with clear archived reason/date and read-only access to historical results.
   - Ensure historical instances are keyed by assignment-instance ID so repeated use of the same lesson note appears as separate runs.

5. **Protect all existing behavior with tests**
   - Active duplicate assignment remains blocked/idempotent.
   - Expiry archives the old instance and releases the same class for reassignment.
   - Manual unassignment also releases reassignment.
   - Reassignment creates a fresh active instance while the old instance and its student work/results remain unchanged.
   - Active and Previous dashboard grouping does not combine separate runs of the same notebook.

## Technical scope

- Primary code: assignment instance lifecycle, assignment pipeline, Assign dialog, class Assignments page, and focused lifecycle tests.
- Database structure and existing uniqueness rules remain intact; no records are deleted.
- Existing grading, student access, timer/expiry lock, live evaluation, and report calculations are not redesigned.
