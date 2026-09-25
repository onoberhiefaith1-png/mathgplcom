# Fix one-time Line 1 writing and line-number controls

## Outcome
- A note-only Line 1 writes itself once, immediately after the Line 0 question.
- Signing out and back in restores the existing Line 1 writing instead of appending another copy.
- A Line 1 containing Floating Numbers or an equation remains interactive and never runs automatically.
- Every physical writing surface keeps a visible number tag.
- The right-side control clearly shows the current line number, synchronized with the selected surface.

## Implementation
1. **Make automatic Line 1 idempotent from real board content**
   - Before the automatic note write, inspect the restored board for the exact existing note using the shared structured-row signature matcher.
   - If found, reconnect that row to Line 1, restore its read-only note status, and mark the note as already shown without writing anything.
   - Only write when no matching saved note exists.
   - Keep manual note clicks unchanged; this correction applies to the automatic first-line path only.

2. **Handle restore timing safely**
   - Let the one-time check rerun when saved/local or shared board content arrives, instead of deciding before restoration finishes.
   - Guard the delayed write against duplicate React effects and late session snapshots.
   - Preserve the existing board identity so different students, classes, games, assessments, and questions never share this state.

3. **Keep interactive Line 1 interactive**
   - Retain the existing rule that any first line with an equation or Floating Numbers is excluded from automatic writing.
   - Add regression coverage for note-only versus interactive first lines.

4. **Make line numbers unconditionally clear in Game play**
   - Render each physical Game writing surface with its own tag: `Q` for the question and `1`, `2`, `3`… for working surfaces.
   - Use one shared label rule for both the physical surface and right-side navigation so they cannot disagree.
   - Show the currently selected line number clearly on the right-side control while preserving its existing scrolling and selection behavior.

5. **Verify the full return flow**
   - Test: open Game → Line 1 appears once → sign out → sign in → saved Line 1 restores once → repeat several times with no duplicates.
   - Test existing and newly added lines, surface selection, right-side numbering, and interactive Line 1 behavior.
   - Run focused tests, type checks, build diagnostics, and desktop/narrow browser checks.

## Technical scope
- Limit changes to the Smartboard note-restoration guard, shared Game surface labels, right-side current-line display, and focused tests.
- Do not change Floating Numbers mathematics, sensor movement, grading, rewards, timing, or manual repeat-note behavior.
