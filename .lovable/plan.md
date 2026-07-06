## Goal

Delete the current empty-sub-row placeholder in `MathTreeRender.tsx` and rewrite it from scratch so the placeholder frame is drawn in **the whiteboard's own color** (`#efece5`) — the same cream/off-white used by the white smartboard surface. When the placeholder later appears on the whiteboard, its color matches the board and it becomes invisible. On every other surface (Floating Number generator, Present preview, Lesson Note generation), the cream frame stays visible because those panels have a different background.

No dynamic context, no CSS variable, no palette lookup — one hardcoded color, everywhere.

## What to change

### 1. `src/components/smartboard/MathTreeRender.tsx`

Delete the entire empty-sub-row block (roughly lines 99–157 — the `"visible"`/`"blend"` branching, `usePlaceholderMode` call, and the `baseStyle` + active/idle rendering).

Rewrite it with a single, unconditional render:

- One constant at the top of the file: `const PLACEHOLDER_COLOR = "#efece5";` (whiteboard surface color).
- Empty sub-slot always renders the same dashed cube:
  - `border: 1px dashed ${PLACEHOLDER_COLOR}`
  - `background: ${PLACEHOLDER_COLOR}`
  - Same dimensions as today (`minWidth: 0.7em`, `minHeight: 0.85em`, padding, margin, cursor, tap zone).
- Active slot (caret parked here) keeps its glow: border switches to `caretColor`, background gets the `${caretColor}1f` tint, and the `<Caret>` renders inside — identical to today's active branch.

Remove the `import { usePlaceholderMode } from "./placeholderMode";` line and the `const mode = usePlaceholderMode();` call — neither is used anymore.

### 2. `src/components/smartboard/PresentationView.tsx`

Remove the `<PlaceholderModeProvider value="blend">` wrapper around `FreeWriteLayer` and the matching import. No longer needed.

### 3. `src/components/smartboard/placeholderMode.tsx`

Delete the file. Nothing references it after step 1 and step 2.

## Why this works

- The whiteboard surface background is already `#efece5`. A `#efece5` cream frame on top of a `#efece5` board reads as invisible — the placeholder is "there" for layout (so fractions, exponents, √, matrix cells structure correctly) but the teacher sees a clean board.
- The Floating Number generator, Present preview, and lesson-note pages use different backgrounds (dark panels, white paper), so the same cream frame is clearly visible against them — exactly what the user asked for.
- If the user later switches the board to black (or any other color), the placeholder stays cream and remains visible on that board too. This is intentional per the request: "just use that color" — the whiteboard color, fixed.

## Files touched

- `src/components/smartboard/MathTreeRender.tsx` — delete empty-slot block, rewrite with `PLACEHOLDER_COLOR = "#efece5"`.
- `src/components/smartboard/PresentationView.tsx` — remove `PlaceholderModeProvider` wrapper and import.
- `src/components/smartboard/placeholderMode.tsx` — delete.

No structural, layout, cursor, or tap-target changes. Fractions, roots, powers, and matrix layout stay byte-identical.
