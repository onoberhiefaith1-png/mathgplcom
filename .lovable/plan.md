# Smart Table: two targeted behaviour fixes

No redesign. Row/column insertion, movement, deletion, clearing, text editing, formulas and summation stay exactly as they are.

## 1. `@` must open the Asset Library everywhere the math editor runs

Today the `@` menu only exists as a text-editor plugin (`AtCommand` + `AtCommandMenu`), which is bound to the prose editor. Inside the universal math editor (`MathInlineCanvas` — used by Smart Table cells, lesson-note math, geometry labels, smartboard) `@` is treated as an ordinary character, which is why the cell in the screenshot shows the literal text `@SQ`.

Fix:
- Intercept `@` inside the math editor's key handler. Instead of inserting a character it opens the Asset Library picker anchored at the caret, with live type-to-filter, plus the existing Favourites / Recents / Repeat-last views, so the Asset Library registry is the single source for `@` everywhere.
- Selecting an asset inserts it into the math tree at the caret and leaves the caret in the first empty slot (fraction numerator, power slot, root, bracket, matrix cell), so editing continues in place without the cell losing focus or closing.
- Symbols insert as characters; structures insert as real editable structures; matrix keeps its rows/cols dialog. Assets that are whole page objects (diagrams, charts, tables, images) are not insertable inside a math run — they stay listed but inserting one commits the cell and drops the object into the surrounding note, exactly as it would outside the table.
- Escape closes the picker and returns the caret to where it was; the trigger character is never written into the content.

Because this lives in the shared math editor, the same behaviour applies automatically in Smart Table cells, lesson-note lines, geometry text, smartboard boards and any other math input.

## 2. Right-hand panel opens only from Edit

Selection must stop opening the panel. Currently the table registers itself with the right-hand properties panel whenever a cell, row or column is selected, or whenever a cell is being typed into.

New behaviour:
1. Click a cell → cell is selected/highlighted only; right-hand panel stays closed.
2. Selecting a row or column handle, or typing into a cell, also does not open it.
3. Clicking **Edit** under the table opens the Smart Table panel, showing options for the currently selected cell / row / column.
4. Closing the panel (or deselecting the table) exits edit mode and hides the panel again.

The Edit button becomes a toggle so the teacher can leave edit mode from the same control.

## Technical notes

- `src/components/lessonnotes/extensions/MathInlineCanvas.tsx`: add an `@` branch in `handleKey` that opens a picker overlay; render the overlay and apply the chosen asset through `insertNode` / `insertNodeWrapping` / `insertChar`.
- New `src/lib/lessonnotes/assets/mathInsert.ts`: maps an `AssetDef` (`symbol`, `latex`, `structure`) to math-tree nodes via `mkFrac` / `mkSubSup` / `mkSqrt` / `mkBracket` / `latexToTree`, and reports when an asset is not math-insertable.
- New `MathAssetPicker` component reading the same `searchAssets`, `listFavorites`, `listRecent`, `getLastInserted` registry helpers the Asset Library dialog uses.
- `SmartTable.tsx`: change the `useRegisterAssetEditor` condition from `(selected && (panelOpen || line || softCell)) || active` to `selected && panelOpen`; make the Edit button toggle `panelOpen`; keep the reset-on-deselect effect.
