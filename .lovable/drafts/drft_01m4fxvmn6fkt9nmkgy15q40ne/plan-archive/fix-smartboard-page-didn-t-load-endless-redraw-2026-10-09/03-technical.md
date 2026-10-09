## Technical details
- `src/lib/smartboard/reviewProperties.tsx`: registry keyed by `diagramId` with a ref-count; `register` increments and only calls `syncCandidates` on 0→1; unregister decrements and schedules removal via microtask, cancelled if re-registered; same-id updates mutate `scene` without `emit`. `syncCandidates` skips emit when candidate ids are unchanged.
- `ReviewableBoardDiagram.tsx`: single effect that registers on mount and unregisters in cleanup, depending only on `reviewable` and `diagramId`; scene refresh via a separate non-emitting `update` call.
- Add a test: repeated mount/unmount/remount of the same diagram emits at most once; reproduce on `/smartboard/a403e855-…` in the browser to confirm the page loads.
