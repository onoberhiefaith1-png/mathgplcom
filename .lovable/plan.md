# Responsive Text Size only for the Game

## Goal
Give the same saved Game three independent text-size values so its mathematics remains appropriately sized on desktop, tablet, and mobile screens.

Only **Text Size** becomes responsive. The Test selector and every other Game setting remain one shared value.

## Why this is needed
One text size cannot suit every screen proportion:

- A size designed for desktop can be too large on mobile.
- A size designed for mobile can be too small on desktop.
- Tablet needs its own balanced size.

This does not create separate Games, Tests, text content, or setting groups. It gives the same Text Size property three responsive values.

## Changes
1. Extend the existing saved text appearance settings with:
   - Desktop Text Size
   - Tablet Text Size
   - Mobile Text Size
2. Replace the single **Text Size** row in the existing Text appearance area with three copies of the same current slider, preserving its range, steps, and interaction.
3. Keep the sliders independent: changing one never writes to either of the other two.
4. Automatically select the rendered size from the current viewport:
   - Mobile: below 768px
   - Tablet: 768px–1279px
   - Desktop: 1280px and above
5. Apply the selected size through the existing shared Edit/Play text pipeline, including both Surface Test and 3D Test renderers, text measurement, wrapping, content-driven surface growth, and vertical spacing.
6. Keep all non-size text properties shared exactly as they are now: colour, style, depth, bevel, opacity, glow, animation, line spacing, letter spacing, alignment, dimensional/tile settings, and presets.
7. Keep backgrounds, rooms, dimensions, surfaces, effects, rewards, Test selection, Floating Numbers, mathematics, grading, and saved stage design unchanged.

## Existing Game compatibility
- Older Games with only the current Text Size will use that saved value for Desktop, Tablet, and Mobile.
- Saving an older Game will preserve its appearance while adding the three independent values.
- No Game duplication or data deletion is required.

## Verification
- Changing Desktop Text Size changes only the desktop value and desktop rendering.
- Changing Tablet Text Size changes only the tablet value and tablet rendering.
- Changing Mobile Text Size changes only the mobile value and mobile rendering.
- Resize across all three viewport ranges and confirm the correct saved size switches automatically.
- Confirm Edit and Play use the same selected device size.
- Confirm Surface Test and 3D Test both use the selected size without exposing the inactive renderer.
- Confirm text remains inside its matching surface, surfaces grow and wrap correctly, and spacing does not overlap at every device size.
- Confirm all existing non-size settings remain identical across devices.
- Add focused compatibility and responsive-size tests, then run the affected Game/Slate tests and the type check.

## Not changing
No second Test, no separate device-specific Game, no duplicate settings panel, and no changes to Slate Artisan behavior beyond choosing the correct saved Text Size for the active viewport.
