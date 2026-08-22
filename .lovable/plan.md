# Hand Cursor Freeze — Find and Clear the Stale Interaction Layer

## What the investigation already shows

I inspected the live page and the code before writing this plan. Confirmed facts:

- The homepage body element currently carries an inline `cursor: default` written by application code — not by CSS, not by any element under the pointer. So the app really does take over the global cursor.
- Four 3D scenes set `document.body.style.cursor = "pointer"` when the pointer enters a building and back to `"default"` when it leaves: the homepage rotating building (`RotatingAdventureScene`), the adventure portal, the building archive, plus the glb viewer path.
- The homepage scene is the one with **no reset**: the portal scene and the archive both reset the cursor when they unmount, the homepage rotating scene does not. Its only writes are the hover in/out handlers.
- The same homepage canvas handles `webglcontextlost` by pausing paint. When the graphics context drops (this project has logged `THREE.WebGLRenderer: Context Lost`) or when the scene stops receiving frames, the pointer-out event never fires — the body is left on `cursor: pointer`, and the 3D hotspots are dead because the scene is no longer raycasting.

That reproduces the reported symptom exactly: hand cursor appears, the picture still looks normal, clicks on the world do nothing, and a refresh (which rebuilds the body style and the canvas) fixes it. So the hand cursor is the fingerprint of a scene that stopped interacting, and the global body cursor is the state that a refresh clears.

One further signal: of the two preview tabs open right now, one answered a DOM probe instantly and one did not answer at all — consistent with a tab stuck in exactly this state.

Diagnosis confidence: the global-cursor leak is confirmed in code and in the live DOM. Whether a stale overlay *also* contributes is not confirmed — the live scan found no invisible full-screen interactive layer on the homepage, so the plan verifies overlays rather than assuming them.

## What will be built

### 1. Stop the app from owning the global cursor
- The 3D scenes stop writing `document.body.style.cursor`. The cursor is set on the canvas element itself (`cursor: pointer` when a building is under the pointer, `default` otherwise), so it can never outlive the scene.
- Any remaining global cursor write is cleared on unmount, on route change, on context loss, and on window blur.
- Rule for the whole app: the page cursor is the default arrow; only genuinely clickable controls and explicit tool modes (drawing, crosshair, resize) set their own cursor, scoped to their own element.

### 2. Interaction-state reset service
A single small service that clears temporary interaction state whenever an interaction ends — navigation, panel open/close, leaving a page, workspace switch, exiting a tool, end of drag or selection, closing a modal, finishing an AI operation, changing Smartboard mode:
- release pointer/mouse capture
- drop drag, selection and hover state
- clear tool/sensor mode
- clear cursor overrides
- clear any leftover overlay/loading flag

Nothing temporary is allowed to survive the operation that created it.

### 3. Pointer-event safety pass
Audit every full-screen fixed/absolute layer (gradients, glows, fades, watchdog and loading surfaces). Decorative layers get `pointer-events: none`; only real controls stay interactive. Same rule applied to the Smartboard's overlay stack and the slide/geometry capture layers.

### 4. Graphics-context recovery for the homepage scene
The homepage canvas moves onto the shared recovery hook already used by the other scenes: pause on loss, resume on restore, reset hover/cursor state on both edges, single last-resort remount. No reloads.

### 5. Silent self-heal (no refresh)
Extend the existing freeze monitor so that, when the interface is blocked or a scene is dead, it:
1. records which element is actually under the pointer,
2. clears stale interaction state and cursor overrides,
3. re-arms the affected listeners and scene,
4. keeps the page and the teacher's work exactly as they were.

Never a page reload. The only user-visible sign stays the existing small connection chip.

### 6. Reproduce and verify
Drive the real app in a browser: open the homepage, confirm the arrow cursor, hover buildings, force a context loss on the canvas, navigate away mid-hover, then check with `elementFromPoint` and the computed body/canvas cursor that (a) the cursor is back to arrow, (b) the element under the pointer is the expected control, (c) clicks still land — all without refreshing. Repeat on the Smartboard with the sensor/tool active.

## Technical notes

- Files in scope: `RotatingAdventureScene.tsx`, `AdventurePortalScene.tsx`, `RotatingBuildingArchive.tsx`, `GlbViewer.tsx`, a new `src/lib/stability/interactionReset.ts`, `freezeMonitor.ts`, and the overlay layers found by the pointer-events audit.
- Reuses existing `useWebglRecovery`, `registry`, `freezeMonitor` and `watchdog` rather than adding a new framework.
- No cursor cosmetics as a fix: the cursor is corrected only as a consequence of clearing the state that caused it.
- No schema changes, no data reset, no automatic reloads.
