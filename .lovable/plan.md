# Game Play desktop margins and surface-to-line activation

## Goal

Keep the current mobile Game Play positioning unchanged. Correct laptop and desktop Play so every writing line uses the visible area from 5% to 95%, and touching a numbered writing surface immediately activates the matching Floating Numbers line.

## Changes

### 1. Preserve mobile and correct wider screens

- Keep the current mobile sizing and positioning as the reference behavior.
- Add a Play-only responsive width calculation for laptop and desktop using the actual visible 3D viewport at the writing-surface depth.
- Position the writing origin at the viewport's 5% boundary and wrap at its 95% boundary.
- Apply the same boundaries to the visible material and its text, while allowing each surface to grow independently from its own content.
- Do not move the camera or change Game Edit.

### 2. Make every physical surface a reliable line selector

- Give each complete visible writing surface a matching interaction area, including blank space around short text.
- Route surface touches through the existing shared `setActiveLine` path used by Floating Numbers.
- Map Surface 1 to Floating Numbers Line 1, Surface 4 to Line 4, and so on; Surface 0 remains the read-only question and cannot become a solving line.
- Stop slate dragging and reward objects from swallowing a deliberate surface touch.
- After selection, focus/open the existing Floating Numbers control so the student can continue solving on that line.

### 3. Keep one synchronized active line

- Keep the Game runtime's active line as the sole authority.
- Ensure surface touch, Floating Numbers Next/Previous, and scrolling all update that same line state.
- Keep the selected surface highlight, displayed Game Line number, Floating Numbers line, and incoming written work synchronized.

## Verification

- Mobile: confirm the existing correct 5%–95% positioning is unchanged.
- Laptop and desktop: measure the rendered writing start and wrap boundary at 5% and 95% of the visible screen.
- Touch/click Surfaces 1, 2, 4, and 7 and verify each immediately changes Floating Numbers to the same numbered line.
- Verify Surface 0 stays read-only and does not interrupt solving navigation.
- Verify Floating Numbers Next/Previous changes the selected physical surface.
- Verify writing entered after selecting a surface appears only on that surface.
- Check mouse and touch behavior at desktop, laptop, tablet, and mobile widths.
- Run the focused Game layout and synchronization tests.

## Not changing

Game Edit, the fixed camera, teacher-saved visuals, rewards, timers, AI evaluation, and the Floating Numbers solving interface remain unchanged.
