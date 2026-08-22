# Technical notes

- `GeometryMapPanel.tsx`: `{item.relation}` (line ~405) and `{item.principle}` (~402, ~364)
  are replaced with a small local `MathText` helper that returns
  `renderMathInline(normalizeMathSource(value))` from `@/lib/notebook/mathRender` +
  `@/lib/notebook/mathNormalize` — the identical call the lesson-note display gate uses.
  Empty/plain strings pass through unchanged, so `AB = 5 cm` is untouched.
- `GeometryGuideView.tsx`: same helper for `item.principle` / `item.relation` (lines 73-75).
- The helper lives in one new file, `src/lib/geometry/map/renderStatement.tsx`, imported by
  both panels so there is exactly one display path.
- `PropertyComposer.tsx` already normalises via `treeToLatex` + `normalizeMathSource`; only
  addition is that the same normaliser runs on `relation` in `addComposed` and in the inline
  editor's save handler in `GeometryMapPanel.tsx`, so legacy rows heal on next edit.
- `RelationshipEditorSheet` / `Field` inputs stay raw text (input layer).
- Untouched: `src/lib/geometry/map/model.ts` schema and `objectIds`, `stripNumericAnswers`,
  selection filtering (`onlyThisPart`), highlight wiring, `GeometryPropertiesWorkspace`,
  `SelectionInspector`, the Smartboard dock mounting, and all storage paths.
