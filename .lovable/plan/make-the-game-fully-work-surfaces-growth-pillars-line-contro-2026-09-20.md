# Make the Game fully work: surfaces, growth, pillars, line control, phone

## What I checked

- Your chosen surface **is** saved (your games hold `new-cloud-panel`, `magical-aura`, `silk-ribbon`, `stone-wall`), so the picker works and the board is the part not showing it.
- All surface material pictures load fine from storage (every one answered 200), so this is not a missing-file or storage-space problem.
- The board only draws a plain cream panel for one style ("Plain"); the premium styles (cloud, silk, magical, royal, crystal, parchment) build their bodies through animated growth helpers, and when a panel's width/height starts at its minimum the decorated body can end up invisible — leaving the bare white panel you saw.
- Room pillars stand at a fixed distance apart. On a wide screen the writing area is 90% of the screen, which is wider than the gap between the pillars, so writing can sit behind a pillar.
- Tapping a surface already calls the one shared line selector, but the tap only works on the visible panel body — on small/empty panels there is little to hit, which is why it sometimes seems to do nothing.
- One script error is being reported on your phone (`Can't find variable: v`). I will track it down and fix it, since a crash inside the board layer would also leave a blank/white panel.

## The fix

### 1. The surface you pick always appears
- Every surface style draws a real, visible body the moment the panel exists, at its minimum size, before any growth animation runs.
- Growth animates the panel it already drew; it can never leave a frame with nothing drawn.
- A style that fails to build falls back to the same material with plain geometry, never to a white box, and reports itself in the developer readout instead of failing silently.
- Per-line surfaces use their own material family, so a line with a different style is not painted with the game's material.

### 2. Surfaces grow from small
- Each panel starts at its compact minimum and grows only from its own measured content, independently of the others, up to the safe right edge, then wraps and grows downward. Empty lines stay compact.

### 3. Pillars never cover the writing
- Compute a safe writing span per room from the actual pillar/prop positions and the panel depth.
- The writing area becomes MIN(90% of the screen with 5% margins, the room-safe span), so the panel starts after the left pillar and ends before the right one.
- Roomless games keep today's full 5%–95% band.

### 4. Surface N controls Floating Numbers line N
- Give every panel a reliable tap area covering its full drawn width and height, including empty ones, so tapping panel 4 activates Floating Numbers line 4 and stays there.
- Keep the single shared line selector; tap, arrows and scrolling all go through it. Surface 0 stays the read-only question.

### 5. Phone and real-time play
- Board controls, settings sheet and Play strip stay fully on screen at phone sizes; tap and swipe both work with no phone keyboard.
- Keep files light: surface materials load per style actually in use (not the whole catalogue), reuse cached materials and letter shapes, and keep the existing reduced-size reward art. No extra storage needed — current assets already fit comfortably.

## Testing (real, on a phone-sized screen)

On a saved game, signed in, at 428x679 and 390x844, with screenshots:
1. Pick stone, wood, cloud, silk and magical in turn — each visibly appears on the board straight away, no white panel.
2. An empty line is compact; typing makes only that line grow, then wrap.
3. Switch a test copy of the game into a pillared room: confirm the writing starts after the left pillar and ends before the right one, at phone and desktop widths.
4. Tap panels 1, 2, 3, 4 and 7 — the matching Floating Numbers line activates each time and does not jump back.
5. Play runs smoothly with taps responding immediately; no console errors, including the `v` error.

## Not changing

The Game's look and identity, materials, rewards, Vault, timers, the mathematics, Floating Numbers behaviour, or your saved designs.

## Technical notes

- `NewWritingSurface.tsx`: draw-then-animate for every `newKind`; `useExpansion` starts from the current target rather than a zero/undefined state; guard geometry builders (`premiumSurfaceGeometry.ts`) against degenerate width/height.
- `SlateColumn.tsx`: per-line `usePbr(surfaceFamily(lineSurface.id))`; hit mesh sized to drawn panel; keep `onSelect` → `setActiveLine` ownership.
- `rooms.ts` / `RoomShell.tsx`: export a `safeWritingSpan` per room from prop geometry; `layout.ts` `gameWritingWidth` takes it and returns the min.
- Trace `ReferenceError: v` via a production build and source maps.
