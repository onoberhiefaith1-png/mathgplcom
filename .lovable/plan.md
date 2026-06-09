## Goal

Make "Check line" a **two-phase verification** on the student assessment board, and remove the duplicate left-edge line indicators (keep only the top tracker).

```text
Check line
   │
   ▼
Collect this line's floating numbers (its tag fragments)
   │
   ▼
All of them used in the written line?  ── No ──▶ ⚠ Toast: "Line incomplete"
   │                                              lists the UNUSED floating numbers.
   Yes                                            Stop. No server call. No green.
   │
   ▼
Mathematical validation (existing grade-assessment call)
   │                                  └─ wrong ─▶ ❌ Toast: "Error in your solution"
   ▼
✓ Line verified → mark solved, advance to next line, update top tracker
```

## Phase 1 — Floating-number usage check (new, client-side)

In `src/components/smartboard/PresentationView.tsx` → `checkActiveLine`, before any `grade-assessment` call:

1. Get the active line's own tag: `target.fragmentStart`/`target.fragmentEnd` slice of `activeReservoir.fragments`. This is the exact set of floating numbers assigned to this line (e.g. line 4 = `5, −, 2, =, 3`).
2. Locate the student's row by **tag match** (not physical position): scan every written row in the active band, normalise each row's chips, and pick the row whose chips overlap this line's expected fragments the most. This fixes the "line 4 visually exists but isn't recognised" bug — the student can write the line anywhere.
3. Build the **used multiset** from that located row (`extractTermsFromAscii(ascii)` → term strings) and compare against the **expected multiset** of the line's fragments, using a shared normaliser (strip spaces, unicode minus → `-`, `×`→`*`, `÷`→`/`, drop leading `+`, treat `=` as a token) so `5`, `−2`, `=`, `3` compare correctly across the two formats.
4. Compute `unusedTokens = expected − used` (multiset difference).
   - If `unusedTokens.length > 0`: show a warning toast — `⚠ Line incomplete` with description listing the unused floating numbers (their display glyphs, e.g. `= , 3`). **Return early** — no server call, no status change, line stays not-green.
   - If empty: continue to Phase 2.

## Phase 2 — Mathematical validation (existing, unchanged server logic)

Only reached when all floating numbers are used:
- Send the located row's `arrangement` + `studentAscii` to `grade-assessment` exactly as today (server still owns the hidden key).
- `correct: false` → error toast (`❌ Error in your solution — check your operation`).
- `correct: true` → mark slot solved, set score, advance `activeLineIdx`/`floatingLineIdx`, move sensor/cursor to the next line, success toast. (Top tracker updates automatically from `solvedSlots`.)

## Remove duplicate left indicators

- In `PresentationView.tsx`, remove the `<LineStatusRail …>` render block (around lines 2049–2059) so the left-edge per-line bulbs no longer appear in **either** assessment or teacher-verify mode (per your choice). The top progress strip (the `○ ○ ○ ○ ○` → `✓ ✓ ✓ ○ ○` ticks at lines 2658–2677) remains the single source of line status.
- Leave `lineStatusMap` / `assessLineStatusMap` computations in place (cheap, harmless) or drop the now-unused rail import; the visual rail is what goes.

## Technical notes

- Expected fragments source: `activeReservoir.fragments.slice(target.fragmentStart, target.fragmentEnd)` — already unicode-normalised by `cleanFragments`.
- Used terms source: `extractTermsFromAscii(rowToAscii(row)).map(t => t.ascii)` — ascii-flavoured; the shared normaliser bridges the two formats (mirrors the server's `normChip`).
- A small helper `normChip(s)` + multiset compare (count map) added locally in `PresentationView.tsx`; no backend change.
- Row location reuses the existing band scan (`bandStart`/`bandEnd`, `freeLines`) but selects by best fragment overlap instead of `writtenRows[activeLineIdx]`.

## Verification

- On a line with missing chips (e.g. wrote `5 − 2`, missing `=`, `3`): tapping Check shows `⚠ Line incomplete` listing `=`, `3`; line stays un-marked; no network call to `grade-assessment`.
- After completing the line (`5 − 2 = 3`): Check proceeds to grading; correct → green tick on top tracker + next line unlocked; wrong → error toast.
- Left edge shows no per-line bulbs; only the top tracker reflects progress.
- Writing line 4 anywhere on the board is still found and graded (tag match).
