## Implementation

1. **Create one canonical fit result**
   - Move the keep-or-correct decision into one pure surface-relative function.
   - Inputs: saved placement, current inner surface bounds, actual rendered text bounds and alignment.
   - Output: the valid rendered offset plus a corrected `textConfig` only when the saved placement is invalid.
   - Preserve words, mathematical tree, font sizes, alignment, colour, spacing, rotation and 3D style. An oversized equation is fitted within the usable width rather than hidden or moved beyond an edge.

2. **Remove the temporary overwrite cycle**
   - Replace the renderer-only guard that is cleared on every lifecycle change with the canonical result.
   - Make measurement idempotent with the existing tolerance and bounded settling, so correction cannot restart the previous resize loop.
   - Use the same measured origin for structured mathematics, plain fallback text, 3D text, hit area and physical panel.

3. **Make every Game path consume the same placement**
   - Keep runtime line reconstruction for question content and rewards, but inherit the validated pattern slot configuration without creating an alternative position.
   - Route editor preview, Game preview/view, teacher Play, student Play, question switching, level switching, surface growth and responsive changes through the same validator.
   - Remove any branch that resets a corrected placement from an earlier pattern/default coordinate.

4. **Persist safely**
   - In the editor and owner Test/Play, write a changed corrected configuration back to the corresponding saved pattern slot once measurement is stable.
   - Never let a student device, transient working line, reward state or viewport-specific correction overwrite the teacher’s words or design.
   - Existing Games self-repair when an owner opens them; every viewer still receives automatic containment immediately even before an owner repair is saved.
   - No database structure change is required because the Game already stores surface-relative text configuration inside its saved slots.

5. **Upgrade the existing Text safety control**
   - Keep **Reset** unchanged.
   - Keep the existing **Text** icon available in editor, Preview/Test and Play; its tooltip/action will perform the canonical **Fit Text** operation on every currently rendered Game line.
   - Save owner corrections; apply the same fit locally for students without granting them design-write access.

## Verification

Use the real Game and the exact equation `2(x + 3) − 4x = 8`.

- Assert the equation’s measured left, right, top and bottom remain within its assigned inner surface after Create → Save → Exit → Reopen → Preview → Play → Test Play.
- Repeat after switching away from and back to the question/line, browser resize, desktop/tablet/mobile changes, reload and closing/reopening the Game.
- Verify the saved `textConfig` after owner repair and confirm another fresh load reads that corrected value.
- Cover left, centre and right alignment; structured equations and plain fallback; long/oversized equations; surface growth; repeated measurement stability.
- Confirm Reset, question content, rewards, marks, progress, timers, sounds, backgrounds and teacher visual settings are unchanged.

The fix is complete only when the entire lifecycle passes, not when one frame looks correct.
