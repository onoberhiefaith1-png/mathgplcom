## 3. Sensor controls
- Double-clicking a slot with the mouse, or double-tapping it on a phone or tablet, moves the sensor into that slot so the player can write there.
- A single click or tap places the sensor at that exact spot.
- The four-arrow pad stays on screen. The keyboard arrow keys do the same moves.
- All four controls move the same single sensor, so they never fight each other.

## Testing
- **Text size:** the starting size matches the saved size on all three devices, and the player's minimum and maximum match the creator's.
- **Sensor entry:** it enters a new slot automatically, never enters Surface 0, and reaches a second slot further down.
- **Controls:** mouse double-click, pointer placement, the arrow pad and keyboard arrows all work, and double-tap works on a phone-sized screen.

## Technical notes
- `ImaginePlayPage.tsx`: replace the `textScale` multiplier (`scaleWritingTextSize`) with a player override of the device size, seeded from `resolveImagineTextSize`. Bound it with the editor's range from `responsiveSize.ts`.
- Sensor: reuse the existing Game branch in `PresentationView.tsx` (`treeMoveUp/Down/Left/Right`, `SensorDPad` in game chrome). Add auto-entry when a new empty `SLOT_GLYPH` slot appears in the active row, skipping row 0.
- Add Game-surface pointer handlers in `ImagineStage.tsx`. A single click maps a character position to the cursor, and a double-click or double-tap jumps into the nearest slot. Both reach PresentationView through one Game-only cursor setter.
- The Smartboard code paths stay as they are, gated by the game-chrome flag.
- Tests go in `responsiveSize.test.ts`, plus a pure slot-auto-entry helper test.
