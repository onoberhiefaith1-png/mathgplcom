## Technical detail

**Shared primitives (new, small)**
- `src/hooks/useFitToWidth.ts` — measures a container and its fixed-width child, returns a scale factor (capped at 1, so desktop always gets exactly 1 and is a no-op).
- `src/components/ui/responsive-panel.tsx` — renders `children` inline (desktop/tablet, current markup) or inside a bottom `Sheet` (phone), driven by `useBreakpoint()`. This is the single mechanism every side panel adopts; the panel bodies themselves are not rewritten.

**Lesson note fit**
- `src/components/lessonnotes/PageFrame.tsx` — the fixed `width: widthPx` sheet stays; the outer wrapper gains a phone/tablet-only `zoom: fitScale` (same `zoom` mechanism already in use, multiplied with the user's zoom). Because CSS `zoom` scales layout, existing measurement code that divides `getBoundingClientRect().width` by `offsetWidth` (DocumentEditor line ~684, plus the geometry overlay scale maths around lines 3660/3733) already compensates — those paths must be verified, not rewritten.
- `src/components/lessonnotes/DocumentEditor.tsx` — `paddingRight: var(--properties-panel-width)` (line ~3453) must resolve to `0px` on phone, since the panel no longer occupies width.

**Panels**
- `PropertiesPanel.tsx` — keep the fixed rail and `clamp(240px, 20vw, 460px)` on desktop; on phone render through `ResponsivePanel` and publish `--properties-panel-width: 0px`.
- `geometry-editor/GeometryWorkbench.tsx` — the two `w-56` sticky columns become sheet-hosted on phone; the canvas takes the full width. `hideLeftTools`, chrome colours and the editor instance stay as they are.
- `smartboard/PresentationView.tsx` — `w-[20%] min-w-[240px]` review dock (line ~5086) becomes a phone sheet; the board itself already uses `h-screen w-screen`.
- `FloatingNumbersPage.tsx` / `FloatingPreparationPage.tsx` — the `hidden lg:flex w-[380px]` asides already hide below `lg`; they gain the sheet entry point so the content is reachable rather than absent.

**Global guards**
- `src/styles.css`: `html, body { max-width: 100%; overflow-x: clip }` and a phone-scoped rule that neutralises `min-w-[NNNpx]` only inside the workspace shells. No token, colour, font or spacing value changes.

**Untouched**: all geometry/property/colour/identity libraries, `presentation.ts` selection law, math structure serialisation, AI and server functions, database. No new tables and no migration.

**Verification**: Playwright sweep at the widths listed, comparing 1440px screenshots before and after for the notebook editor, Smartboard and both floating pages; any desktop delta is reverted.
