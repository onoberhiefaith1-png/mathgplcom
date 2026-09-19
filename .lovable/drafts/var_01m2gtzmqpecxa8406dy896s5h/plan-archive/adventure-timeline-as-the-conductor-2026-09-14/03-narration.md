## Narration boundary rules

```text
0:00 ────── A ──────│ 0:36 ══ LOOP ══ 0:43 │────── B ──────
                    │                      │
     A stops here ──┘   loop repeats,       └── B starts at
                        narration does not      its own position
```

- Clip starting before a loop: cut at loop start.
- Clip starting inside a loop: cut at loop end, no restart on the next lap.
- Seek: whatever is speaking stops, and the clip for the new position takes over.

## Technical notes

- `src/lib/games/narration.ts` — `useNarrationPlayback` gains a boundary argument (current loop region + playhead). New pure helper `narrationWindow(clip, regions)` returns the allowed `[start, end]` for a clip so a crossing outside it never fires, plus a `stopAt` tick check that stops the channel when the playhead leaves that window. `onLoopStart` no longer re-fires clips on every activation for `once`; `repeat` still fires per activation but is clipped to the region.
- `src/components/gamebuilder/NarrationPanel.tsx` — `selectedId` starts `null` instead of `narrations[0]`; `addClip` no longer selects the new upload; Assign uses only the explicit selection; the selected row keeps its highlight and is the only one showing name/Play Once/Repeat.
- `src/pages/GameEditorPage.tsx` — `insideActiveLoop` already exists; use it to disable the Reward / Progress Bar / Timer / Add Effect buttons and to render the "Editing Learning Point N" chip. Preview HUD renders bar/timer readouts from `preview.activeLoopId` only, and the existing `visibleElements` filter (already loop-scoped) stays as the single source for on-canvas objects. Seeking calls `narrationRuntime.stop()` before recalculating the region.
- `src/lib/games/loopRuntime.ts` — `loopRegionFor` stays the single region resolver; add a small `regionOf(t, checkpoints)` reuse of `checkpointAt` for narration windows so nothing runs on an independent clock.
- Gallery gating: a shared `canUseClassGallery()` check based on the platform-owner role, applied to the Gallery entry points and warnings in `src/pages/class/AdventureDashboardPage.tsx`, `src/pages/GameEditorPage.tsx`, `src/pages/student/GamePlayPage.tsx` and the class/adventure Gallery navigation items. When it is off, the Gallery UI and every "not yet linked / not set" message simply do not render; award writing paths are untouched.
- No database or schema change. Focused tests cover narration windows (before-loop cut, inside-loop cut, no loop restart, post-loop start), region-aware control gating, and Gallery visibility for owner vs other teacher.
