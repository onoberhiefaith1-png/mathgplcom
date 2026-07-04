## 1. Eraser follows the cursor in split-screen mode

**Root cause.** While dragging, the eraser icon renders with `position: fixed` and `left: clientX - 22, top: clientY - 22`. Because its parent `#sb-root` uses `transform: translateZ(0)`, CSS spec makes the transformed ancestor the containing block for `position: fixed`. So `left`/`top` are now measured from the 70% pane's top-left, but the numbers we feed are still viewport coordinates. When the 30% preview is open, the pane starts ~30% to the right of the viewport → the eraser draws that much left of the actual cursor. The same math is wrong for anything else that pins to `clientX/clientY` inside `#sb-root`.

**Fix.**
- In `PresentationView.tsx` where the dragging eraser is rendered (~lines 3917-3985), convert to `position: absolute` and translate viewport coords into pane-local coords using `boardScrollRef.current!.getBoundingClientRect()`:
  ```
  const r = boardScrollRef.current?.getBoundingClientRect();
  const localX = e.clientX - (r?.left ?? 0);
  const localY = e.clientY - (r?.top ?? 0);
  setEraserDrag({ x: localX, y: localY });
  ```
  Store pane-local coords in `eraserDrag`; keep the viewport `clientX/clientY` only for `wipeAt` / `eraseAtPoint` since those use `getBoundingClientRect()` internally.
- Audit `PresentationView.tsx` for any other place that assigns `clientX/clientY` directly to `left`/`top` on an element that lives inside `#sb-root`, and apply the same conversion. Sensor/hover/click hit-tests already use `rect.left`/`rect.top` subtraction, so they are unaffected; verify and leave them alone.

## 2. Presenter Preview sync initializes reliably every time

**Symptoms.** After some page loads only the Introduction highlights; after others sync stops entirely until reload.

**Root cause candidates in the current wiring.**
- `activePreviewBeatId = current?.id ?? null`. On first render `beats` is empty (notebook still loading) so `current` is `undefined` and the preview receives `null`. The preview's auto-scroll effect early-returns on `!activeBeatId`, and `lastActiveKey.current` gets stamped as `"null::"`. When beats hydrate and `beatCursor` snaps to 0, the id transitions from `null` → `"__cover__"`, which should fire — but if the notebook fetch inside `PresenterPreviewPanel` hasn't rendered the item refs yet, `itemRefs.current.get(activeBeatId)` returns undefined and the scroll is skipped, and no retry ever happens. This matches the "only Introduction highlights" and "stops after restart" reports.
- `PresenterPreviewPanel` uses its own `useNotebook(notebookId)` fetch, independent of the board. Two loaders means two race timelines.

**Fix.**
- In `PresenterPreviewPanel.tsx`, make the auto-scroll effect resilient:
  - Depend on `activeBeatId`, `activeLineIdx`, and `items.length` (already true) AND on a `readyKey` computed from `items.map(i => i.id).join("|")` so it re-runs after items finally render.
  - Inside the effect, if `activeBeatId` is set but the target ref is not yet mounted, schedule a `requestAnimationFrame` retry (up to ~10 frames) instead of returning silently. This eliminates the "refs not ready" race.
  - Do not clear `lastActiveKey` on empty ids; only stamp it after a successful scroll so a real position update always gets processed.
- In `PresentationView.tsx`, guarantee the preview always receives a real id once beats exist:
  - When `beats.length > 0` and `beatCursor < 0`, treat the effective cursor as `0` for `activePreviewBeatId`. Never pass `null` while beats exist.
- Header status ("Following teacher" / "Paused") remains driven by the manual-scroll flag; unchanged.

No new store, no new sync channel. The preview stays a pure reader of `beatCursor` + `activeLineIdx`.

## 3. Notes render on the Smartboard the same way as in the Preview

**Root cause.** The preview draws every line's note inline under its floating chips. The board only surfaces a line's note as a badge/reveal action inside `FloatingNumberPanel` (`notebookText={revealNotebookText}` at ~line 3630). If the teacher never interacts with the panel, the note never appears on the board even though the preview shows it exists. Same underlying data (`ReservoirLine.notebook`), two different render pipelines.

**Fix — unify the source of truth, not the rendering surface.**
- Keep both views reading from the exact same `Reservoir` + `ReservoirLine[]` shape produced by `buildReservoirs(sections)`. No preview-only or board-only note field.
- On the board, when the active line has a non-empty `notebook` (after the existing note-purity filter in `notebookFor`), auto-reveal the note as soon as the line becomes active, instead of gating it behind a "pending" interaction:
  - In `PresentationView.tsx`, extend the effect that runs on `activeLineIdx` change (~line 2424) so that whenever `notebookFor(activeLineIdx)` is non-empty, the note is written to the board via the existing `writeProseLineOnBoard` path (or, minimally, `shownNotebookIdx.add(idx)` + `notebookAttentionIdx.add(idx)` so the reveal chip appears immediately without teacher input).
  - Preserve the "Note only" case: if a line has `notebookOnly: true` (already produced by `buildReservoirs`), still advance through it and render the note without a floating equation.
- Do not change `FloatingNumberPanel.tsx`, `SmartboardLessonText`, or `mathRender`. Do not change the preview's note rendering.

Result: every line that has a note in the preview also shows the note on the board at the same beat, driven from `ReservoirLine.notebook`. Floating-only lines still render only the floating number. Note-only lines render only the note.

## Files to touch

- `src/components/smartboard/PresentationView.tsx`
  - Eraser drag: convert viewport → pane-local coords; drop `position: fixed` for the drag state.
  - `activePreviewBeatId`: fall back to `beats[0]?.id ?? null` once beats exist.
  - Line-change effect: auto-surface `notebook` text for the active line (no manual interaction required).
- `src/components/smartboard/PresenterPreviewPanel.tsx`
  - Auto-scroll effect: rAF retry when refs aren't mounted yet; add `readyKey` dependency; stamp `lastActiveKey` only after a successful scroll.

No schema, sync-protocol, student-view, or `buildReservoirs` changes.
