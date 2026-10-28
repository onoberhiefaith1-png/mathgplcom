## What gets built

### Section-aware diagram placement

- `src/lib/lessonnotes/sessionLayout.ts`: stop excluding `objectKind === "diagram"`
  from the space calculation. A diagram frame reserves the height it occupies inside
  its owning section, so following equation/solution lines are pushed below it.
- `src/lib/lessonnotes/diagramRef.ts` / `solutionPairing.ts`: bind each diagram to its
  parent question id and expose that band to the Solution block, so a Solution renders
  under the figure and reuses it rather than requesting a new scene.
- Writing layer paints above the figure layer at the same section (ordering only — no
  opacity, no design change).
- `geometryStandard.ts`: tighten the ownership rule with an explicit section rule —
  a figure belongs to exactly one question section, is never emitted while equations
  or solution steps are being produced, and never re-drawn for a Solution block.

### Complete, ordered solutions

- New `supabase/functions/notebook-ai/solutionCompletenessStandard.ts`: a hard output
  contract for solution generation — restate the question verbatim (existing
  QUESTION_LOCK), one micro-step per line in order, no skipped transition, and a
  final explicit answer line. Ending without the answer line is a failure, not a
  style choice.
- `index.ts` block/solution paths (currently plain `callAI`) move to the
  truncation-aware `callAIRich` with an escalating token budget (8k → 16k → 32k) and
  a `finishReason === "length"` retry, the same safeguard the floating pipeline
  already has.
- New solution completeness gate reusing `completenessVerifier.ts` plus solution-specific
  checks: final-answer line present, step order continuous, no dangling operator or
  unclosed bracket/fraction on the last line. A failed gate triggers one bounded
  regeneration with the exact defect named; a second failure surfaces a plain message
  instead of writing a half solution to the note.
- Floating extraction and the assignment/practice follow-up only run on a solution that
  passed the gate, and when a solution is rejected the reason is reported rather than
  the feature silently vanishing.

### Verification

- Unit tests for the completeness gate (truncated solution, missing final answer,
  out-of-order steps, valid solution) and for diagram band reservation in the layout.
- One real generation through the Co-Pilot for a geometry question with a solution,
  confirming the figure sits in its own band and the solution reaches its answer with
  floating and assignment available.

Nothing changes in the Master Pedagogical Reference, rendering standard, camera,
smartboard or Building work.
