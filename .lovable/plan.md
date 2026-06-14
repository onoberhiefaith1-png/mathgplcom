# Adventure Effect System & Motion Engine

Turn the current "drop a video on a scene" flow into a lightweight game-editor inspired effect engine. All customization happens in a visual Property Panel on the right side of the selected scene — zero AI generation.

## Scope

Everything below is frontend + scene JSON only. No new AI calls, no new edge functions. Effect library reuses the existing `Assets → Video Effects` catalog plus teacher uploads.

## Data model (extend `LayoutItem` for `kind: "effect"`)

Stored inside `scene.layout_json.items[*]` (already a JSONB blob in `notebook_blocks`/`adventure_scenes`, so no migration needed):

```text
effect item {
  id, kind:"effect", src, label, x, y, w, h,    // existing
  rotation:    0-360                            // deg
  opacity:     0-1
  zIndex:      number                           // layer order
  blendMode:   "screen" | "normal" | "multiply" | "lighten"
  motion: {
    type: "static"|"left"|"right"|"up"|"down"|"circle"|"figure8"|"random"|"path"
    speed: 0.25..8                              // multiplier
    amplitude: number                           // px / % for built-ins
    path?: [{x,y}, ...]                         // for "path"
  }
  playback: {
    direction: "forward"|"reverse"|"pingpong"
    speed: 0.25..4
    loopMode: "forever"|"once"|"count"
    loopCount?: number
    enterEnd?: number      // seconds — end of ENTER state
    activeStart?: number   // seconds — loop start
    activeEnd?: number     // seconds — loop end
    exitStart?: number     // seconds — start of EXIT state
    freezeLastFrame: boolean
  }
  trigger: {
    start: "always"|"sceneStart"|"questionSolved"|"obstacleCleared"
         |"doorOpened"|"vaultOpened"|"sceneComplete"|"custom"
    delay: number                               // seconds
    exitOn?: same enum
    exitBehavior: "instant"|"fade"|"shrink"|"explode"|"playExit"|"custom"
  }
}
```

Scene-level additions (stored in `scene.config`):
```text
camera { startX, startY, endX, endY, speed, zoomStart, zoomEnd }
```

All fields are optional with sensible defaults so existing scenes keep working.

## UI changes

### 1. Property Panel (new) — `EffectPropertyPanel.tsx`
Slides in from the right of `SceneFrame` when an `effect` item is selected. Replaces the current bare drag/resize-only UX. Sections (collapsible):

- **Transform** — X, Y, Width, Height sliders + numeric inputs; Rotation slider with 0/90/180/270 quick-buttons; Opacity slider; Scale preset chips (50/100/150/200/300%).
- **Layer** — Bring Forward / To Front / Send Backward / To Back buttons (mutate zIndex).
- **Motion** — Type dropdown; Speed slider (0.5×/1×/2×/4× chips); Amplitude slider (where relevant); `Edit Path` button enabling on-canvas path mode (click to add A→B→C→D points; drag to adjust; right-click to remove).
- **Playback / Timeline** — Mini timeline scrubber bound to the `<video>` `duration`. Four draggable handles: `enterEnd`, `activeStart`, `activeEnd`, `exitStart` carving the clip into Enter / Active (loop) / Exit segments. Direction (Forward/Reverse/Ping-Pong) + Loop mode (Forever / Once / X times) + Freeze Last Frame toggle + Speed.
- **Trigger** — Start trigger dropdown, Delay (0/1/2/5/10 s chips + custom), Exit trigger dropdown, Exit behavior dropdown.

### 2. Effect Library modal — `EffectLibraryModal.tsx`
Replaces today's tiny `EffectMenu` popover. Browses `ADVENTURE_EFFECTS` (already auto-pulls from `src/assets/effects/video-fx/`) grouped by category, with thumbnail preview, search, and a "Upload custom" button (asset upload via existing pipeline).

### 3. Camera panel — `SceneCameraPanel.tsx`
Floating panel per scene. Two draggable markers on the scene frame for Start and End, plus Speed and Zoom sliders. Preview button animates the frame using a CSS `transform` to demo the move.

### 4. Runtime renderer — extend `ItemBody` in `SceneFrame.tsx` (editor) and the player counterpart
- Wrap effect video in a positioned div applying `transform: translate · rotate · scale`, `opacity`, `zIndex`, `mixBlendMode`.
- Motion: a single `requestAnimationFrame` loop drives `x/y` offset based on `motion.type` (static = noop, directions = linear, circle/figure8 = parametric, random = perlin-ish jitter, path = lerp through points).
- Timeline state machine: `enter → active(loop activeStart→activeEnd, honoring direction/pingpong) → exit`. Implemented by listening to `timeupdate` and using `video.currentTime` setters; on `loopMode:"once"` skip the active loop.
- Triggers wired through a tiny `SceneEventBus` (in-memory) so gameplay events (`questionSolved`, `doorOpened`, etc.) can flip an effect from `enter` to `exit`.

## Files

New:
- `src/lib/adventure/effectDefaults.ts` — defaults + helpers (`withEffectDefaults`, `clampTimeline`).
- `src/lib/adventure/motionEngine.ts` — `useEffectMotion` hook (rAF loop, returns transform).
- `src/lib/adventure/timelineEngine.ts` — `useEffectTimeline` hook (Enter/Active/Exit state machine on the `<video>`).
- `src/lib/adventure/sceneEvents.ts` — pub/sub for triggers.
- `src/components/adventure/editor/EffectPropertyPanel.tsx`
- `src/components/adventure/editor/EffectTimelineEditor.tsx`
- `src/components/adventure/editor/EffectPathEditor.tsx`
- `src/components/adventure/editor/EffectLibraryModal.tsx`
- `src/components/adventure/editor/SceneCameraPanel.tsx`

Edited:
- `src/lib/adventure/types.ts` — extend `LayoutItem` and `AdventureScene.config` typing as above (all new fields optional).
- `src/components/adventure/editor/SceneFrame.tsx` — show panel on selection, render with new transform/motion/timeline hooks, replace `EffectMenu` with `EffectLibraryModal`, mount `SceneCameraPanel`.
- `src/components/adventure/editor/DraggableResizable.tsx` — accept `rotation`, render rotated bounding box and rotated resize handle.

No DB migration: everything lives in the existing JSONB `layout_json` / `config` columns.

## Out of scope (intentionally)
- Multi-effect timeline orchestration UI (we ship per-effect timeline now; cross-effect cinematic sequencing can be a v2).
- AI-driven motion suggestions.
- Server-side video re-encoding.

## Build order
1. Types + defaults + sceneEvents.
2. Motion engine + timeline engine hooks (with stub UI).
3. Property Panel + Path Editor + Timeline Editor.
4. Effect Library Modal (replaces old popover).
5. Scene Camera Panel.
6. Wire trigger events from existing gameplay buttons (question solved / door opened / vault claimed).
