# Doors must always open their own room

Right now opening a door sometimes drops you back into the Academy instead of taking you inside the room. The reason is that "going through a door" is not one piece of code — it is spread across a click handler, a camera glide, a timer, a hidden pending slot, and an older Academy browsing mode that still lives in the same screen. Any one of those can win the race, and that is why the fault keeps coming back after being patched.

The fix is the one you asked for: remove that scattered mechanism completely and rewrite door entry as a single, self-contained piece of logic with its own tests, so there is only one possible outcome of a door click.

## What changes

- One entry decision, made the moment a door is clicked: which room, where you stand inside it, which way you face. Nothing later can change or cancel it.
- The camera glide becomes purely decorative. If it is slow, interrupted, or skipped, you still end up inside the room.
- The old Academy browsing mode (the room carousel and the shelf/showroom screens) is removed from the building screen. It is the only path that could send a click to the Academy, and the building no longer needs it.
- A door whose room is missing says so clearly and stays shut. It never falls back to another place.
- Leaving the room puts you back in the hallway exactly where you were standing.

## What stays untouched

Hallway walking and junctions, door look and placement, the keypad lock, the Building Map, frames, windows, the Smart Screen, lighting, and the room interiors all stay exactly as they are.
