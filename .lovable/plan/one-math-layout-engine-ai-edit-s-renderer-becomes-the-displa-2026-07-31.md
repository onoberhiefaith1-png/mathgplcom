# One math layout engine: AI Edit's renderer becomes the display standard

## What the two screenshots actually show

The content is now identical in both places — the difference is purely which layout engine paints it.

- AI Edit preview paints through `renderMathInline` (`src/lib/notebook/mathRender.ts`, 925 lines): real DOM/CSS typography with proper fraction bars, centred numerator/denominator, big-operator positioning, script placement and operator spacing.
- The math object inside the lesson note paints through `MathInlineCanvas` (`src/components/lessonnotes/extensions/MathInline.tsx` → `MathInlineCanvas.tsx`, 471 lines): a second, hand-rolled layout engine that measures and positions glyphs itself. That is the compressed Σ, the offset `x̄`, the misaligned bar in your first screenshot.

Everywhere else on the Smartboard (`PhaseStage`, `SmartboardLessonText`, `PresenterMath`, `WritingLab`, `FloatingNumberPanel`, `PresentationView`) already uses `renderMathInline`. So the editable node is the last surface running its own engine — and it is the one that feeds Present mode.

Today `renderMathInline` is only used as a fallback for "lossy" expressions. Everything the tree parser *can* represent still gets the canvas layout, which is exactly the class of expressions in your screenshot.

## The change

Make `renderMathInline` the only thing that ever *displays* mathematics. The tree/canvas becomes an editing surface only, shown while the teacher is actually inside the object.

```text
create / AI Edit / apply
        ↓
normalizeMathSource        (shared string standard — already in place)
        ↓
renderMathInline           (single layout engine — display everywhere)
        ↓
click into the object → MathInlineCanvas (editing only) → commit → back to renderMathInline
```

### Steps

1. **Flip the display gate** in `MathInline.tsx`: when the node is not focused, always render through `renderMathInline(normalizeMathSource(value))` — drop the `lossy` condition so representable and non-representable expressions look the same. Keep the click/focus behaviour that opens the canvas.
2. **Keep round-trip integrity**: on blur, commit the tree, re-serialise to `value`, and display the serialised value through `renderMathInline`, so what the teacher sees after editing is the validated form, not a canvas snapshot.
3. **Apply parity**: `applyAiEdit` / `aiToNodes` already normalize; with step 1 the node the Apply button inserts renders with the identical engine and CSS as the preview the teacher just looked at — same spacing, alignment, baseline, line height.
4. **Shared typography tokens**: move the spacing/line-height/font-size values `renderMathInline` uses into named CSS variables in `src/styles.css` so the AI Edit panel, the note body, Present mode and export all inherit one set. No per-surface overrides.
5. **Editing-mode visual match**: give `MathInlineCanvas` the same font-size and baseline metrics as the rendered form, so entering and leaving edit mode does not shift the expression on the page.
6. **Regression check**: extend `src/lib/notebook/__tests__/mathParsers.test.ts` with the mean-deviation formula plus a nested-fraction and a Σ-with-limits case, asserting normalize → serialise stability; verify visually that the AI Edit preview and the note body are structurally identical before and after Apply.

## Scope

- Only the math *display* layer changes. No schema change, no new node types, no change to 2D/3D diagrams, tables, Smartboard behaviour or AI Edit behaviour.
- Existing `mathInline` nodes improve automatically — nothing needs re-creating.

## Files to change

- `src/components/lessonnotes/extensions/MathInline.tsx` (display gate)
- `src/components/lessonnotes/extensions/MathInlineCanvas.tsx` (metrics match only)
- `src/lib/notebook/mathRender.ts` (token-driven spacing)
- `src/styles.css` (math typography tokens)
- `src/lib/notebook/__tests__/mathParsers.test.ts` (coverage)
