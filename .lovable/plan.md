# Floating Number Display — Single Sliding Strip

## Goal
Replace the current three-zone layout (Used | Active | Upcoming) with **one strip** showing exactly 5 floating numbers, flanked by ← Backward and Forward →. Numbers outside that window are hidden. Using a number marks it USED and slides it out (the next number flows in from the right). Scrolling backward reveals already-used numbers again, this time with a **green background**. Check Line keeps reading the used/unused state it already tracks.

## What changes vs. now
Today the panel renders three separate boxes: a mint "Used" box on the left, a white "Active" box (5 chips), and a grey "Upcoming" box on the right. The spec explicitly forbids these separate sections. Everything becomes a single rectangle = one window over the full hidden sequence.

```text
        ← BACKWARD   [ 2x² ] [ 4x ] [ -3y ] [ 6x ] [ 7x² ]   FORWARD →
hidden: ...                  ^^^^^^ visible window (5) ^^^^^^         ... hidden
```

## Window model (per active line)

There is one ordered, fixed sequence of all the line's floating numbers. The window shows 5 of them at a time. Two things drive what's visible:

1. **A forward position over the *unused* numbers** — by default the window shows the next 5 not-yet-used numbers.
2. **A reveal count for *used* numbers** — pressing Backward at the left edge pulls already-used numbers back into view (green), one per press, prepended on the left; pressing Forward hides them again before advancing.

### Behaviour traced against the spec
- Start: `[2x²] [4x] [-3y] [6x] [7x²]` — all normal background.
- Tap **4x** → it's marked USED, leaves the window, `13xy` flows in:
  `[2x²] [-3y] [6x] [7x²] [13xy]`.
- Tap **7x²** → marked USED, `-2` flows in:
  `[2x²] [-3y] [6x] [13xy] [-2]`.
- Press **Backward** → most recent reveal appears green on the left, right item drops off:
  `[🟢4x] [2x²] [-3y] [6x] [13xy]`.
- Press **Backward** again → second used number revealed green:
  `[🟢7x²] [🟢4x] [2x²] [-3y] [6x]`.
- Press **Forward** → hides one revealed used number from the left:
  `[🟢4x] [2x²] [-3y] [6x] [13xy]` → again → `[2x²] [-3y] [6x] [13xy] [-2]`.

Forward/Backward at the edges of the unused list keep scrolling the window through upcoming numbers exactly as today.

## Colour rule
- **Unused** number: normal board-ink chip (no fill).
- **Used** number (only ever seen via Backward): **green background** (mint `#d1fae5` fill, dark green `#065f46` text), signalling "already used."
- Tapping a green (used) number un-marks it (undo) and returns it to the unused flow — keeps the existing `onUnuse` behaviour.

## Check Line
No logic change. It already trusts `consumedAbsIdx` (the tap is the proof of usage) and reports `Unused floating numbers: …`. This redesign keeps feeding that same state, so Check Line continues to list exactly the numbers never tapped.

## Scalability (5 → 50+)
Only ever 5 chips render at once regardless of sequence length, so the strip stays a fixed compact size. No horizontal overflow scrollers needed (those were a side effect of the old zones).

## Technical details

### `src/components/smartboard/FloatingNumberPanel.tsx`
- Remove the three separate containers (`usedSlots` mint box, white active box, grey upcoming box). Render **one** rounded strip: `← button | 5 chips | → button`.
- Keep the full per-line fragment list. Derive:
  - `unusedSlots` = line fragments not in `consumedAbsIdx`, in sequence order (today's `allSlots`).
  - An **ordered used list** (`usedOrder`): a local list tracking the order numbers were tapped, seeded from `consumedAbsIdx` (by index) and updated in `handleActiveTap` (append) / `handleUsedTap` (remove). Needed so Backward reveals used numbers most-recent-first per the spec.
- Replace `offset` (unused-window) + add `reveal` (0..usedCount):
  - **Backward**: if `reveal` can grow (used numbers exist and offset at left edge) → `reveal++`; else `offset--`.
  - **Forward**: if `reveal > 0` → `reveal--`; else `offset++`.
  - Window = `revealedUsed.slice(-reveal)` (green) concatenated with `unusedSlots.slice(offset)`, truncated to 5.
- Each chip renders green when its slot is a used one, normal otherwise. Used chips tap → `onUnuse`; unused chips tap → existing `handleActiveTap` (insert + `onUse`), and on use auto-advance so it leaves the window (reset `reveal` to 0 so the freshly-used number slides out and the next flows in).
- Reset `offset` and `reveal` to 0 on beat / active-line change (existing reset effect extended).
- Keep everything else (vertical drag grip, line up/down navigator, page/notebook button, fraction rendering via `ChipLabel`, `slotLabel`).

### `src/components/smartboard/PresentationView.tsx`
- No change needed. `consumedAbsIdx`, `onUse`, `onUnuse`, and the Check Line Phase-1 usage check already match this model. (Usage ordering is tracked locally in the panel, so the parent stays as-is.)

## Verification
- Open a guided line: window shows the first 5 numbers, all normal background; ← disabled, → enabled if more than 5.
- Tap a number mid-window: it leaves immediately, next flows in from the right, count of unused drops.
- Press Backward after using some: used numbers reappear green, most-recent first, right items drop off.
- Press Forward: revealed green numbers hide one at a time, then window advances through upcoming numbers.
- Tap a green number: it un-marks (returns to unused flow).
- Long line (20–50 numbers): still only 5 chips, strip stays compact.
- Check Line with a number never tapped → `⚠ Line N incomplete — Unused floating numbers: …` lists exactly those; all tapped + correct → success.
- No separate Used/Active/Upcoming boxes remain anywhere.
