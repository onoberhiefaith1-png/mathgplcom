# Fix only the three Game issues: one visible test style, preserved gaps, notes only after score

Goal: keep the current working Game test flow intact, keep both existing text/test implementations in code, and fix only the three visible problems: duplicate/overlapping test visuals, surfaces touching when content grows, and notes appearing before a line is fully scored.

## What I confirmed in the current code

- There is already one shared Game question/input path: `GamePlayPage` builds Surface 0 from the question and Lines 1+ from Floating Numbers line text.
- The current line completion signal comes from the Smartboard/Floating Numbers bridge through `lastAwardedLineId`, and `useGameRuntime.completedLines` is the Game-side completed-line state.
- Notes in Game Play are currently intended to appear only when `runtime.completedLines` includes that line.
- Both visual text implementations exist: Surface Test uses `InscribedText`; 3D Test uses `DimensionalText` or `TileText` through `WritingRegion`.
- A persisted `testDisplay` setting already exists in Game settings normalization; the work must harden how that selector hides the inactive visual implementation.
- Surface layout already flows through `buildLayout`, but the visible screenshot still shows text/surface misalignment and risk of dynamic-height surfaces visually meeting.

## Scope guard

I will not delete either renderer, replace the current test flow, rebuild the math engine, add a third test implementation, or change unrelated Game features, rooms, camera, rewards, Vault logic, timers, reset, or grading rules.

## Fix 1: Two test styles, exactly one visible and active

- Keep both existing implementations in the codebase:
  - Surface Test: `InscribedText`
  - 3D Test: `DimensionalText` / `TileText`
- Keep one shared mathematical Test state for question, student input, line state, score, completion, timer, validation, notes, rewards, and progress.
- Make the teacher setting the single switch for which renderer is visible and interactive.
- Add a hard visual-off path for the inactive renderer so it contributes no visible output:
  - no fill, outline, shadow, glow, depth, extrusion, tiles, material pass, highlight, caret, selection, or visual effect;
  - no pointer handling;
  - no duplicated question or duplicated student writing.
- Preserve the inactive renderer's implementation and shared data pathway, but ensure users see only the selected style.

## Fix 2: Surfaces must flow vertically and never meet

- Treat each surface as one document-flow block with its own content-driven height.
- Use the measured or estimated content height for that exact surface only.
- After any surface grows, recompute every following surface position from:

```text
previous surface top
+ previous surface height
+ required minimum gap
= next surface top
```

- Add a fixed minimum gap that cannot be reduced by wrapping, notes, large teacher text, or renderer changes.
- Preserve independent heights; do not make all surfaces the same size.
- Keep the 5%–95% safe writing band and pillar-safe width rules.
- Keep scrolling able to reach every surface without clipping.

## Fix 3: Notes only after the line is fully scored

- Keep notes attached to their exact line.
- Make note visibility depend only on the official line-completed / score-awarded state.
- Do not allow notes to appear from line selection, navigation, partial text, character count, leaving the line, or placing some Floating Numbers.
- Specifically, partial input such as `x + 7    12` must not reveal the note for `x + 7 = 12`.
- Once the line is validated and the mark is awarded, reveal only that line's note.
- Returning later to an incomplete line must keep its note hidden until it earns its score.

## Technical changes

- `WritingRegion`: make renderer visibility explicit and exclusive. Keep the shared input/reporting path stable, but ensure inactive visual layers render nothing and receive no pointer/caret/selection output.
- `DimensionalText`, `TileText`, and `InscribedText`: add/strengthen an invisible mode if needed so every visual pass is disabled when inactive without deleting the implementation.
- `SlateColumn` / layout helpers: calculate surface heights from the selected renderer's measured/estimated content and enforce a non-negotiable minimum gap between consecutive regions after growth.
- `GamePlayPage` / `useGameRuntime`: keep notes driven by `completedLines`/`lastAwardedLineId` only, and close any path where partial input or line movement can add a line to the completed-note state.
- Tests: add focused coverage for exclusive renderer visibility, preserved surface gaps after growth, and notes staying hidden until score-awarded completion.

## Verification

- Surface Test selected: only Surface Test is visible; 3D Test leaves no duplicate text, shadow, outline, depth, glow, or tile geometry.
- 3D Test selected: only 3D Test is visible; Surface Test leaves no duplicate text or visual marks.
- Lines 1–3 rapid input appears in the correct matching surface.
- A long Line 1 grows Surface 1 and pushes Surface 2 down while the gap remains.
- A long Line 2 pushes Surface 3 down while the gap remains.
- Incomplete or mathematically incorrect input reveals no note and fires no rewards.
- A fully validated, score-awarded line reveals only its own note.
- Scrolling reaches every surface without overlap or clipping.
