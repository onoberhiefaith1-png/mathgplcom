# Fix Game Play 5% writing margins and surface-to-line activation

## Goal

Make Game Play use the full visible screen correctly:

- writing begins at 5% of the Game viewport and may continue to 95%;
- touching Writing Surface N immediately activates Floating Numbers Line N;
- the existing Game design, editor, camera, Floating Numbers controls, rewards, and mathematics remain unchanged.

## Confirmed current behavior

- The live 2050px-wide Game was checked at the user's current proportions. Its first text begins around one-third across the screen, not at the required 5% edge.
- Play currently caps its writing width to 90% of the fixed 6.6-unit slate width. On a wide viewport, that cap prevents the writing region from expanding to 90% of the actual visible viewport.
- A surface selection already flows through the shared `setActiveLine(line)` function to the Game runtime and Floating Numbers. However, the invisible writing hit area is separate from the visible material, so the clickable target does not reliably cover the physical surface in Play.
- Line 0 is guarded from solving selection; Lines 1 onward are valid Floating Numbers targets.

## Implementation

### 1. Make 5%–95% refer to the real Game viewport

- Calculate the world-space width represented by the live viewport at the writing-surface depth.
- Use exactly 90% of that visible width for the Play writing region, centered between the 5% left and right boundaries.
- Remove the fixed slate-width ceiling from Play only.
- Keep each physical surface independently sized from its own rendered content, but anchor every surface and its text to the same 5% left boundary.
- Cap long content at the 95% boundary so it wraps instead of moving or extending beyond the screen.
- Preserve the current materials and texture tiling as surfaces grow.

### 2. Make the entire visible surface select its line

- Give each Play surface a reliable hit target matching its rendered physical width and height, including empty surfaces.
- Route that target through the existing shared selection path:

```text
Touch Surface N
  → setActiveLine(N)
  → Game runtime currentLine = N
  → Floating Numbers active line = N
  → selected surface = N
  → focus returns to Floating Numbers input
```

- Prevent the world drag/scroll handler and reward objects from swallowing a deliberate surface tap.
- Keep Surface 0 display-only: it shows the question but cannot become a solving line.
- Keep one canonical active-line state; no parallel surface cursor will be introduced.

## Real-time verification

Test against an authenticated saved Game, not only automated code tests:

1. At the current 2050px-wide viewport, confirm the writing boundary is 102.5px from the left and 102.5px from the right.
2. Repeat at laptop, tablet, and mobile widths; confirm the boundaries remain 5% and 95%.
3. Confirm short surfaces remain compact while their text begins at the shared 5% boundary.
4. Confirm long content grows or wraps without crossing the 95% boundary.
5. Tap visible Surfaces 1, 2, 4, and 7; verify the displayed Game Line and Floating Numbers line match each tapped number immediately.
6. Tap an empty area of a surface and its number area; both must activate that line.
7. Use Floating Numbers Previous and Next after a surface tap; verify the selected physical surface follows the same line state.
8. Confirm Surface 0 remains the question and does not activate a solving line.
9. Run the focused Game layout and line-synchronization tests and inspect the live screen for console errors.

## Not changing

No editor redesign, camera movement, alternative mathematics engine, new controls, reward changes, or visual-style changes.
