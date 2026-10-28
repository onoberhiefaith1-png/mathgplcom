# Smart problem validation before Generate Solution (+ no duplicate section labels)

Two targeted changes. No rebuild of solution generation, floating numbers, assignments or the document structure.

## What actually goes wrong today

`getSolutionSource` in `src/components/lessonnotes/DocumentEditor.tsx` builds ACTIVE_QUESTION by taking the text between the nearest heading above and the Solution heading, then cutting everything up to and including the **last line that looks like a section label** (`detectSectionKind`). When the question body itself carries a label — e.g. a line reading `Classwork 4` or `Classwork 4: Solve the following equation: log₂(2x + 1) = 5` — that line is treated as a label and the mathematics on it is discarded with it. `problemText` becomes empty, `hasInheritedQuestion` is false, and the teacher gets a flat destructive toast: "No parent question found". The equation was on the page the whole time.

## 1. A real problem-identification stage

New module `src/lib/lessonnotes/problemDetect.ts`, working purely on the document data already in hand (no OCR, no screenshot — visual analysis stays a later fallback only):

- **Strip structure, keep mathematics.** Recognise the whole family of structural labels (Example / Exercise / Classwork / Homework / Question / Solution / Answer / Working, with or without a number, with or without a trailing colon) and interface metadata (`AI`, `#FLOATING`, `ASSIGN`). A label-only line is dropped; a line that *starts* with a label but continues (`Classwork 4: Solve …`) keeps everything after the label.
- **Classify the remainder** into: instruction lines (imperative task text), mathematical lines (contain an expression/relation), and other prose. Diagram and table nodes owned by the question count as supporting content.
- **Return a report**, not a boolean:
  `{ status, heading, instruction, problem, mathLines, hasDiagram, issue }` with
  `status ∈ valid | uncertain | incomplete | ambiguous | empty`.

Validation rules for status:
- mathematics present and closed (both sides of a relation present, no trailing operator) → `valid`
- instruction present but no mathematics at all → `incomplete` ("the equation itself is missing")
- mathematics present but truncated (`log₂(2x + 1) =`) → `incomplete` with the exact issue named
- a question that depends on a figure (`Find ∠ABC`) with an owned diagram → `valid`; without one → `uncertain`
- conflicting candidates (two unrelated equations, no instruction) → `ambiguous`
- nothing but labels/metadata → `empty`

## 2. Two-stage pipeline in the editor

In `handleSectionAi`:

1. **Identify** — `getSolutionSource` delegates label-stripping to `problemDetect`, so `problemText` keeps `log₂(2x + 1) = 5` in the failing case above. Diagram ownership is already resolved via `diagramsOwnedByQuestion`; feed that into the report.
2. **Gate** — replace the single destructive toast with a **Problem Check** panel (small dialog, existing dialog primitives):
   - `valid` → no interruption; show a brief confirmation line of what was detected and generate.
   - `uncertain` → show the detected content and the reason, with **Generate anyway** and **Cancel**. The teacher stays in control.
   - `incomplete` / `ambiguous` / `empty` → state exactly what was inspected (heading, instruction, mathematics found) and what is missing, with **Cancel** / **Generate anyway**. Never the phrase "No problem found".
3. **Generate** — unchanged: validated problem goes through as ACTIVE_QUESTION with `inheritedContext: true`.

The heading, instruction and problem text are shown verbatim so the check is transparent.

## 3. The application owns the structure; the AI owns the mathematics

Generation side (prompt only, no workflow change):
- In `supabase/functions/notebook-ai/index.ts`, the problem/solution style rules gain an explicit rule: the section heading, number, label and the "Solution" label are already on the page — emit only the mathematical content, never the heading.
- The request already carries the section kind; pass the **existing heading text** as context marked "already rendered — do not repeat".

Defensive layer (never a rejection):
- `supabase/functions/notebook-ai/outputHygiene.ts` drops a leading structural-label line/prefix when it duplicates the heading the app supplies (whole family, numbering-agnostic), keeping the mathematics.
- The same stripper (shared logic in `problemDetect.ts`) runs client-side in `aiToNodes` insertion, so a duplicated label that slips through is removed rather than treated as a missing question.

Teacher content is never rewritten or deleted — only the AI's own duplicated label is dropped, and only for identification purposes on existing content.

## Technical notes

- Added: `src/lib/lessonnotes/problemDetect.ts` (label vocabulary, stripper, classifier, validator report), `src/components/lessonnotes/ProblemCheckDialog.tsx`.
- Edited: `src/components/lessonnotes/DocumentEditor.tsx` (`getSolutionSource` + the gate in `handleSectionAi`), `src/lib/lessonnotes/aiToNodes.ts` (duplicate-label strip on insert), `supabase/functions/notebook-ai/index.ts` (heading-ownership rule + existing-heading context), `supabase/functions/notebook-ai/outputHygiene.ts` (defensive label strip).
- Unchanged: QUESTION_LOCK, inheritance standard and the 422 guard, floating numbers, assignments, section kinds, document schema.

## Verification

Walk the nine cases from the request in the preview, including `Classwork 4` on its own line and `Classwork 4: Solve …` on one line, a truncated right-hand side, an instruction with no equation, and an angle question with and without a diagram.
