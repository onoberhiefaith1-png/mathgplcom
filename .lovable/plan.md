# Instant Game startup and response

## Goal
Open Game Edit and Game Play behind one large, centered ancient-temple loading screen, then reveal only the exact saved Game when its real writing surfaces are visible and clickable. Remove the temporary white slabs permanently and make writing, line selection, timers, marking, and rewards respond without browser stalls.

## What will change

### 1. Replace the false writing surfaces with a real loading state
- Build the selected ancient-temple loader as a reusable full-screen Game layer: central rotating seal, large `LOADING...` treatment, restrained amber progress pulse, and reduced-motion support.
- Keep the saved background visible beneath the loading treatment where it is already available; never show substitute writing-surface geometry.
- Use the same loading experience in Game Edit, Game Play, initial data loading, lazy world loading, and graphics recovery.
- Remove the small corner loading notice and prevent Game controls from accepting input until the real stage is ready.

### 2. Define readiness by the real Game, not by the canvas
- Add one readiness signal from the mounted real writing-surface tree after its first rendered frame and pointer targets exist.
- Keep the full-screen loader present until both the Game data and the real writing surfaces are ready.
- Reset readiness safely after graphics recovery, then reveal the rebuilt real stage again.
- Keep recovery and error handling, but make the emergency state a loading/recovery screen rather than fake white boards.

### 3. Stop fonts and optional art from withholding the board
- Warm the local Game font before mounting three-dimensional labels.
- Isolate optional labels and reward text behind small local loading boundaries so one font or artwork delay cannot replace the entire slate.
- Keep surface geometry and hit targets independent from optional textures, lighting, reward art, and visual effects.
- Treat any future whole-board fallback activation as a monitored fault instead of a normal first frame.

### 4. Remove startup work that blocks clicks
- Move procedural surface-detail generation out of the first render; begin with the existing safe material and attach the detailed map after the board is interactive.
- Preserve the final saved material appearance once the deferred detail is ready.
- Load only visible/used reward artwork and keep premium lighting, environment maps, audio, and effects in later boot stages.
- Parallelize independent Game, identity, ownership, and assignment reads where safe, while preserving all access and assignment rules.

### 5. Stop rebuilding the whole stage for each symbol
- Keep unchanged line/surface objects stable when Floating Numbers changes one line.
- Update only the affected writing surface rather than recreating every slot and reward object on each animation frame.
- Preserve the canonical line ID mapping, Surface 0 rules, dynamic surface growth, exact Edit→Play parity, notes, and reward state.
- Ensure the Floating Numbers control updates first; the three-dimensional lettering follows in the same painted frame without queuing work.

### 6. Reduce continuous phone workload without changing the look
- Skip dormant reward animation work when an object is outside the visible writing region or already settled.
- Keep active, hovered, collected, timer, Vault, Bomb, and Collector animations on the coordinated Game clock.
- Preserve the current default visual quality; adaptive quality may reduce only expensive secondary effects during an actual slow frame window, never writing clarity or configured assets.
- Isolate any remaining heavy Floating Numbers subtrees only if browser profiling shows they still delay symbol feedback after the stage fixes.

### 7. Preserve instant marking and reward activation
- Keep the shared server-side mathematics evaluator as the sole grading authority and the current proactive active-line check.
- Confirm a completed expression is marked while the student remains on that line.
- Confirm completion and every eligible line reward activate from the same awarded-line event, with no wait for navigation.
- Distinguish network evaluation time from browser stalls in diagnostics so later performance work targets the correct layer.

## Verification
- Cold-open Game Edit and Game Play on desktop and phone: no white slabs appear at any point.
- Confirm the chosen centered loader remains until the exact saved surfaces are visible and clickable, then exits in one clean reveal.
- Test direct taps on Lines 1, 2, and 3, rapid symbol entry, active-line retention, scrolling, timers, reset, save, and graphics recovery.
- Test immediate correct-line marking and simultaneous reward activation without moving to another line.
- Compare startup-to-interactive time, symbol-to-visible-text latency, long tasks, frame stability, and timer continuity before and after the changes using the existing performance diagnostics.
- Run focused Game/Slate, Floating Numbers grading, layout, reward, and persistence tests plus the project type check.

## Technical notes
- The white slabs are the current whole-slate loading fallback. The real slate is suspended by first-use three-dimensional font work, while the existing readiness flag currently means only that the graphics canvas exists.
- The largest confirmed browser-side costs are synchronous procedural material generation during render, whole-Game slot reconstruction for each live text update, and per-frame work across dormant rewards.
- “10× faster” will be treated as a measurable target for perceived response, not an artificial animation change: the implementation will remove blocking work and record before/after interaction timings.
