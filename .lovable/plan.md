# Floating-Number Conveyor + Tap-Driven Check Line

Rebuild the floating-number strip into a three-zone conveyor and make a token's **used** state the single source of truth for both the UI and Check Line. No AI, no OCR, no equation scanning needed to know whether a token was used — the tap is the proof.

## How it works

```text
   USED (grey)        ACTIVE (working, 5 max)        UPCOMING (waiting)
 ┌───────────┐  ┌─────────────────────────────┐  ┌────────────────────┐
 │ 2x  =     │  │  [-] [11] [5] [÷] [3]        │  │  x + 7 4 9 …       │
 └───────────┘  └─────────────────────────────┘  └────────────────────┘
        ▲                    │ tap "11"
        └────────────────────┘  (11 → USED, next upcoming slides into ACTIVE)
```

- **Scope:** per active line (the current line's own floating numbers only), matching how Check Line already grades line by line.
- **Tap a token in ACTIVE** → it inserts onto the board (as today) AND is marked **used**: it moves into the USED zone, and the next UPCOMING token slides into ACTIVE so there are always up to 5 working tokens, no scrolling.
- **USED zone (left):** muted grey background (`#e5e7eb` bg, `#9ca3af` border, `#374151` text), tokens still fully visible and clickable.
- **Tap a token in the USED zone** → un-mark it (returns to ACTIVE as available). The student erases it from the board themselves.
- **UPCOMING zone (right):** the line's remaining not-yet-used tokens, shown dimmed; they are not directly tappable, they just flow into ACTIVE as space frees up.

## Check Line becomes a state read

Check Line no longer has to locate a row and diff multisets to decide usage. It simply asks: are any of this line's tokens still **not used**?

- Any token still un-used → `⚠ Line N incomplete — Unused floating numbers: …` (lists the still-available tokens). Stop. No grading.
- All tokens used → proceed to the existing Phase 2 math grading (`grade-assessment`) exactly as today.

This directly fixes the reported bug (`2x = 11 − 5` reporting "minus not used"): the moment `−` was tapped it is recorded used, so the check trusts that record instead of re-parsing the handwriting.

## Files & changes

### `src/components/smartboard/FloatingNumberPanel.tsx`
- Replace the single windowed 5-chip row with three rendered zones from the active line's slot list:
  - `usedSlots` = fragments of the active line whose `absIdx` is in `consumedAbsIdx`.
  - `activeSlots` = first 5 un-used fragments.
  - `upcomingSlots` = remaining un-used fragments.
- Add `onUse(absIdx, label)` and `onUnuse(absIdx)` callbacks (props). ACTIVE chip tap calls existing insert path **and** `onUse`. USED chip tap calls `onUnuse`.
- Style the USED zone with the muted-grey tokens; keep ACTIVE chips in the current ink color; render UPCOMING dimmed/non-interactive.
- Keep the existing vertical drag, line navigator, and notebook page-icon behavior. Keep the `◀ ▶` arrows only as an optional nudge within ACTIVE if a line has more than 5 un-used tokens (the conveyor handles refill automatically, so arrows become secondary).

### `src/components/smartboard/PresentationView.tsx`
- Add handlers passed to the panel:
  - `markUsed(absIdx)` → `setConsumedAbsIdx(add absIdx)`.
  - `unmarkUsed(absIdx)` → `setConsumedAbsIdx(remove absIdx)`.
- Wire `onUse` so tapping inserts (current `insertTextAtSensor` / `insertFractionAtSensor`) and then marks used; wire `onUnuse` to `unmarkUsed`.
- Rewrite `checkActiveLine` Phase 1 to read `consumedAbsIdx` instead of scanning rows: build `unused` from `[fragmentStart, fragmentEnd)` indices not in `consumedAbsIdx`; if non-empty show the incomplete toast and return. If empty, run Phase 2 unchanged. (Row location is still used in Phase 2 to send `arrangement`/`studentAscii` to the server.)
- On line advance / question change, the existing resets of `consumedAbsIdx` remain; ensure the guided auto-match effect still adds to the same set so teacher mode and tap mode stay consistent.

## Notes
- Works in both teacher (guided) and student (assessment) modes — both already render this same panel and share `consumedAbsIdx`.
- No backend changes. `grade-assessment` and the server-held answer key are untouched.
- Undo is manual un-mark only (no automatic board edit), per the chosen behavior.

## Verification
- Tap `11` in ACTIVE: it appears on the board, moves to the grey USED zone, and the next upcoming token slides into ACTIVE.
- Tap `11` in USED: it returns to ACTIVE as available.
- With one token still un-used, Check Line shows `⚠ Line N incomplete` listing it and does not grade.
- After all tokens are used, Check Line grades via the server; correct → green tick on the top tracker + next line; wrong → error toast.
- `2x = 11 − 5` with every chip tapped no longer reports "minus sign not used."
