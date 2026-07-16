## Two focused fixes

### 1. Graph width = notebook width

`SelectionFrame` (`src/components/lessonnotes/extensions/visuals/living/SelectionFrame.tsx`) wraps every asset in `className="relative inline-block"`. Because the frame is inline-block, it shrinks to the SVG's intrinsic viewBox width — so the chart's `width: 100%` resolves to that narrow intrinsic width instead of the notebook column.

Change:
- Add an optional `block?: boolean` prop to `SelectionFrame`. When true, the outer `<div>` uses `relative block w-full` instead of `relative inline-block`.
- In `LivingDiagram.tsx`, pass `block` to the SelectionFrame only for the `smartChart` family, so no other asset's sizing is affected.

Result: the chart's outer `<div style={{ width: "100%" }}>` now has a real block context and expands to the full writable width of the notebook column, exactly like the existing graph page.

### 2. Settings open only on Edit click, not on selection

`LivingDiagram.tsx` currently sets `editSelected = selected || editorOpen` for smartChart and passes that to `<SmartChart selected={editSelected}>`. `BarChart` then calls `useRegisterAssetEditor(!!selected, …)`, so the right-hand Properties Panel opens whenever the node is tiptap-selected (which happens as the user moves around / clicks near the chart).

Change:
- For the `smartChart` family only, pass `selected={editorOpen}` to `<SmartChart>` (i.e. drop the `|| selected`). The SelectionFrame's outline still uses `selected || editorOpen` so the frame highlights on click, but the settings panel only opens after the user clicks ⚙ Edit.
- Keep this scoped to `smartChart` — other families keep their current behaviour.

## Files touched

1. `src/components/lessonnotes/extensions/visuals/living/SelectionFrame.tsx`
   - Add `block?: boolean` prop. When true, outer `<div>` gets `relative block w-full` instead of `relative inline-block`.

2. `src/components/lessonnotes/extensions/visuals/living/LivingDiagram.tsx`
   - In the `arithmeticNode` block, for `family === "smartChart"` render `<SmartChart … selected={editorOpen} />` (not `editSelected`).
   - Wrap the smartChart branch in a `<SelectionFrame block …>` (only that branch — others keep their default).

Nothing else changes. No behaviour is touched for other asset kinds, no data-model changes, no BarChart edits.
