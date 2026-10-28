# Sensor control and five-number strip (Game only)

## 1. Sensor you fully control
- The sensor is always visible on the writing surface.
- **Click / tap anywhere** on a writing surface: the sensor jumps to the nearest spot in the line you touched (not the nearest corner).
- **Click / tap a placeholder** (exponent, bracket, numerator, denominator): the sensor goes inside it straight away — single click, no double-click needed.
- **Arrow keys and the on-screen arrow pad**: Left/Right move along the line; Up/Down move between parts of a fraction or into/out of an exponent. When the move lands on a part that has an empty placeholder (e.g. moving down to an empty denominator), the sensor goes inside it.
- **New placeholder opens**: the sensor enters it by default. You can always step back out with the arrows or a click.
- Line 0 (the question) never receives the sensor.

## 2. The number strip always shows five
- Today, once the hidden unused numbers run low, the strip shrinks (5 → 4 → 3 → 2). That is the bug.
- Fix: whenever fewer than five unused numbers remain, the empty places are refilled with already-used numbers, oldest first, cycling round — as it worked before the new key/tile look was added.
- The tile look (compact keys on Smartboard, cream tiles in the Game), arrows and swipe stay as they are.
- Only when a line has fewer than five numbers in total does the strip show fewer.
