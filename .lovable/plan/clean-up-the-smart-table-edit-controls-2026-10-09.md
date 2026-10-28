# Clean up the Smart Table Edit controls

## What changes
1. **No right-hand "Smart table" sidebar.** Clicking Edit on a table no longer opens the settings panel on the right. Only the control strip under the table appears.
2. **One tidy, centred control strip** under the table (the table stays centred):
   - Row | Column switch, then a compact `−  count  +` group with the buttons close together.
   - Σ, Add Subcell (same size, border and colour as the other buttons, so it no longer looks different), Calculator, AI Edit, Advance.
   - All buttons the same height and spacing, in one group with a soft background and border, using the lesson-note theme colours.
   - It wraps neatly onto a second line on narrow screens.
3. **New Delete table button** at the end of the strip, in red. Clicking it removes the table from the lesson note straight away (Undo brings it back).

Nothing else changes: cell editing, Subcells, Σ sums, Calculator, AI Edit and Advance keep working as before. Rows and columns are still added or removed with the `−`/`+` buttons.

## Technical details
- `SmartTable.tsx`: drop the `useRegisterAssetEditor(...)` call and the `editor` panel JSX (the row-below / column-right / insert / move / duplicate options were only reachable there).
- Restyle the strip at lines ~846–1008: wrap everything in one `inline-flex flex-wrap items-center justify-center gap-1 rounded-lg border bg-muted/40 p-1`; a shared button class (`h-7 px-2.5 rounded-md text-[11px] font-semibold`) built from semantic tokens; group `−` count `+` with `gap-0.5`; replace the hardcoded `hsl(...)` Subcell colours with the shared token class.
- Add an optional `onDelete` prop to `SmartTable`; `LivingDiagram.tsx` passes its existing `onDeleteDiagram` for the `smarttable` case. The button (Trash icon, `text-destructive`) calls it.
