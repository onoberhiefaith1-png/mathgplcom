# Fix assignment reassignment and enforce non-overlapping lesson text

## Confirmed causes

### Assignment lifecycle

- Assignment expiry is enforced on child `assessments`, while duplicate prevention is controlled by the parent `learning_assignments.status`.
- The existing expiry helper is not invoked before assignment checks and only reads the parent deadline, so expired child assessments can leave an active parent that blocks reassignment.

### Lesson-note overlap

- Clicking blank paper currently creates a `canvasFrame` for ordinary typed content at an absolute `x/y` position.
- `canvasFrame` deliberately renders with `position:absolute`, so ordinary text, headings, generated solutions, and later flowing content can occupy the same vertical space.
- The current layout guard only separates non-diagram frames from other frames and reserves space for frames that have a linked spacer. It does not prevent an ordinary text frame from covering normal document-flow content.
- Diagrams already have a distinct `objectKind: "diagram"`, so they can remain the only overlap-capable content.

## Implementation

1. **Repair assignment expiry reconciliation**
   - Derive each active assignment instance’s effective deadline from its linked assessment rows when the parent deadline is absent.
   - Reconcile expiry before duplicate checks, Assign-dialog state, and class assignment lists.
   - Archive expired or manually unassigned instances without deleting questions, work, grading, progress, or reports.

2. **Release the class for a fresh assignment run**
   - Keep one active instance per class/notebook/mode while it is active.
   - After expiry or unassignment, create a new parent and new active child rows; never revive or overwrite the previous run.
   - Synchronize deadline changes between active parent and child records.

3. **Show current and historical assignments separately**
   - Keep active work in the current Assignment section.
   - Add `Previous Assignments` for expired and manually unassigned instances, keyed by assignment-instance ID and linked read-only to preserved results.

4. **Make ordinary lesson content participate in document flow**
   - Stop creating absolute free-position frames for ordinary typing, headings, math structures, AI-generated text, and solutions.
   - Resolve blank-paper clicks to a document insertion point in reading order so newly typed content occupies real height and naturally pushes every later text block downward like a word processor.
   - Convert or render legacy non-diagram `canvasFrame` content in flow so existing overlapping notes recover without losing their text or editable math structure.
   - Keep horizontal placement only where it can be represented safely without removing the block from flow.

5. **Keep diagrams as the sole overlap exception**
   - Preserve free drawing and free-positioned diagram frames, including the ability to place diagrams anywhere and overlap other content.
   - Ensure diagram carriers remain excluded from text-flow spacing and from text-frame migration.

6. **Regression coverage and verification**
   - Test active duplicate blocking, expiry release, manual-unassign release, fresh reassignment, and preserved historical results.
   - Test that multiline text, headings, editable math, AI output, and moved solutions increase layout height and push subsequent content down.
   - Test that old non-diagram absolute frames recover into flow, while diagram frames retain absolute positioning and overlap freedom.
   - Verify the lesson-note screenshot scenario in the running editor: no text collision after insertion or growth, with diagrams unchanged.

## Technical scope

- Assignment lifecycle helpers, assignment pipeline, Assign dialog, class Assignments page, student active filtering, and focused lifecycle tests.
- Lesson-note sensor insertion, `canvasFrame` rendering/migration, session layout behavior, and focused editor layout tests.
- No database schema change is expected; existing rows, grading, student access, expiry locks, and diagram behavior remain intact.
