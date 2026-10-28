# Restore faithful offline Academia Play

## Goal
Make downloaded Academia **Play** look and behave like the existing MathGPL Game for the same saved activity. Do not redesign the Game or change Practice.

## Verified cause
- Offline Play already opens the shared Game player, but its writing surfaces currently render through a simplified flat text treatment that uses only colour, size, and `flat/raised/engraved`. It does not apply the Game's saved text preset, font, depth, glow, shadow, or each surface's saved text settings.
- The saved writing-style data is intact. The Game's original font files are bundled locally, but the offline worker currently excludes `.ttf` files; offline font requests therefore fall back to one generic typeface. The settings picker also shows labels/CSS effects rather than the real saved fonts, so its samples cannot currently prove what gameplay will render.
- Downloading does save Game asset URLs with an offline marker, but Play primes and requests the unmarked online URLs. The offline worker cannot match those requests to the saved files, causing the missing-image placeholders and absent background.
- Offline Play also forces a test mode that suppresses configured timers and progress restoration; this differs from normal assigned Play even though both mount the same Game stage.
- Practice and Play are separate already: Practice mounts the Smartboard, while Play mounts the Game. The correction should stay inside the shared Game presentation and offline asset preparation.

## Implementation
1. **Restore the saved Game writing appearance**
   - Build one DOM-safe Game text style adapter from the existing saved `Game.settings.text` and per-surface `textConfig` values.
   - Use the bundled Game font files and the existing preset resolver for font, colour, face/depth treatment, shadow, glow, opacity, spacing, alignment, and responsive text size.
   - Apply it to plain equations, structured equations, notes, caret, and real writing-style previews so the preview and actual Play surface cannot disagree.
   - Preserve the current mathematical structure, editing, wrapping, line ownership, Floating Numbers, and instant grading.

2. **Make the complete saved Game available offline**
   - Expand the Academia Game asset manifest to include the saved background, physical surface pictures, reward artwork, animation media, sun/items, and all configured music/effects.
   - Save those files during pack download and pass the exact marked offline URLs into Play, so the Game requests the same cache keys the worker stored.
   - Keep missing optional sounds non-blocking; required visual assets must have a valid fallback instead of a broken-image icon.

3. **Keep one runtime, not an offline imitation**
   - Continue using the same Game stage, HUD, controls, reward animation logic, surfaces, Floating Numbers, evaluation, and responsive sizing for connected and offline Play.
   - Limit offline-only code to supplying local board data, local media URLs, deterministic marking, attempt persistence, and later sync.
   - Replace the forced test-mode behavior with an explicit offline mode that retains normal Play timers, progress restoration, controls, and rewards without making network writes.
   - Do not alter Game Pro, Courses, normal assignments, or Smartboard Practice.

4. **Offline fonts and installation update**
   - Register the bundled Game fonts locally so Play never depends on a network font request.
   - Include the required fonts and Game visuals in the install/update cache.
   - Bump the offline pack version so an installed phone is clearly prompted to update rather than retaining the dark incomplete pack.

5. **Verification**
   - Compare the same Academia activity online and offline at phone size: background, surfaces, writing style, responsive text size, controls, rewards, animations, music, and line placement.
   - Run once online to download/update, then repeat in a fresh browser context with network disabled.
   - Complete at least one line offline and verify expected/student/predicted instant evaluation, score/reward activation, saved attempt/history, reload restoration, and later sync.
   - Add regression tests proving saved text presets/per-surface settings are honored and every rendered Game asset is included in the offline manifest.

## Technical boundaries
- The current `/game` remains the DOM Game; the archived 3D Game Pro stays unchanged.
- Existing Game data remains authoritative. No replacement theme, invented handwriting, flattened equations, or separate offline Game renderer will be introduced.
