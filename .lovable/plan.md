# Final refinement pass — context-aware AI questions + reliable Floating Numbers connection

No new features, no redesign. Three targeted fixes inside the existing workflow.

## 1. Questions must be real tasks, not bare equations

Confirmed in `supabase/functions/notebook-ai/index.ts` (the `generate` mode style table): a
question block is currently asked for as *"Write ONE concise worked-example problem only"* —
nothing requires an instruction, and nothing requires the instruction to name the method the
subtopic is about. That is why `x² + 5x + 6 = 0` comes back on its own.

Changes:

- Rewrite the `problem` style rules for example / exercise / classwork / homework so every
  generated item is **instruction + mathematics**: an imperative task line naming the method
  implied by the Topic/Subtopic ("Solve the quadratic equation using the quadratic formula.",
  "Solve the simultaneous equations by elimination."), then the mathematics on its own line.
- Add a small `QUESTION_TASK_STANDARD` (new file next to the other standards) stating the rule
  once, injected only for `blockKind === "problem"`: never emit a naked equation; the
  instruction must match the stated Subtopic and the method already used in the lesson; no
  invented method the lesson has not taught.
- Add a light server-side guard beside the existing continuity guard: if the returned problem
  has no instruction sentence (no imperative verb line), do one corrective round asking for the
  instruction to be added, then accept — same shape as the guard already there, so it can never
  block generation.
- Verify the caller always sends context: `topic`, `subtopic`, `subject` and `lessonContext`
  already flow from `DocumentEditor` → keep them, and fall back to the notebook's
  subject/subtopic when a field is empty so the prompt never says "Topic: —".

Continuity itself is already implemented (`CONTINUITY_STANDARD` + `LESSON SO FAR` from
`buildLessonTeachingContext`); it stays as is, and the new instruction rule reuses it.

## 2. Fix the real cause of "solution not available" on the Floating Numbers page

The Floating page reads the solution from `notebook_blocks` (kind `solution`) for the resolved
subsection. Those rows are rebuilt on every save by `parseDocumentToSections` in
`src/lib/lessonnotes/syncDocumentToNotebook.ts`, which walks **only top-level `doc.content`**.
Since the Master Sensor now writes content into free-positioned `canvasFrame` nodes, any
question/Solution that lives inside a frame is invisible to that parser: it is flattened into
one text blob, so no subsection and no solution block is written — the page then opens blank
even though the solution is on screen. Problems typed in the normal flow work, which matches
"the first two say not available, another one works".

Changes:

- Flatten container nodes before parsing: in `parseDocumentToSections`, expand `canvasFrame`
  (and any other pure container wrapper) into its child nodes, in document order, so headings
  and solutions inside frames are parsed exactly like top-level ones.
- Make subsection resolution content-based instead of index-based: `locateIndices` /
  `resolveSubsectionId` in `src/components/lessonnotes/extensions/SectionHeading.tsx` currently
  count headings positionally and can land on a different (empty) row. Resolve by matching the
  snapshotted question text against `notebook_blocks.problem` for the section first, and fall
  back to the positional index only when no match exists.
- Save-before-open: the Floating chip flushes the pending document save (the same save that
  runs the sync) before navigating, so a solution generated seconds earlier is already in the
  rows the page reads.

## 3. Solution transfer must always be present, and the page must always open

- Keep the current behaviour that the page always opens (create-on-demand rows), and keep the
  blank state — but only show it when the solution is genuinely empty.
- Pass the solution through directly: the Floating chip hands the live solution text from the
  document to the Floating page via navigation state; the page uses it when the DB row is still
  empty, so there is no window where a visible solution reads as missing.
- Add a small "Copy solution" action on the Floating page header so the teacher can paste the
  solution manually if they ever want to.

## 4. Quietly fix the 422 question-lock rejections

Preview logs show generation failing with `question_lock_mismatch` on the same equation written
differently (`x^2` vs `x²` vs `x^{2}`). The lock comparison will normalise superscript digits,
`^{n}` vs `^n`, unicode minus/dashes and collapsed whitespace before comparing, so a correct
solution is no longer rejected. The lock itself (never solving a different question) is unchanged.

## Out of scope

Dashboards, Smartboard behaviour, assignments, adventures, reports, layouts and the user journey
are untouched.

## Verification

Walk the full flow in the preview: Topic → Subtopic → generate Example (check the question has
an instruction) → generate Solution → open Floating from the Solution heading (from a normal
section *and* from a free-frame section) → confirm the solution lines appear, then repeat on a
question with no solution and confirm the page opens blank instead of erroring.
