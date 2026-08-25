## Panel behaviour

- Opens from the same **Matrix** ribbon button, toggling a right-hand dock (280px min, ~30% of the editor, 420px max) — identical geometry to the Emoji Library, and the two never stack: opening one closes the other.
- Same content as today: Matrix dimensions, Matrix operations, Special matrices, the pending-combination line, and **Enter**. Incompatible chips stay greyed with their reason.
- Panel stays open after inserting, so several matrices can be placed in a row; the caret returns to the note in the first cell each time. Closes with the X or the ribbon button.

## Technical notes

- `MatrixQuickPanel.tsx`: replace the `Popover` shell with a docked `<aside>` matching `EmojiPanel`'s container (`shrink-0 border-l … width: clamp(280px, 30%, 420px)`), driven by `open`/`onClose` props instead of internal popover state. Bands, chips and preview line are reused unchanged.
- `DocumentEditor.tsx`: hold `matrixPanelOpen` state alongside `emojiPanelOpen` (each closes the other), render `MatrixQuickPanel` in the same flex row as `EmojiPanel`, and pass a new insert callback.
- New insert path replaces `insertMathStructure(latex)`: build an `AssetDef` with `render: { kind: "structure", structure: "matrix", attrs: { rows, cols, br: "(", fns } }` and call `insertAsset(editor, asset)` — the same call `AtCommandMenu` uses, so slot count, structure validation and caret placement come for free.
- Operations map to existing `MatrixFnId`s (`transpose`, `inverse`, `determinant`, `adjoint`); `power` adds the exponent slot. Determinant/adjoint render via the existing outer-prefix notation rather than a `vmatrix` string.
- Special types apply after insertion through `matrixOps.applyTemplate` (`identity`, `zero`, `diagonal`, `scalar`) exactly as the full builder does; row/column only force the shape.
- `matrixQuick.ts`: keep the selection model, compatibility rules and preview sentence; drop `buildQuickMatrixLatex` in favour of a `quickMatrixAsset(selection)` builder returning dimension + fns + template. Update the existing unit tests to assert the built descriptor instead of the LaTeX string.
- The full Matrix builder, the `@` command shortcuts and smartboard/student rendering are untouched.
