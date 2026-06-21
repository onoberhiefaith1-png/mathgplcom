## Goal

On the Floating Numbers page, "AI Edit" should be a **one-click regeneration of floating numbers for a single line** — no typing, no instructions. Click AI Edit → click Generate → preview chips → click Apply → only that line's fillers/containers/arrangement update. The equation itself never changes.

## Changes

### 1. `AiEditPanel` — add a "simple" mode
- New prop: `simpleMode?: boolean` and `generateLabel?: string`.
- When `simpleMode` is true:
  - Hide the instruction textarea, voice button, and suggestion chips.
  - Show a short caption: "AI will regenerate the floating numbers for this line."
  - Primary button reads "Generate Floating Numbers" and calls `onGenerate("", target)` directly — no instruction text required.
  - In the preview stage, add a "Regenerate" button so the teacher can re-roll without leaving the panel.
- Lesson-note callers are untouched (default `simpleMode={false}`).

### 2. `FloatingNumbersPage` — wire simple mode + protect the equation
- Pass `simpleMode` and a custom preview renderer that shows **chips** (fillers + containers), not the equation, so the teacher sees exactly what will be applied.
- `runAiEditForLine`: keep the existing `floating_line_edit` call but always send `instruction: ""` from this entry point. Cache `{ fillers, containers }` only.
- `applyAiEdit`: replace **only** `fillers`, `containers`, `arrangement`, and selection arrays for that line. Do NOT overwrite `equation` — the structure stays exactly as the lesson note produced it.

### 3. Backend `floating_line_edit` — empty-instruction path
- When `instruction` is empty/whitespace:
  - Skip the AI rewrite step.
  - Run the deterministic floating extractor + verifier directly on the existing equation, producing fresh `{ fillers, containers }`.
  - Return `{ equation: <unchanged>, fillers, containers }`.
- When `instruction` is non-empty, keep current behavior (teacher-directed rewrite).
- This guarantees a result every time and makes the regenerate button instant.

### 4. Preview chips in the panel
- Small helper that renders the proposed fillers as chips and containers as symbol chips, matching the styling already used in `FloatingWorkspace`, so the teacher can judge the regeneration before applying.

## Out of scope
- Five floating-number laws, deterministic extractor internals, lesson-note AI Edit flow, equation structure, DB schema, RLS, integrity/inheritance standards.

## Files touched
- `src/components/lessonnotes/AiEditPanel.tsx` — add simple mode + Regenerate.
- `src/pages/FloatingNumbersPage.tsx` — pass `simpleMode`, custom chip preview, apply only chips.
- `supabase/functions/notebook-ai/index.ts` — empty-instruction branch in `floating_line_edit`.