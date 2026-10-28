## Technical details

`src/lib/games/narration.ts`
- Delete `narrationWindow`, `windowRef` and the boundary-stop branch in `onTime`. Keep `narrationRegions` only as the helper that identifies the active loop region (rename intent: region lookup, not clipping).
- Track the active loop region id/bounds. In `onTime`, when the playhead wraps (`t < prev - 0.2`) **and** both `prev` and `t` sit inside the active region, treat it as a lap: update `lastTimeRef` and return without stopping, retriggering, or arming anything.
- Crossing detection ignores any timestamp that lies outside the active region while a region is active, so a clip pinned after loop end cannot be triggered by a lap passing loop end.
- `onLoopStart` keeps speaking clips pinned inside the region (Play Once guarded by `playedRef`, Repeat re-fires per activation); `firedAtRef` de-dup stays so `onTime` does not double-speak the same clip.
- `stop()` remains for explicit calls only: disable, run reset/new session, unmount, and the editor's seek handler.

`src/pages/GameEditorPage.tsx`
- Keep the existing `narration.stop()` on timeline seek (a deliberate scrub is not a lap). No other narration change.

`src/pages/ClassDashboardPage.tsx`
- Revert the owner-only Gallery tile condition added last turn: the Gallery section is listed for teachers as before. No other Gallery code is touched.

`src/lib/games/narrationWindow.test.ts`
- Replace window-clipping cases with lap cases: repeated wraps inside a region never call `stopChannel` and never re-fire a clip; a clip pinned after loop end does not fire on a lap crossing loop end; it does fire once the playhead moves past it after the point completes; an explicit backwards seek outside the region still stops.

Verification: focused narration tests, typecheck, and a preview load of the Adventure editor with a looping point plus a long narration to confirm continuous playback across laps.
