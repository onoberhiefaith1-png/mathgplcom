# Make Edit match the correct Game writing-surface layout

## Goal

The teacher’s Edit view will show the same surface arrangement they will get in the main Game:

- every writing surface begins at the correct safe left edge and grows rightward;
- surfaces retain clear vertical space and never overlap;
- room pillars, posts, and frames never cover a surface or its writing;
- Play remains unchanged because its current structure is already correct.

## Confirmed cause

Edit and Play currently take different layout paths in the shared renderer:

- Play uses the live 5%–95% writing width, restricts it to the room-safe span, and anchors each surface to that span’s left edge.
- Edit instead uses the old fixed slate width and re-centres each surface from its measured text bounds.

That Edit-only branch produces the centred/stacked arrangement shown in the screenshot, so the teacher is not seeing the saved Game as it will appear in Play.

## Build

### 1. Use one safe horizontal layout in Edit and Play

Calculate the visible writing band and room obstruction limits once, then use that result for both modes.

```text
Visible Game width
  → 5% left and right margins
  → restrict to clear span between projected pillar/frame edges
  → shared safe left edge and maximum width
```

In Edit, each surface will start at that safe left edge and grow rightward from its own content, exactly as it does in Play. A short surface stays compact; a long surface grows only to the safe right edge, then wraps.

### 2. Keep surfaces clear of pillars and room frames

Use the existing room obstruction projection at the surface depth for Edit as well as Play. The surface and its text will share the same clear span, beginning beside the inner edge of the left obstruction and ending before the right obstruction.

No surface will be placed behind a pillar. The room, pillars, camera, and saved stage design will not be moved or redesigned.

### 3. Preserve independent vertical spacing

Use each surface’s actual rendered height in Edit when positioning the following surface. Keep the saved construction gap between them so growing text, wrapping, decorations, and notes cannot merge or overlap adjacent surfaces.

### 4. Preserve editing behavior and saved appearance

Keep surface selection, direct Edit interaction, reward placement, scrolling, and all teacher text/material settings working. This changes only Edit positioning and spacing; it does not change Slate Artisan, Floating Numbers, mathematics, grading, rewards, or Play behavior.

## Verification

1. Open the supplied saved Game in Edit and confirm every surface starts at one shared safe left edge rather than the centre.
2. Compare Edit and Play at the same desktop size; surface position, width, wrapping, and gaps must match.
3. Test a roomless stage: surfaces use the 5%–95% band.
4. Test pillared, post, and framed rooms: surfaces and text remain entirely inside the unobstructed span.
5. Enter short and long text on several lines; only the matching surface grows, then wraps, while all gaps remain clear.
6. Scroll through all surfaces and confirm none overlap, clip, or move behind room architecture.
7. Confirm surfaces remain immediately selectable and editable in Edit.
8. Run the focused surface-layout tests and inspect Edit at desktop and phone sizes.

## Not changing

No changes to the correct Play layout, Slate Artisan design system, room geometry, camera, Floating Numbers, grading, rewards, Vault behavior, saved teacher styling, or mathematics.
