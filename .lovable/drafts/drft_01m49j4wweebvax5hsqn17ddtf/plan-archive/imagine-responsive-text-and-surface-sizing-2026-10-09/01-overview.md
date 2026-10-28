# Imagine responsive text and surface sizing

## Goal
Give the teacher three independent saved size controls in the **Imagine editor only**:

- Desktop text size
- Tablet text size
- Mobile text size

Imagine will automatically use the matching saved size when played on each device. Changing one device will not alter either of the others.

The uploaded screenshot is the reference for the current play view. Its single temporary student text-size control will remain unchanged; the new authoring controls belong only in Imagine settings, as requested.

## Range behavior
Each slider will use a two-part range rather than a simple linear minimum-to-maximum scale:

- The **middle position** reproduces today’s minimum size exactly.
- Moving left continues far below today’s limit, ending at an almost invisible minimum.
- Moving right preserves the existing useful larger sizes.

This avoids compressing the normal range while still making the true minimum visually demonstrable.

## Surface relationship
The active device’s text size will also drive the writing surface’s minimum width, minimum height, and inner spacing. At the midpoint, the surface retains its current size. Below the midpoint, both text and surface contract together; above it, content-driven growth continues normally.

The original 3D Game, Floating Numbers, mathematics, rewards, evaluation, and existing Imagine play behavior remain unchanged.
