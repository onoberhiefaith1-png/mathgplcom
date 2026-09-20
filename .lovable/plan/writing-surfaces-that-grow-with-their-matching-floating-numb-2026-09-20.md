# Writing surfaces that grow with their matching Floating Numbers lines

## Goal
Make every Game writing surface behave as the physical display for exactly one Floating Numbers line.

```text
Surface 0 = read-only question
Surface 1 = Floating Numbers Line 1
Surface 2 = Floating Numbers Line 2
Surface N = Floating Numbers Line N
```

## Build

### 1. Grow each surface from its own content
- Keep every empty solving surface at its compact minimum size.
- Measure the actual rendered equation, fractions, powers, symbols, and notes for that line.
- Grow only that surface horizontally as its Floating Numbers content increases.
- Stop at the safe writing boundary: 5%–95% of the screen, further restricted between room pillars when present.
- At the maximum width, wrap the content and grow that same surface downward.
- Recalculate following surface positions so they move down without overlapping, while unrelated surfaces retain their own sizes.
- Preserve the teacher’s chosen material, decorations, texture scale, and text styling throughout growth.

### 2. Use one line identity everywhere
- Keep the Game runtime’s active line as the only active-line state.
- Resolve every surface through its stable `line-N` identity; do not rely on visible position or array offset.
- Send Floating Numbers Line N working only to Surface N.
- Keep Surface 0 outside solving navigation and reward evaluation.

### 3. Make surface selection control Floating Numbers
- Make the complete visible surface—including its empty area—the touch target.
- Tapping Surface N immediately selects Floating Numbers Line N and focuses its existing controls.
- Route surface taps and Floating Numbers Previous/Next through the same guarded line-selection operation.
- Prevent board scrolling, decoration, or reward objects from swallowing a deliberate surface tap or changing the selected line afterward.

### 4. Keep phone interaction immediate
- Update the selected line locally before any save or mathematical check.
- Restrict re-rendering to the changed line, its surface measurement, and affected positions.
- Do not rebuild the room, background video, other surfaces, or reward world during line selection or surface growth.
- Trace and remove the current `v is not defined` runtime fault if it occurs in this interaction path.

## Verification
Test authenticated Edit and Play on the two existing Year 5 Games at phone and desktop sizes:

1. Empty lines begin compact.
2. Writing on Line 1 grows only Surface 1.
3. A longer Line 2 creates a wider Surface 2 without widening Surface 1 or 3.
4. Long content wraps at the safe right edge and grows downward.
5. Surfaces retain stable gaps and never overlap.
6. In a pillared room, every surface remains between the pillars.
7. Tap Surfaces 1, 2, 3, 4, and 7; the matching Floating Numbers line activates immediately and stays selected.
8. Previous/Next moves exactly one matching surface and line.
9. Surface 0 remains the immutable question.
10. Saved writing materials remain visible while surfaces grow.
11. No script errors, blank panels, or delayed line reversals occur.

## Not changing
No redesign of the Game editor, Floating Numbers controls, mathematics, rewards, Vault, timers, backgrounds, rooms, or saved teacher configurations.
