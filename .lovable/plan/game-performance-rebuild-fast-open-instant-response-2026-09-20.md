# Game performance rebuild — fast open, instant response

Same Game, same look. The engineering underneath is rebuilt so it opens quickly and answers every tap immediately.

## What the measurements already show

Read from the live code, not guessed:

- **Every material image in the whole Game loads before the board can appear.** The board waits on one combined load of 30 writing-surface images plus 22 room images, and every one of them must finish before a single surface is drawn — even though one Game uses one surface style and at most one room. The image folder is 56 MB.
- **On top of that, each surface and each room part loads a four-image scanned material set** (colour, bump, roughness, shading). Walls, sides, floor and ceiling each load their own set.
- **All reward effect images load at startup**, before any reward is used.
- **The Game currently runs about 50 separate timing and animation loops.** The writing-surface file alone holds 9, the effects file 7. They are not coordinated, which is what makes taps feel late and animations start roughly.
- **Shadows are drawn at high resolution for the whole room**, every frame.
- The single clock, single active line, live background and per-tap guard already landed in earlier work and stay.

The 45-second open is dominated by the image loading above, not by the database. The delayed clicking is the uncoordinated loops and the work done on the frame where you tap.

## The rebuild, in stages

### Stage 1 — Open fast (biggest win)

- Load **only** the images the opened Game actually uses: its one surface style, its one room, its background. Nothing else.
- The board draws as soon as those are ready; room detail, scanned material detail and effects continue arriving afterwards without holding the board back.
- Reward effect images load the first time a reward is armed, not at startup.
- Shared image/material/geometry manager: the same image is fetched, decoded and uploaded to the graphics card **once** and reused everywhere, with a size suited to how large it is actually shown.
- Room parts reuse one wall material family instead of loading four variants of it.

### Stage 2 — One coordinated engine

- One master frame loop drives everything: world, surfaces, rewards, effects, floating objects. The scattered ~50 loops are folded into it and time-based, so speed is identical on every machine.
- Every animation gets explicit states (dormant → starting → active → finishing → released). Dormant rewards do no work at all; finished effects release their particles back to a pool instead of being rebuilt.
- Off-screen and inactive lines, rewards and effects are skipped each frame.

### Stage 3 — Instant input

- A tap updates the Game locally and paints the response in the same frame. Saving happens quietly in the background, never in front of the response.
- Correct-answer feedback shows immediately from local checking; the deeper written-work assessment continues in the background and only adds detail. Nothing about the mathematics rules changes — only the order, so you are never waiting on a round trip to see that you were right.
- Line switching by arrows and by tapping a surface stay on the one active-line value already in place.
- Reset restarts the run's state only: no page reload, no re-downloading the room or textures.

### Stage 4 — Room-aware writing area

- The visible safe writing region is computed from the active room's foreground pillars, so mathematics is never drawn behind a pillar.
- Final width is the smaller of the existing 90% screen band and the room-safe width; the 5% margins stay. Recomputed on every screen size — desktop, laptop, tablet, smartboard. Mobile layout untouched.

### Stage 5 — Lighting, shadows, memory

- Audit every light; keep the premium look with fewer real-time shadow casters and shadow maps sized to what is visible. Small objects, particles and text stop casting real-time shadows.
- Proper release of images, shapes, materials and video when a Game, room, background or question changes, so repeated play does not grow memory.

### Stage 6 — Server side

- One combined Game payload instead of a chain of dependent requests; independent pieces fetched at the same time; only needed columns.
- Large assets served from storage with browser caching so the second open is near-instant.
- Progress saved at meaningful checkpoints (line complete, question complete, run complete), never per tap.

### Stage 7 — Adaptive quality

- A built-in performance watch reduces decorative density first (particle count, effect richness, shadow detail) if a device struggles. Core visuals, 3D text, rewards, rooms, background and HUD are never downgraded.
- Developer-only readout (opens with `?perf=1`) extended to show frames per second, frame time, draw calls, triangles, image count and memory, active objects, request count, current question and line.

## How it will be proven

Measured before and after on the real saved Game, as a signed-in student:

1. Time from opening to a usable board (target: seconds, not 45).
2. Delay from tapping a Floating Number to visible response (target: same frame).
3. Frame time and dropped frames while playing with the video background and room on.
4. The 18-step play-through: tap numbers, write, switch lines both ways, tap a surface, check an answer, Life, Hourglass, Vault, Collector, Bomb, reset, change question, resize, room on and off.
5. Memory and image counts after repeated line and question changes.
6. Text never behind a pillar at desktop, laptop, tablet and smartboard widths.

Each stage is verified live before the next begins, and the readout numbers are reported back to you.

## Not changing

The Game's visual identity: the physical slate, rooms, backgrounds, 3D text and its depth, rewards and their artwork, Floating Numbers, premium effects, lighting mood, HUD. No flat 2D fallback, no removed effects, no lowered default quality. The mathematics rules, Vault matching, assignment flow and saved teacher designs stay exactly as they are.
