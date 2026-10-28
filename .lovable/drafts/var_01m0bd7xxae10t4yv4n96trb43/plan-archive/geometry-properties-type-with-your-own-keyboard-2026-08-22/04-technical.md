# Technical notes

- `PropertyComposer.tsx`: the `OPERATORS` keypad and the `ComposerToken` chip row are removed.
  The property line becomes `MathInlineCanvas` over a `mathTree` `Row`, held in local state and
  converted with `latexToTree` / `treeToLatex` + `normalizeMathSource` — the same wrapper shape
  `MathCellEditor` in `SmartTable.tsx` already uses, so the shortcut layer, selection, nesting and
  local undo come for free and no parsing logic is duplicated.
- Object references: picking inserts the object's chip label as characters at the caret via
  `insertChar` and adds its `GeoId` to a `referencedIds` set kept beside the expression; on save the
  set is filtered to labels still present in the expression text. Same
  `{ statement, reason, objectIds }` payload to `onAdd`, so `GeometryMapPanel` and
  `src/lib/geometry/map/model.ts` are unchanged.
- Add Function: a small popover listing `mkSqrt`, `mkFrac`, `mkSup`, `mkSub`, `mkBracket` and
  text-function inserts. It needs an imperative entry into the editor, so `MathInlineCanvas` gains
  one optional prop — an `insertRequest` (node + nonce) applied at the current cursor through the
  existing `insertNode` / `apply` path, then cleared. Existing callers pass nothing and are
  unaffected; no other file changes.
- Untouched: `MathKeyShortcuts.ts`, `mathTree.ts` semantics, `GeometryWorkbench`, `GeometryCanvas`,
  `SelectionInspector`, the Smartboard dock, and every storage path.
- Verification: typecheck, then drive the Geometry Properties workspace in the preview to type
  `YP =`, insert a root, type `S#2-Z#2`, save, refresh and confirm the property and its object
  links persist.
