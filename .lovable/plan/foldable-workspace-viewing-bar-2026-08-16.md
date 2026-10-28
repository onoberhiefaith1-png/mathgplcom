# Foldable Workspace Viewing Bar

Make the yellow workspace-status bar in `ViewingFrame.tsx` collapsible so the viewed workspace (Lesson Notes, etc.) reclaims the vertical space, while keeping the existing controls and wording intact.

## What will change

- Add a fold/collapse toggle to the amber workspace bar rendered by `ViewingFrame.tsx`.
- Expanded state shows the current label and exit/back link exactly as today.
- Collapsed state hides the full bar and renders only a small top-centre tab/handle (chevron down + short hint) that floats without reserving the original banner height.
- Clicking the tab restores the full bar; clicking the fold icon collapses it again.
- Fold state persists for the current viewed workspace across navigation in the same browser tab (session-scoped storage keyed by viewed user + kind + viewer).
- The bar no longer leaves an invisible reserved area when collapsed: the child page content moves to the top of the viewport.

## What will not change

- Existing wording inside the bar: the read-only label, name, viewer label, and the exit/back link text remain untouched.
- Lesson Notes content, tools, graph, diagrams, tables, calculator, or any other page functionality.
- The `ViewAsProvider` read-only behaviour or workspace isolation.

## Implementation notes

- Use local React state initialised from `sessionStorage` so the teacher’s preference survives page changes while viewing the same workspace.
- Render the collapsed handle as a minimal sticky/floating strip (e.g. centred pill at `top-0`) so it does not push content downward.
- Keep the current amber colour scheme and z-index so the handle remains visible over page content.
- No new dependencies required.
