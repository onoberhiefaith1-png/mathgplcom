# Responsive Desktop / Tablet / Mobile

Desktop is the locked reference. Every change below is gated behind a width condition, so at desktop widths the rendered output is byte-for-byte the layout you have today.

## What I confirmed is actually wrong

Public pages already fit a 393px phone (I measured `/` and `/lesson-notes` at 393px: document scroll width 393px, zero overflowing elements). The viewport meta tag is already correct (`width=device-width, initial-scale=1.0` in the root route). So the problem is not the page shell — it is inside the workspaces:

- **The lesson-note sheet is a hard paper width.** `PageFrame` renders the sheet at `widthMm * (96/25.4)` — 794px for A4 — plus a fixed 1-inch (96px) margin on every side. On a 393px phone that is exactly the reported symptom: you see the middle of a desktop page.
- **Side panels reserve desktop pixels on phones.** The universal Properties Panel is `position: fixed` at `clamp(240px, 20vw, 460px)` with no phone case — 240px of a 393px screen. The Smartboard review dock is `w-[20%] min-w-[240px]`. The Geometry Workbench pins two `w-56` tool columns either side of the canvas, leaving almost nothing for the drawing.
- **Co-Pilot already does this correctly** (`fixed` slide-over under `md`, docked at `md+`). That existing pattern is the model the other panels will follow.

## Decisions you made

- Phone lesson note: **auto fit-to-width, A4 proportions kept**. The sheet keeps its exact shape, margins and line breaks; it is uniformly scaled so its full width always fits. Nothing reflows, nothing re-parses.
- Phone panels: **bottom sheets** over the workspace.
