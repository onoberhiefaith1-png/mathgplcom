# Graph — Two-Colour Ink System

Replace the current mixed palette (grey grid, near-black axes, mid-grey numbers, blue plots) with a strict two-colour model: one background colour and one foreground "ink" colour. Everything drawn on the paper — axes, numbers, axis labels, major grid, minor grid — is that single ink colour, differentiated only by opacity and thickness.

## Current state (verified)

- `src/lib/graph/graphModel.ts` already defines a `GraphStyle` with separate `axis`, `numbers`, `majorGrid`, `minorGrid`, `plotColour` hex values, defaulting to grey/blue.
- `src/components/lessonnotes/math-tools/SmartGraphView.tsx` does **not** read that style at all: grid lines, axes, numbers and labels are hardcoded (`hsl(0 0% 78%)`, `hsl(0 0% 92%)`, `hsl(0 0% 10%)`, `hsl(0 0% 35%)`, plots `hsl(220 90% 50%)`).
- The same component renders the Smartboard graph via `BoardToolLayer.tsx`, so one fix covers both surfaces.

## The theme model

Add a small set of named two-colour themes; each is just `{ bg, ink }`:

| Theme | Background | Ink |
| --- | --- | --- |
| White + Charcoal (default) | `#FFFFFF` | `#1F2937` |
| White + Navy | `#FFFFFF` | `#172554` |
| White + Black | `#FFFFFF` | `#111111` |
| White + Slate | `#FFFFFF` | `#334155` |
| Cream + Black | `#FAFAF5` | `#111111` |
| Dark + White | `#0F1115` | `#FFFFFF` |
| Dark Navy + White | `#0F172A` | `#FFFFFF` |
| Dark Grey + White | `#18181B` | `#FFFFFF` |

Everything else is derived from `ink` by opacity, never by a new hue:

```text
Axes          ink 100%   thickest (2px, 2.4px while dragging)
Numbers/text  ink 100%   (axis labels ink 85%)
Major grid    ink 25%    1px      (1 square = 1 cm = 1 unit interval)
Minor grid    ink 10%    0.5px    (subdivisions inside each major square)
Plots/points  ink 100%   (curve thickness/dash still per function)
Draft/cursor  unchanged amber, so live drawing stays distinguishable
```

Dark themes use slightly higher grid opacities (major 30%, minor 14%) because light-on-dark reads fainter.

## Changes

1. `graphModel.ts`: reduce `GraphStyle` to `theme` + `bg`/`ink` plus the numeric knobs that stay (`axisWidth`, `minorPerMajor`, point shape/size, plot width). `sanitizeGraphAttrs` maps any old saved style (with its per-part colours) onto the nearest theme, defaulting to White + Charcoal, so existing graphs and board copies load unchanged.
2. New `src/lib/graph/graphTheme.ts`: the theme table plus helpers (`inkAt(ink, alpha)`, derived axis/major/minor/number colours) so every renderer asks for colours the same way.
3. `SmartGraphView.tsx`: remove all hardcoded colour literals in the paper/axes/number/label/plot/point layers and drive them from the derived theme. The SVG background uses `bg`. Overlay and shape rendering (currently blue) also switch to ink.
4. Style panel (inside the existing `More` → Style area): replace the per-part colour pickers with a single row of theme swatches showing background + ink, plus sliders for major/minor grid strength and minor-grid density. No option can produce a multicolour graph.
5. Per-function colour picker stays, but its default palette becomes ink-first (first function = ink) so a single plotted curve matches the paper's ink instead of introducing blue.

## Verification

Insert a fresh graph, confirm white paper with charcoal axes/numbers, clearly lighter major squares and much lighter minor subdivisions; switch to Dark + White and confirm the hierarchy still reads; plot `y = 2x + 3` and confirm the curve is ink-coloured; reopen an older saved note and confirm it renders in the default theme with geometry, points and overlays intact.
