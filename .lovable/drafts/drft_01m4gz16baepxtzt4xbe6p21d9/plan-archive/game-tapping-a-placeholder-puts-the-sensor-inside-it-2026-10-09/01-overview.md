# Game: tapping a placeholder puts the sensor inside it

Game only. Smartboard, Academia and Floating Numbers stay as they are.

## Why it fails today
On the Game writing surface the line is drawn as a read-only picture. That picture throws away every tap: the placeholder box never hears your click. The tap falls through to the whole line instead, and the line only knows "start" or "end". So the sensor lands at the start or end of the line, never inside the placeholder.

## What you will get
1. **A new placeholder takes the sensor by default.** When a bracket, power, fraction or other placeholder appears, the sensor goes straight inside it. This already works and stays.
2. **Tapping a placeholder puts the sensor inside it.** This works on any placeholder on the line: numerator, denominator, exponent or bracket. It works with a mouse click or a finger tap.
3. **Tapping outside a placeholder brings the sensor out.** Tap a number or symbol on the line and the sensor sits right beside it, back on the main line. Tap empty space on the surface and it goes to the start or end of the line, whichever side is nearer.
4. **The keys still work.** Left, right, up and down keys and the on-screen arrows keep moving the same single sensor.
5. **Q never takes the sensor.** The question surface stays closed to it.
