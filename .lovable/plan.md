# Rebuild: Two Independent Board Writers (Clean Channels)

## Why the error keeps coming back

Right now both writers go through the **same tangled pipeline** inside `PresentationView.tsx`:

```text
Presenter Preview click ──► Live Mirror replay (mirror.ts) ──┐
                                                             ├──► writeNoteForLine / writeProseLineOnBoard
Floating Number panel ───────────────────────────────────────┘        (advanceBelow hunts, deep-ink scans,
                                                                       verify-retry escapes, noteAdvance caps)
```

Every fix for one path changes shared code the other path also runs through — so correcting the Floating Number breaks the Preview, and vice-versa. Patching further will not stop this. The shared write pipeline gets deleted and replaced.

## Target architecture

```text
                 Notebook / Reservoirs  (ONE data source)
                    /                  \
     Preview Channel                    Floating Channel
   (previewChannel.ts)                (floatingChannel.ts)
          |                                   |
          ▼                                   ▼
        directWrite()  ← one tiny, dumb, deterministic board primitive
```

- **Same source, zero linkage.** Both channels read the same reservoir line data. Neither calls into the other. A bug in one channel file cannot affect the other.
- **One dumb primitive.** `directWrite(row, tokens)` puts ink at exactly the row it is told — no searching, no retrying, no escaping, no sensor hunts. If the primitive is trivial, it cannot drift.
- **One row ledger.** A single `nextFreeRow(lineIdx)` function answers "where does this line's ink go" from `rowOwners` + actual ink — computed the same way every time, for every line, for both channels. No special cases per line.

## What gets DELETED

In `PresentationView.tsx`:
- `writeNoteForLine` (all anchor scans, forward windows, verify-retry rewrites)
- The `advanceBelow` blocked-hunt loop and `noteAdvance` cap inside `writeProseLineOnBoard`
- The "deepest ink" scanning logic and fallback escapes accumulated across the previous fixes

In `src/lib/smartboard/manualEdit/mirror.ts`:
- The entire controller-replay approach (replaying beat-cursor waits + presentation-engine calls to mirror one item)

In `controller.ts`: the `noteAdvance` opts and related plumbing.

## What gets BUILT (fresh)

New folder `src/lib/smartboard/boardWriter/`:

1. **`ledger.ts`** — the single occupancy truth.
   - `nextFreeRow(lineIdx, rowOwners, ink)`: last row owned by any line ≤ lineIdx, +1, then skip any row with visible ink (whole or half-row). First empty row wins. Same rule for line 1 and line 99.
   - `rowOfLine(lineIdx)`: where a line's existing ink lives (for repeat clicks → just scroll there).

2. **`directWrite.ts`** — the dumb primitive.
   - Writes tokens at the exact row given. Marks ownership. Parks sensor at `row + rowsUsed`. Scrolls the written row into view. Returns the landed row. Never moves anywhere else.

3. **`previewChannel.ts`** — Presenter Preview → board, one-to-one.
   - Click a solution line → `directWrite(nextFreeRow(lineIdx), line tokens)`.
   - Click a note → `directWrite(nextFreeRow(lineIdx), note text)` (or scroll to existing note if already inked).
   - Click a chip/fraction → same pattern. No beat-cursor replay, no waiting loops.

4. **`floatingChannel.ts`** — Floating Number panel → board.
   - Chip picks and "write notebook line" use the same `nextFreeRow` + `directWrite`, through its own channel state. Data still comes from the preview/reservoir source — but no code path touches `previewChannel.ts`.

Wiring in `PresentationView.tsx`: the preview's `onMirrorChange`/note clicks call `previewChannel`; the Floating panel's callbacks call `floatingChannel`. Both receive the same board-state refs (read-only) and the same `directWrite` setter.

## Interleaving guarantee

Because both channels ask the same `nextFreeRow` ledger before writing, you can alternate freely — Floating writes line 1, Preview writes line 2, Floating writes line 3 — and each write lands on the first free row below the previous line's ink. No clashes, no jumps.

## Verification

Playwright end-to-end in Present mode:
1. Write lines 1–6 alternating Floating / Preview — assert each lands exactly one band below the previous, screenshots per step.
2. Click notes on lines 1, 3, 5 from the Preview — note ink appears directly under its own line, sensor at most 1 row below.
3. Repeat-click every line and note — scrolls to existing ink, never rewrites, never jumps.
4. Tall fraction case (the original Line 3 bug) — note still lands under the fraction's full height.
Plus typecheck and full test suite. No backend changes.

## Files

- **New:** `src/lib/smartboard/boardWriter/ledger.ts`, `directWrite.ts`, `previewChannel.ts`, `floatingChannel.ts`
- **Rewritten:** `src/lib/smartboard/manualEdit/mirror.ts` (thin adapter → previewChannel)
- **Edited:** `PresentationView.tsx` (delete old writers, wire channels), `controller.ts` (drop noteAdvance), `FloatingNumberPanel.tsx` / `PresenterPreviewPanel.tsx` (only callback wiring — UI untouched)
