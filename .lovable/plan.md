# Chapter 2 — Smartboard Interface Mastery

Two visible outcomes:

1. The Diagnosis panel becomes collapsible.
2. Presentation AI stops behaving like a viewer and starts operating the Smartboard the way a teacher does — clicking the Floating Number button, moving the sensor, erasing wrong objects, dropping notes on the correct lines, and never letting two objects overlap.

The Presenter Preview remains the source of truth. The Smartboard must be made to match it.

---

## 1. Collapsible Diagnosis Panel

File: `src/components/smartboard/DiagnosisPanel.tsx`

- Add a `collapsed` state (persist to `localStorage` under `pai:diagnosis:collapsed`).
- When expanded: current 30% right overlay.
- When collapsed: a slim vertical rail (~40px) pinned to the right edge showing status dot (🟢/🔴), step counter `n/N`, and a chevron button to expand. Red state pulses.
- Header gets a collapse button (chevron-right icon) alongside the existing close (X).
- Autoplay chip (`AutoplayControl.tsx`) keeps a small "Open diagnosis" affordance when the panel is fully closed; no change if just collapsed.

## 2. Smartboard Interface Knowledge Layer

New module: `src/lib/smartboard/presentationAI/interface.ts`

Declarative catalogue of every Smartboard tool the AI is allowed to use, with purpose, when-to-use, and the imperative handle it invokes on the controller. This is the AI's "training manual" — inspector and repair recipes reference it by name instead of calling controller methods ad-hoc.

Tools registered:

- `floating-panel-toggle` — open/close Floating Number panel.
- `floating-pick` — click a specific floating number in the panel.
- `eraser` — remove a specific object (row / note / token) from the board.
- `sensor-move` — D-Pad up/down/left/right.
- `sensor-goto-line` — jump sensor to the start of a target line.
- `note-drop` — write the current line's Teacher Note at sensor.
- `scroll` — scroll the board viewport when the target line is off-screen.

Each entry: `{ id, purpose, preconditions, action(ctrl, args), verify(ctrl, args) }`.

## 3. Controller surface expansion

File: `src/lib/smartboard/presentationAI/controller.ts` (interface) — `PresentationView.tsx` supplies the implementations, reusing existing Smartboard state (no new authoring logic).

Add:

- `openFloatingPanel() / closeFloatingPanel() / isFloatingPanelOpen()`
- `pickFloatingNumber(lineIdx, fillerIdx)` — programmatic equivalent of the teacher clicking the # tile; falls through to the same code path `writeEquationPrefix` already uses, but exposed as a named tool call so the AI's action log reads like teacher moves.
- `eraseRow(lineIdx)` / `eraseNoteAt(lineIdx)` — clears just the offending object via existing row-signature machinery.
- `moveSensor(dir: "up"|"down"|"left"|"right", steps=1)` + `getSensorPosition()`.
- `scrollBoardTo(lineIdx)` — ensures the target row is in view.
- `detectOverlap(lineIdx)` — returns `{ overlapsWith: number | null, kind: "row"|"note" }` by comparing bounding rects of rendered rows/notes (uses `getPreviewCardEl`-style DOM lookup on the board side).
- `getBoardNoteFor(lineIdx)` / `getExpectedNoteFor(lineIdx)` — for the note-missing check.

None of this changes lesson-note authoring, floating-number extraction, or the Presenter Preview.

## 4. New inspector checks

File: `src/lib/smartboard/presentationAI/inspector.ts`

Adds three issue kinds (all `repairable: true`):

- `note-missing-on-board` — Preview line has a renderable note, `getBoardNoteFor(lineIdx)` is empty. This is the exact bug the user showed on Line 2.
- `overlap-detected` — `detectOverlap` reports a collision between the current line and any prior object.
- `sensor-misplaced` — before a write, sensor is not on the expected row.

Existing `filler-missing` / `line-mismatch` / `beat-cursor-drift` / `note-missing` stay.

## 5. New repair recipes

File: `src/lib/smartboard/presentationAI/repairs.ts`

Each recipe is expressed as a sequence of interface-tool calls (Observe → Decide → Act → Verify):

- `note-missing-on-board` → `sensor-goto-line(lineIdx)` → `note-drop` → verify `getBoardNoteFor == expected`.
- `overlap-detected` → `eraser` on the offending object → `sensor-move("down")` until `detectOverlap` clears → re-run the original write (filler prefix or note-drop) → verify.
- `sensor-misplaced` → `sensor-goto-line` → verify.
- `filler-missing` (existing) → rewritten to go through `openFloatingPanel` → `pickFloatingNumber` → `closeFloatingPanel`, so the repair path exercises the same tools a teacher would.

## 6. Write-time guard rails in the stepper

File: `src/hooks/usePresentationAI.ts`

Before every `filler` / `note` / `line-verify` step, run the standard teacher cycle:

```text
Observe → Decide → Act → Verify → Repair? → Continue
```

Concretely:

1. `detectOverlap(lineIdx)` — if collision, emit `overlap-detected` and pause.
2. Ensure sensor is on the target line; otherwise emit `sensor-misplaced`.
3. Perform the action via the interface tool (not raw controller calls).
4. Re-inspect; if the note is expected here and missing, emit `note-missing-on-board`.

Speed presets and min-tick timing stay the same.

## 7. UI wiring in `PresentationView.tsx`

- Implement the new controller methods against existing Smartboard state (row signatures, `mirrorLessonNoteRow`, DOM measurements for overlap).
- Register the tools from `interface.ts` on mount.
- No change to the visible Smartboard chrome beyond what already exists (Floating # button, Eraser, SensorDPad, RightTools). The AI just drives them programmatically.

## 8. Success criteria

- Diagnosis panel can be collapsed to a rail and re-expanded; state persists across reloads.
- On the current failing lesson, Line 2's missing Teacher Note is detected → diagnosis turns red → **Rectify** drops the note in the correct position with no overlap → panel returns to green and autoplay continues.
- Two objects never occupy the same board region during autoplay; when a collision would occur, the AI scrolls/moves the sensor down before writing.
- End-of-run report counts `note-missing-on-board`, `overlap-detected`, and `sensor-misplaced` alongside the existing stats, and unresolved instances still produce a Lovable Prompt.

## Files touched

- `src/components/smartboard/DiagnosisPanel.tsx` (collapsible)
- `src/lib/smartboard/presentationAI/interface.ts` (new — tool catalogue)
- `src/lib/smartboard/presentationAI/controller.ts` (interface additions)
- `src/lib/smartboard/presentationAI/inspector.ts` (new checks)
- `src/lib/smartboard/presentationAI/repairs.ts` (new recipes)
- `src/lib/smartboard/presentationAI/types.ts` (new issue kinds + stats)
- `src/hooks/usePresentationAI.ts` (Observe→Verify cycle)
- `src/components/smartboard/PresentationView.tsx` (controller impls, no authoring changes)
