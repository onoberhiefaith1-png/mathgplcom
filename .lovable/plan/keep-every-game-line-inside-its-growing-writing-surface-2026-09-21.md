# Keep every Game line inside its growing writing surface

## Confirmed problem

The supplied screenshot shows the mathematics reacting to Floating Numbers, but it is drawn at the far-left edge while the physical writing surfaces remain centred. The current Game renderer positions each surface from measured text bounds, yet renders the text outside that same positioned group. This separates the foreground writing from its background and makes the saved teacher styling appear wrong or unreadable.

The room code already identifies pillar and frame obstructions, but that safe span currently limits width only; the surface and text must share its left and right boundaries.

## Build

### 1. One shared box for each line

For every Game line, create one layout result containing:

- the safe left and right edges;
- surface position, width, and height;
- inner text position and writable width;
- the teacher's saved alignment.

Render the writing surface, its text, its click target, and its line number inside that same positioned group. Text can no longer drift away from or appear outside its own surface.

### 2. Correct 5%–95% growth

- Without a room obstruction, every surface starts at 5% from the left of the visible Game area.
- An empty line remains compact.
- As Floating Numbers adds content, only that matching surface grows toward the 95% right boundary.
- At the maximum width, the text wraps inside the surface and that surface grows downward.
- Following surfaces move down only as needed; they do not inherit another line's size.

### 3. Keep clear of pillars and room frames

When a room has pillars, posts, or a door frame, replace the normal 5% and 95% edges with the visible inner edges of those obstructions. Both the physical surface and its text begin after the left obstruction and stop before the right obstruction, at the actual surface depth.

### 4. Preserve the teacher's exact text design

Use the saved Game text settings unchanged in Play: style, size, colour, alignment, spacing, depth, opacity, glow, animation, and tile/dimensional treatment. Responsive wrapping will constrain the writing to its surface, but will not replace the teacher's choices or silently shrink every line into a different style.

### 5. Preserve existing Game behavior

- Surface 0 remains the complete read-only question.
- Surface N remains connected only to Floating Numbers Line N.
- Floating Numbers input remains immediate.
- Notes remain hidden until that exact line receives an authoritative correct/equivalent mark.
- Reward, timer, Vault, Reset, camera, and editor behavior remain unchanged.

### 6. Remove the current Game script fault

Trace and remove the reported `v is not defined` error on this Game path so it cannot interrupt text or surface updates.

## Verification before completion

Test the teacher's current saved Game at the current wide desktop size and at phone size:

1. Surface 0 shows the full question inside its material.
2. Every surface begins at the 5% boundary when no room obstruction exists.
3. In the shown pillared room, surfaces and text begin after the left pillar and stop before the right pillar.
4. Enter symbols rapidly on Lines 1, 2, and 3; each symbol appears immediately inside the matching surface.
5. A short expression creates a short surface; longer content grows only that surface; maximum-width content wraps downward.
6. Left, centre, and right alignment remain inside the same physical surface.
7. Saved text size, colour, style, spacing, depth, opacity, glow, animation, and tile/dimensional modes match Edit.
8. Incorrect and incomplete lines reveal no note or reward; a correctly awarded line reveals only its own note.
9. Scrolling reaches every surface without overlap or clipping.
10. No Game runtime errors remain.

## Not changing

No redesign of Slate Artisan, Floating Numbers, mathematics, grading, rewards, rooms, camera, or the teacher's saved stage.
