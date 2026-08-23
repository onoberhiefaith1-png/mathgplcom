## Breakpoints

One shared definition, continuous across widths — no per-device design:

- phone: under 768px
- tablet: 768–1279px
- desktop: 1280px and up (existing `useBreakpoint` already uses these bounds, so nothing new is invented)

Every rule added is written as "phone only" / "under desktop". Desktop styles are never edited, only left as the default branch.

## Lesson note (the reported bug)

The sheet keeps A4 proportions and is uniformly scaled to fit the phone width. Margins, line breaks, fractions, diagram positions and highlight geometry are identical to desktop — only the on-screen scale changes, so nothing re-parses and nothing reflows. Vertical scrolling continues as normal; there is no horizontal scroll and no cropped page. Tablet gets the same fit when the sheet is wider than the window.

The existing zoom control keeps working: fit is the phone default, and a manual zoom overrides it until reset.

## Panels → bottom sheets on phone

Properties Panel, Geometry tools, Geometry Properties / Map, Smartboard review dock and the floating-page side panels all keep their desktop position and behaviour. Under 768px each becomes a bottom sheet: a button in the compact bar opens it, it covers the lower part of the screen with the workspace still visible above, it scrolls internally, and tapping outside or dragging down closes it. The same component and the same data render inside — no duplicate panels, no duplicate logic.

Tablet keeps the panel but collapsible, so the workspace never permanently loses half the screen.

## Geometry, equations, colours, identity

- Diagrams scale by their own aspect ratio inside the available width; never stretched, never cropped, all labels and marks stay visible.
- Equations keep their structured rendering. A too-wide equation scrolls or scales within its own container; a fraction never becomes a slash.
- Geometry object identity (the box is the line, not its current label), the property/colour dictionary and the Highlighting → Generating → Notes selection law are untouched. No file in `src/lib/geometry/**`, `src/lib/smartboard/presentation.ts`, `src/lib/floating/**` or the math engine changes behaviour.

## Touch and scrolling

Interactive targets on phone/tablet reach a 44px minimum without changing their desktop size. Pointer events already used for geometry drag/select work for touch; sheets and panels get their own scroll containers with overscroll containment so scrolling a panel never drags the page.

## Acceptance

Checked headlessly at 1920, 1440, 1366, 1024, 900, 768, 430, 390, 375 and 320px, portrait and landscape, on the notebook editor, Smartboard, Floating Highlighting, Floating Generating and geometry workspaces: zero elements wider than the viewport, no page-level horizontal scroll, and the 1440px screenshots identical to the pre-change screenshots.
