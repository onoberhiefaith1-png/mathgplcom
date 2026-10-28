# MathGPL Game — Blueprint and Performance Rebuild

Two parts. Part A is the written blueprint of the whole Game: every piece and what it is for. Part B is the rebuild that makes it instant, using that blueprint as the contract nothing is allowed to break.

---

## Part A — Blueprint of the Game

### Purpose
Practice must feel like play. A normal exercise gives a question and a mark. The Game gives the same mathematics inside a world the teacher designs, where each correct line unlocks something. The mathematics never changes — only the reward and the world around it.

### The two halves
- **Floating Numbers owns the mathematics.** The question, the lines, the tap-to-build number interaction, the timers, the marking, and the hidden Vault content. It is the single source of truth.
- **The Game owns the physical world.** Background, room, writing surfaces, reward objects, lighting, sound, and the repeating reward pattern. It never invents mathematics.

### Lines and surfaces
- Line 0 is the question. It is shown, never written on, never rewarded.
- Line 1, 2, 3… each map to exactly one writing surface with the same number.
- Exactly one line is active at any moment. Tapping a surface activates that line. The arrows move one line. Both do the same thing.
- A student may answer any line in any order.

### The writing surface
- Starts at its own compact minimum (empty lines stay small, like a block).
- Grows only from its own content, left edge at 5%, out to 95% of the screen, then wraps and grows downward.
- Surfaces never merge or overlap.
- Inside a room, the writing area also stops before the pillars — it starts after one and ends before the next.
- Every surface style (parchment, royal, crystal, wood, stone, leaf, magical, cloud, metal, silk, plain) draws a real visible body from its first frame. A style that fails falls back to the same material on plain geometry, never a white box.

### The teacher's editor
Background (image or video), room or no room, writing surface style and colour, text style, the repeating reward pattern across the 50 slots, sound and music, and Save. Questions are never typed here — they arrive from Lesson Notes through the assignment pipeline.

### Rewards
- **Completion mark** — universal, on every line, not configurable. Fires the instant a line is judged correct.
- **Life** — extra time, with a 0.1×–10× multiplier of total game time.
- **Coin / Collectors** — travel across the world and consume eligible rewards along their path.
- **Bomb** — removes only currently visible rewards. Never touches hourglasses, completion marks, or competition indicators.
- **Hourglass** — generated automatically from the line timer, never placed by hand.
- **Vault** — the gold-and-blue cylinder. The teacher selects mathematical steps in Floating Numbers GAME mode; the content is stored hidden. When the student writes that exact sequence of steps, the cylinder opens, the hidden text is revealed, and it is collected once. It rewards following the teacher's method.

Every reward belongs to a specific line. Rewards are collected once per run. Reset clears the run and the writing, never the teacher's design.

### Marking
The AI marks a line the moment that line is complete — not when the student moves on. The mark is what advances the game.

---

## Part B — The rebuild

### 1. One engine, one loop
A single Game runtime holds: saved design (never changes during play), run state (marks, rewards, timers), and view state. One clock, one animation loop with delta time. Today about fifty separate timers and loops fight each other — that is what makes taps land late. All of them move onto the one loop.

### 2. Instant input
A tap changes the screen immediately and saves in the background. Nothing waits on the network or on the marker. Saving happens at checkpoints only (line complete, question complete, game complete), debounced.

### 3. Marking the moment a line ends
Marking is triggered by line completion, runs in the background, and its result lands on the completion mark and the reward. The student never has to leave the line to get the mark.

### 4. Open fast
The board shows in stages: the current question and its lines first (board interactive), then nearby rewards and the next line, then the premium effects and audio. Input is never blocked while the later stages arrive.

### 5. Fewer objects per surface
Each surface currently builds around seventy separate pieces. Shared materials, cached letter shapes, shared reward geometry and instancing bring this down sharply without changing the look. Only the visible surfaces are built at all (already 5 of 50 — this is kept).

### 6. Background video
One video element, created once, never rebuilt when anything else changes, never copied frame by frame into the 3D scene.

### 7. Fix the two live faults
- Cloud surface starting as plain white panels and rendering oversized and clipped.
- The remaining board-load freeze on phones.

### 8. Memory and recovery
Everything disposed on leaving a game; caches capped; the existing graphics-loss recovery kept, and a render failure can never overwrite the teacher's saved design.

### 9. Quality that adapts, never degrades by default
On a weak phone the engine reduces particle counts, shadow resolution and post-processing — in that order. It never changes materials, surfaces, rewards or layout. A strong machine sees the full design.

### 10. Backend and storage
The heavy cost here is in the browser, not the server, so raising the server alone will not fix taps. Still, per your instruction I will scale the backend well above measured need: increase the compute instance and the storage headroom to a large multiple of current use, so asset delivery, saves and marking calls never queue. I will bring the size options up for your approval before applying, since it changes your running cost.

### 11. Developer readout
`?perf=1` keeps showing frame time, draw calls, objects, materials, textures, memory, and which stage the board is in — so slowness is measured, never guessed.

---

## Verification before I report back
Played end to end on your real Year 5 Games at phone size, signed in as your teacher account:
board visible in under two seconds; every tap responds at once; surfaces 1–5 each activate their own Floating Numbers line and stay; a correct line marks immediately and fires its reward; Vault opens on the exact sequence; bomb, coin, hourglass, life behave as specified; cloud and silk surfaces show their real design; a room game writes between the pillars; reset clears only the run; reopening shows the design exactly as saved.

## What does not change
The look, the materials, the rewards and their artwork, the Vault cylinder, the mathematics, Floating Numbers behaviour, saved games, and the mobile Floating Numbers panel.
