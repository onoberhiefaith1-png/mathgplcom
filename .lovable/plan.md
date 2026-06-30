## Plan: Restore Floating Number + Notebook Harmony

### 1. Preserve the teacher’s highlight truth exactly
- Fix the Floating Number Selection page so saved `notebookOnly` entries are restored instead of dropped on reload.
- Keep highlight order and unhighlighted notebook text order exactly as the teacher selected it.
- Prevent old save cycles from silently deleting notebook-only rows or remapping them incorrectly.

### 2. Add the “middleman tester” before Smartboard display
- Add a deterministic verification layer between Lesson Notes/Floating Preparation and the Smartboard reservoir.
- It will compare:
  - highlighted payloads → floating numbers,
  - unhighlighted text between highlights → notebook text,
  - generated smartboard reservoir lines → the saved Lesson Note source.
- If a line does not match, the smartboard will use the Lesson Note/highlight source directly instead of the stale/generated fallback.

### 3. Remove unsafe index fallback
- In `buildReservoirs`, stop matching a highlight to a floating line by array position when the equation payload doesn’t match.
- This is likely why the Smartboard shows “something else” from another line.
- Matching should be by exact normalized Lesson Note payload; if no match exists, rebuild that one reservoir line from the highlight payload only.

### 4. Correct notebook placement rule
- Ensure unhighlighted text between two highlighted parts is attached to the highlight above it, so the notebook presents exactly the text sitting between those two highlighted regions.
- Leading unhighlighted text stays notebook-only.
- Trailing unhighlighted text stays attached to the final highlight.

### 5. Fix cursor after `x²`
- Adjust superscript/power insertion so after typing/filling the exponent, normal typing exits the exponent and continues after the full `x²` object.
- Keep explicit tap/Tab behavior for editing inside structures, but default typing after a completed superscript must not continue inside the power.

### 6. Add focused regression tests
- Add tests for the exact flow: highlighted → unhighlighted notebook → highlighted.
- Add tests proving the smartboard reservoir matches Lesson Note highlight data and does not use stale index fallback.
- Add a cursor test for typing `x`, creating/filling exponent `2`, then typing `+` lands after `x²`, not inside the exponent.