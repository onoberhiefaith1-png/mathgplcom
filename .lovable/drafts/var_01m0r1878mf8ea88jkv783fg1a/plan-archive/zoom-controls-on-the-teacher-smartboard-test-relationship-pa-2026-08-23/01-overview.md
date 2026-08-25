# Zoom controls on the Teacher Smartboard Test relationship page

## Problem
The Teacher Smartboard Test page opens the geometry-relationship view full-screen (diagram on the left, Review Properties panel on the right). The diagram renders at a fixed size, so when the user opens a small triangle they cannot enlarge it to see labels or relationships clearly. There is no zoom UI on this page.

## Goal
Add a − / percentage / + zoom button group to the relationship view’s top bar. Pressing + enlarges the diagram, − shrinks it, and the percentage button resets to 100%. The zoom must keep the diagram’s proportions and must not affect the right-hand properties panel.

## What will change
- `BoardRelationshipView.tsx` gets a local zoom state and a small toolbar button group.
- The diagram container is wrapped in a CSS `zoom` transform driven by that state, matching the proportional scaling already used for diagrams on the main Smartboard.
- Zoom is persisted per notebook in `localStorage` so returning to the same test remembers the chosen level.
- The Review Properties panel keeps its native size; only the diagram canvas scales.

## Out of scope
- No changes to the main Smartboard zoom behaviour.
- No changes to geometry property authoring or colour-coding logic.
