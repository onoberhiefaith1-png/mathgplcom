# Remove Smartboard Bottom Panel and Workspace Foldable Bar

Remove only the two specified chrome elements. Do not change any smartboard writing, sensor, math-tree, or page behaviour.

## What will change

1. **Smartboard bottom panel (VALUES / SYMBOLS / STRUCTURES) — delete entirely**
   - Remove the `BottomPanel` mount and all related props/state from `src/components/smartboard/PresentationView.tsx`.
   - Remove the `PANEL_HEIGHT`/`TAB_HEIGHT` dependency where it was only used for the bottom panel padding/insets.
   - The permanent floating assistant buttons (`AssistantButtons`) stay in place; their bottom offset is set to `0` since the bottom panel no longer exists.
   - The floating `SymbolPanel` and `StructurePanel` triggered by those buttons remain unchanged.

2. **Workspace foldable bar — delete entirely**
   - Remove the amber collapsible workspace-status bar from `src/components/school/ViewingFrame.tsx`.
   - Keep the `ViewAsProvider` wrapper and its read-only gating so viewed workspaces (teacher/student/child) still behave correctly.
   - Clean up the fold state, session-storage key, drag hook, and Chevron/Eye imports that were only used for the bar.

## What will not change

- Smartboard writing surface, sensor, D-pad, cursor movement, math-tree rendering, or structure handling.
- Top toolbar, settings sheet, zoom/eraser/box tools, AI verification toggle, or floating assistant buttons.
- Lesson Note content, tools, graph/diagram/calculator/conversion layers, or page persistence.
- `ViewAsProvider` read-only behaviour and workspace isolation.

## Files to edit

- `src/components/smartboard/PresentationView.tsx`
- `src/components/school/ViewingFrame.tsx`

## Verification

- Typecheck passes.
- Smartboard page still renders and accepts input.
- No amber workspace bar appears on `/school/teachers/:userId/smartboard` or teaching-hub student routes.
- No bottom VALUES/SYMBOLS/STRUCTURES panel appears on the smartboard.
