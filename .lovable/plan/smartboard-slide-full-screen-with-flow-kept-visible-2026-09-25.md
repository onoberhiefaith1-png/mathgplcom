# Smartboard slide full screen with Flow kept visible

## Goal
Make a presented Canvas slide fill the Smartboard as a stable background while the Flow character remains continuously visible above it.

## Changes
1. **Keep presentation inside the Smartboard**
   - Replace the current body-level/topmost slide presentation with a Smartboard-owned presentation layer.
   - Request browser full screen from the Smartboard root, not from the slide itself, so the slide and Flow remain in the same full-screen composition.
   - Preserve the existing slide Back, Next, Exit, keyboard navigation, and step reveal behavior.

2. **Use an explicit layer order**
   - Render the slide as the full-board background layer.
   - Keep Flow character, Trail, and emotion controls above the slide.
   - Keep essential presentation controls above both, without bringing the ordinary writing board in front of the slide.
   - Do not restart, hide, reposition, or reset the Flow character when entering or leaving slide full screen.

3. **Stabilize the slide image**
   - Use the same fixed slide frame and fit calculation for every render instead of switching to a separate media-only sizing path.
   - Keep the slide centred and fitted to the Smartboard when browser full screen, resize, slide navigation, or Flow animation occurs.
   - Avoid remounting the active slide merely because Flow updates.

4. **Cover both ways of presenting slides**
   - Fix the full-screen button on an inline Canvas slide, as shown in the supplied image.
   - Fix the Smartboard Canvas menu presentation path so both produce the same slide-background/Flow-foreground result.

## Verification
- Open the supplied Smartboard lesson with Flow visible.
- Enter full screen from the inline slide and confirm the slide fills the board while the character remains visible and stationary.
- Navigate forward and backward and confirm the slide does not jump, resize, or flicker.
- Exit and re-enter full screen and confirm Flow does not restart or disappear.
- Repeat through the Smartboard Canvas menu.
- Verify desktop sizing and the current wide Smartboard viewport, then check the preview build and relevant focused tests.

## Technical details
- Reuse the existing Smartboard root context as the portal/full-screen owner.
- Introduce a shared Smartboard presentation-layer contract rather than relying on competing global `z-index` values.
- Keep lesson-note-only full-screen behavior unchanged outside the Smartboard.
