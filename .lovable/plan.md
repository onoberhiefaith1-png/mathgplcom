## What is still broken

1. **Notes never appear on the Smartboard.** The board's `FloatingNumberPanel` receives `notebookText` but renders it only as a tap-target icon — the note text itself is written to the board only when the teacher taps the notebook icon (which calls `writeProseLineOnBoard`). The preview shows the note inline, so they diverge exactly as the user described.
2. **Highlight stops after Introduction.** Two suspects, both real:
   - **Stale `activeLineIdx` on problem beats.** For prose beats we pass `activePreviewLineIdx = null` and the card border shows. For problem beats we pass `activeLineIdx` as-is. The card highlight is suppressed whenever `activeLineIdx != null` (design intent — a line takes over). But if `activeLineIdx` is out of `guidedLines` range (previous reservoir's persisted value, or 0 before the reservoir hydrates), no line ref matches either → nothing is highlighted at all.
   - **rAF retry gives up after 10 frames (~166 ms).** If the panel's independent `useNotebook` fetch hasn't finished when the beat changes, or the target ref hasn't mounted yet, the effect silently stops and `lastActiveKey` is not stamped (correct), but the next transition may still race against a slow render. Retrying forever until the beat changes is the safe behavior.
3. **Fallback I added last turn is wrong.** `activePreviewBeatId = current?.id ?? beats[0].id` masks any transient out-of-range `beatCursor` by pinning the preview to the very first beat. That is likely why "only Introduction (or Cover) ever highlights." Revert to `current?.id ?? null`.

## Fix 1 — Notes render on the board the same way the preview shows them

In `PresentationView.tsx`, extend the existing "note-attention" effect (added last turn, right after `hasGuidedLines`) so it also auto-writes the note onto the board:

- When `activeLineIdx` changes and `guidedLines[activeLineIdx].notebook` is present and not in `shownNotebookIdx`:
  - Call `writeProseLineOnBoard(nb)` (existing paragraph-shaped writer that respects sensor row and locked ink).
  - `setShownNotebookIdx(prev => prev ∪ {activeLineIdx})` so it never gets re-written.
  - Still `setNotebookAttentionIdx` so the notebook chip in the panel reflects the state.
- Idempotency: `writeProseLineOnBoard` already de-dupes via `rowSignature`, so re-runs on reload are safe.
- `notebookOnly` lines are handled by the same path (their `notebook` is the whole payload; equation is empty). Nothing else to add.

Do NOT change `FloatingNumberPanel.tsx` or `buildReservoirs`. Same source of truth (`ReservoirLine.notebook`), same output surface (board ink) — just no manual tap required.

## Fix 2 — Highlight sync is reliable for every beat

**In `PresentationView.tsx`:**
- Revert last turn's fallback: `activePreviewBeatId = current?.id ?? null`. Never lie about the cursor.
- Clamp `activePreviewLineIdx` so it's `null` unless the value is actually addressable in the current reservoir:
  ```
  const activePreviewLineIdx =
    current && (current.kind === "problem" || current.kind === "exercise-prompt")
      && activeLineIdx >= 0
      && activeLineIdx < guidedLines.length
      ? activeLineIdx
      : null;
  ```
  When the reservoir hasn't hydrated (`guidedLines.length === 0`) or the persisted index is stale, we pass `null`, which promotes the card border — the teacher always sees SOMETHING highlighted.

**In `PresenterPreviewPanel.tsx`:**
- Replace the 10-frame rAF cap with an unbounded rAF loop that is cancelled only when `activeBeatId` changes (via the effect cleanup) or the target is found and scrolled. Stops instantly if the beat changes again.
- Guard the loop against unmount / stale effect cycles with the existing `cancelled` flag.
- Add a `sections`/`items`-driven retry: keep the current `readyKey` dependency so a late notebook fetch still re-arms the effect.
- Stamp `lastActiveKey.current = key` only after a successful scroll (already done last turn — keep).
- Do not touch the manual-scroll grace timer, the header status text, or the border-only highlight styles.

**Highlight visibility check inside `PresenterPreviewPanel.tsx`:**
- The problem-card branch currently does `activeStyle(isActive && activeLineIdx == null)`. Keep that — with the clamp above, `activeLineIdx` is now guaranteed to be either `null` (→ card border) or a valid line index (→ line border). No case will silently render zero highlight.

## Files to touch

- `src/components/smartboard/PresentationView.tsx`
  - Revert the `beats[0].id` fallback.
  - Clamp `activePreviewLineIdx` against `guidedLines.length`.
  - Extend the note-attention effect to call `writeProseLineOnBoard` + `shownNotebookIdx.add(activeLineIdx)`.
- `src/components/smartboard/PresenterPreviewPanel.tsx`
  - Replace the 10-frame rAF cap with an unbounded rAF loop scoped to the current effect run.

No changes to `buildBeats`, `buildReservoirs`, `FloatingNumberPanel`, sync protocol, student view, or note-purity filter.
