## Three fixes to make the Smartboard "perfect"

### 1. Sensor-Restricted Spacer Below Any Multi-Row Structure

**Problem:** "Simplify under the square root" sits directly under the denominator `4` of the quadratic formula fraction — they collide. Same issue for any structure taller than one row.

**Rule:** After *any* structure that occupies more than one row (fraction, √ with a tall radicand, matrix, sum/integral, cases, etc.), the row immediately below is **sensor-restricted**. The sensor advances to the row *after* that gap when moving on from the line.

**Where to change:**
- `src/lib/smartboard/mathTree.ts` — `rowHasTallStructure` already exists; extend it into a `structureRowSpan(row)` helper that returns how many rows a line's tallest node occupies (1 for plain, 2 for standard fraction / √-with-body, 3+ for nested).
- `src/components/smartboard/PresentationView.tsx` — `nextSensorRowBelow` / `extraRowsFor` currently return 0 for plain rows. Add a **trailing spacer** of exactly 1 row whenever the *previous* line's span > 1. The spacer row is registered in a new `sensorRestrictedRows: Set<number>` so:
  - The D-pad ▲/▼ skips over it.
  - `editActive` and `writeProseLineOnBoard` refuse to write there (falls through to the next free row — same pattern as Law 2).
  - The click-gate on `FreeWriteLayer` treats it like a notebook-prose row.
- Row-ownership: the spacer is *not* owned by the previous line (so it stays a true gap, not part of the locked structure).

**Tests** (extend `src/test/sensorSpacing.test.ts`):
- Fraction line → next sensor position = lastRow + 2 (skip the spacer).
- Plain equation line → next sensor position = lastRow + 1 (no spacer, unchanged).
- Manual D-pad ▲ from below a fraction skips the spacer and lands on the denominator's row is blocked (locked), continues up to the numerator.
- Nested fraction inside a √ (3-row structure) → still exactly one spacer, not more.

---

### 2. Notebook Notes Must Mirror the Lesson-Note Paragraph Structure

**Problem:** Notebook prose (the "unhighlighted" text like *"Simplify under the square root"*, *"Solve for x…"*, *"Evaluate the square root Separate the…"*) is being flattened into one horizontal strip per line, forcing infinite right-scroll. In the lesson note the same content is 5 paragraphs — the board should show 5 paragraphs.

**Where to change:**
- `src/lib/smartboard/mirrorFromLessonNote.ts` — where `notebookOnly` mirrors are built, keep the paragraph breaks from the source instead of joining. Emit one mirror row *per paragraph* (each carrying its `paragraphIndex` so ordering is preserved).
- `src/lib/smartboard/presentation.ts` — the synth `notebookOnly` guided-line emitter currently produces one line per note; change it to produce N lines when the note has N paragraphs, all tagged to the same parent equation so Law 1's line-ownership stays correct.
- `src/components/smartboard/PresentationView.tsx` — `writeProseLineOnBoard` writes one row per paragraph, each at the current sensor row, advancing the sensor by one row (respecting rule #1 if the equation above was multi-row).
- Wrap long paragraphs to the board width: add a soft wrap in `rowAscii.ts` / the free-write renderer at ~`bandWidth / charWidth` characters, breaking on spaces. Wrapped continuation rows are also sensor-restricted.

**Tests:**
- 3-paragraph note → 3 board rows, correct order.
- Long single paragraph → wraps into ≤ bandWidth rows, no horizontal overflow.
- Note following a fraction line → first paragraph sits *after* the rule-1 spacer, subsequent paragraphs stack directly below.

---

### 3. Connected, Expandable Square Root (No Bracketed Radicand)

**Problem:** The √ renders inconsistently — sometimes a full radical `√(b² − 4ac)`, sometimes a short glyph plus parenthesised body `√( … )`, sometimes disconnected halves. The quadratic formula reference has no bracket; we need one canonical form.

**Where to change:**
- `src/lib/notebook/mathRender.ts` + `src/lib/smartboard/mathTree.ts` — replace the current mixed rendering with a single `SqrtNode` that renders as:
  - A left-hand radical hook (√) whose height equals the tallest child of its radicand.
  - A horizontal **overline** rendered as a CSS `border-top` on the radicand box, so it expands automatically with content width (same technique already used for the square-root strip in `MathTreeRender.tsx` per prior work — extend it to *all* render paths, not only the free-write layer).
  - **No parentheses** around the radicand. The bracket is a visual side-effect of the current fallback path and must be removed.
- Renderers to converge:
  - `src/components/smartboard/MathTreeRender.tsx` (already CSS-based — this is the canonical one).
  - `src/lib/notebook/mathRender.ts` (lesson-note DOM render).
  - The floating-number chip renderer inside `FloatingNumberPanel.tsx`.
  - `src/lib/lessonnotes/aiToNodes.ts` — make sure AI-generated `\sqrt{…}` always maps to `SqrtNode`, never to a text-fallback `√(…)`.
- Add an indexed form `\sqrt[n]{…}` that reuses the same overline, just with a small superscript index on the hook.

**Acceptance:**
- Create a fresh lesson note containing the quadratic formula → the √ renders as one connected shape in (a) the lesson note, (b) the floating-number generation panel, and (c) the smartboard presentation, with the overline flush against the radical hook and no bracket.
- Radicand expands when more terms are typed (e.g. `b² − 4ac` vs `b² − 4·a·c·d`) — the overline grows, the hook height tracks the tallest child.

**Tests:**
- Snapshot the rendered DOM of `\sqrt{b^2 - 4ac}` from each of the three renderers — they should agree structurally.
- Regression: any legacy `√( … )` bracket-fallback code path is deleted, so it cannot re-appear.

---

### Rollout

1. Fix #3 first (square root) — it is a pure render change and unblocks visual QA of #1 (the collision is more obvious with a proper radical).
2. Then #1 (spacer rule) — small, contained, has clear tests.
3. Then #2 (paragraph mirroring) — touches presentation + mirror + write-prose, largest surface area.

All existing sensor tests (`src/test/sensorSpacing.test.ts`, 139 passing) must remain green; new tests bring the count to ~155.