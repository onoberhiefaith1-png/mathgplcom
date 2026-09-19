# Critical Game fix — Edit and Play must be visually identical

The teacher’s saved Game is the only design source. Play will use that same saved object and the same 3D rendering path; only live Floating Numbers content and run progress may differ.

## Confirmed from the screenshots and saved Game

- The screenshots show the same background but different writing surfaces and text treatment between Edit and Play.
- The saved Game currently contains **Cloud** as its writing surface and **Royal 3D** text with the teacher’s saved face/depth colours. Save did not lose those choices.
- Play loads that saved Game, but then assembles new question slots before rendering. That assembly boundary is where visual parity must be enforced and tested.
- The current `restartGame` resets the Game counters in memory, but it does not clear the mounted Floating Numbers writing or all saved line/progress state. That is why it is not yet a complete Game Reset.

## Build

### 1. One canonical saved Game configuration

Keep one saved Game configuration for background, room, global writing surface, surface colour, text renderer settings, line-specific surface overrides, dimensions, lighting/effects, and reward positions. Remove any Play-only visual defaults or substitutions.

Create one resolver for a rendered line:

```text
Saved Game configuration
        + optional saved override for this exact lineId
        + live Floating Numbers text for this run
        = rendered Game line
```

A missing line override inherits the saved Game value. It never falls back to a newly created default.

### 2. Shared Edit/Play renderer

Feed both Edit preview and Play through the same resolved line model and the same `WorldStage` / writing-surface / 3D-text components. Play may replace only slot identity, live mathematical text, completion state, and runtime reward state; it must not replace surface, text material, colour, depth, size, effects, scale, lighting, or saved reward coordinates.

Add focused parity checks for the current Cloud + Royal 3D case and for another contrasting surface/style combination.

### 3. Preserve exact teacher appearance

Verify and carry through:

- surface shape, material, texture, colour, border, ornament, depth, adaptive sizing, scale, light, shadow and position;
- text font/style, preset, face colour, depth colour, extrusion, bevel, outline, highlight, glow, shadow, size, spacing and animation;
- section-number treatment;
- reward type, position, scale, depth, material, lighting, animation and effect settings;
- per-line surface choice, Hourglass relationship and Vault configuration.

The question line and every solving line use the same saved appearance rules. Surface N, Floating Numbers Line N, timers, Vaults, rewards and completion remain keyed by the same line ID.

### 4. Separate editor test writing from Play mathematics

Typing directly on a surface in Edit remains a temporary appearance preview. It will not be part of the saved playable content and will never appear in Play.

Play continues to be read-only at the 3D surface level. The existing Mobile Floating Numbers panel is the only student input; its live mathematical structure is rendered onto the active physical surface through the saved 3D text style.

### 5. Complete Game Reset at the top

Add a clear **RESET** control to the Play HUD. After confirmation it will:

- clear the current run’s Floating Numbers board caches and mounted writing;
- clear this student’s Game progress, completed lines/questions, consumed rewards and temporary timer-attempt state for this Game run;
- restore starting lives, zero the Vault total and earned marks, restart the question timer, return to Question 1 / Line 1, and remount the existing Floating Numbers panel cleanly;
- clear active reward animations and temporary messages/effects.

It will not modify or delete the saved Game design, assigned questions, line timers, Vault codes, reward configuration, or the teacher’s lesson-note mathematics.

### 6. Refine the existing HUD without changing gameplay

Keep the HUD restrained and readable as **TIME | LIFE | VAULT**, using compact premium game-style icon treatment. Never call Vault currency Coin/Coins. Keep question time and line time distinct. The functioning Hourglass logic stays unchanged and remains on the right side of its own line.

## Verification

1. In Edit choose Cloud, Royal 3D, custom face/depth colours, text size/effects, surface scale, and moved rewards; type unmistakable preview-only text; Save.
2. Open Play and compare screenshots: every saved visual value and reward coordinate matches, while the preview-only text is absent.
3. Press Play: Mobile Floating Numbers appears; its work is rendered in Royal 3D on the Cloud surface for the active line.
4. Tap/scroll between several surfaces and use line arrows; the same active line controls surface, Floating Numbers, timer, Hourglass, Vaults, rewards and completion.
5. Refresh Play and confirm the saved design remains identical.
6. Make progress, write on several lines and activate rewards; press RESET and confirm all run writing/progress/effects clear while the Cloud/Royal 3D design and teacher configuration remain unchanged.
7. Repeat as a teacher test and an assigned student, then run focused Game tests and responsive desktop/mobile checks.

## Not changing

No new mathematical input, AI checker, Smartboard, text renderer, reward engine or Play configuration will be created. Lesson Notes remain the source of questions; Floating Numbers remains the mathematics and checking engine; the Game Slate remains the physical world.
