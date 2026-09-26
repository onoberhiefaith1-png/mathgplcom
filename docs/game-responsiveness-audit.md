# Game responsiveness audit (2026-09-25)

| Interaction | Smartboard | Game | Cause | Action |
|---|---|---|---|---|
| Scroll / wheel / drag board | DOM scroll, no re-render | Whole slate (every surface, 3D text, rewards) re-rendered every 0.3 units of travel | `setScrollTick` in the frame loop forced a React render per step | Fixed: render only when the set of visible surfaces changes |
| Tap a surface | Pointer-down, local state | Pointer-down → `onSelect` → local line change | Already immediate | None |
| Write maths | DOM text, per row | Floating Numbers writes; the surface's 3D text is re-laid-out | Text layout per change is inherent to 3D text | Monitor |
| Marking | Background | Background (grade-line after the visual update) | Not blocking | None |
| Settled-line focus | n/a | Callback is a no-op | None | None |

Principle: the screen updates first, and saving and marking happen afterward.
