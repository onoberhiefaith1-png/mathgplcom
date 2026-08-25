# Clean up the Mathematics Toolbar

Three changes to the Lesson Notes toolbar. Nothing else in the editor changes.

## 1. Delete Animate

Remove the Animate toggle button, its "Capture Step" companion button, and the now-unused animate mode state from the toolbar. No replacement.

## 2. Rename Table to Maths Table

The button currently labelled **Tables** (opens the mathematical reference-table picker: logs, antilogs, sines, etc.) is relabelled **Maths Table**. Same dialog, same insertion, same behaviour.

## 3. Add Smart Table

A new **Smart Table** button is added before Maths Table. It inserts the existing Smart Table — the same interactive table the Asset Library already offers (retained values, row/column orientation, student interaction, Smartboard activity). No new table system is built.

## Final toolbar order

```text
Diagram | Smart Table | Maths Table | Graph | Calc | Conversion | Symbols | Matrix | ...
```

## Technical notes

- `src/components/lessonnotes/DocumentEditor.tsx`
  - Delete the Animate button, the conditional Capture Step button, and `animateMode` state (leave `captureStep` untouched if referenced elsewhere; otherwise it is removed with the button).
  - Relabel the `setTablesOpen(true)` button text to "Maths Table" (icon unchanged).
  - Add a Smart Table button that calls the existing `insertAsset(editor, ...)` with the registered `smarttable` asset from `src/lib/lessonnotes/assets/tables.ts`, so insertion goes through the exact same path as the Asset Library.
  - Fix the internal `openSmartTable` command (currently opens the reference-table picker) to insert the Smart Table instead, keeping the two tools distinct.
- No changes to the Smart Table component, the reference-table picker, the node schema, or the database.
