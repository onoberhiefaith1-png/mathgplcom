## Implementation

1. **Make one complete resolved text appearance**
   - Add a single helper that takes the Game text settings plus the slot's saved text configuration and returns the complete render style for that slot.
   - Preserve per-slot placement and responsive size, but make preset, depth, bevel, front colour, depth colour, shadow, highlight, glow, opacity, animation, relief, integration and advanced overrides flow through together.
   - Ensure presets update the actual renderer values, not only the settings panel preview.

2. **Stop stale/default renderer overrides**
   - Remove or replace hard caps/defaults that prevent settings from showing, including simplified fallback size/shadow behaviour.
   - Make the plain fallback, structured maths layer, inscribed text, dimensional text and tile fallback consume the same resolved appearance wherever that renderer supports it.
   - For settings a renderer cannot physically represent, make it use the closest visible equivalent rather than silently ignoring the setting.

3. **Measure the full visible text object**
   - Expand the reported text bounds to include the effects that can escape the flat glyph box: extrusion/depth, bevel, shadow offset/blur/opacity, glow/contact shadow and animation lift/scale where applicable.
   - Use those expanded bounds in the existing surface-growth and fit pipeline.
   - Keep the text body itself controlled by the writing surface; shadows and depth are included in containment rather than allowed to spill outside.

4. **Make layout respond to settings changes**
   - Update the measurement/layout keys so changing depth, shadow, preset, glow, animation, opacity, colour, line spacing, letter spacing or responsive size triggers a fresh measure and surface reflow.
   - Keep the current canonical surface-boundary correction after each setting change.
   - Prevent measurement loops with the existing bounded settling approach.

5. **Persist safely without overwriting teacher design incorrectly**
   - Editor and owner Test/Play may persist measured placement corrections after the new bounds are stable.
   - Student Play and temporary preview slots may apply containment locally but must not overwrite the teacher's saved design.
   - Keep the Text icon as the emergency Fit Text action and keep Reset unchanged.

## Verification

Use the existing Game text surface with one visible equation/text object and verify the complete lifecycle:

- Increase and decrease Text Size several times; the rendered text visibly changes and remains inside the surface.
- Increase Text Depth / extrusion; the physical depth visibly changes and remains contained.
- Change Front Text Colour; the front face visibly changes.
- Change Depth Colour; bevel/side/depth visibly change.
- Toggle Shadow and change shadow strength/size-equivalent settings; the visible shadow responds and remains contained.
- Change preset, glow, highlight, line spacing, letter spacing and animation; the actual text responds.
- Save, reopen, Preview, Play, Test Play, resize browser, and change viewport size.

The fix is complete only when the rendered text and its depth/shadow/effects remain inside the owning writing surface through the full lifecycle, not merely when settings values are saved.
