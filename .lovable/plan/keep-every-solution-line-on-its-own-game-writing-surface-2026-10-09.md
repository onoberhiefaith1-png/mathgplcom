# Keep every solution line on its own Game writing surface

## Goal
Restore the strict Game rule shown in the annotation:

```text
Surface 0 = question
Surface 1 = solution line 1
Surface 2 = solution line 2
Surface 3 = solution line 3
```

A writing surface may grow to contain its own wrapped mathematics or note, but it must never absorb another solution line.

## Confirmed current behavior
- The Game already creates one physical slot for each Floating Numbers line.
- The Smartboard mirror currently groups physical board rows by a shared line owner before sending them to the Game.
- When several solution rows retain the same owner, their mathematics is combined and rendered on that owner's single surface, causing the annotated fault.

## Changes
1. **Enforce one solution step per line owner**
   - Correct Game-mode row ownership when a completed row is followed by a new mathematical row.
   - Assign the new row to the next matching Floating Numbers line instead of retaining the previous line's owner.
   - Preserve half-rows that belong to one mathematical structure, such as a fraction, on the same line.

2. **Keep Game slots strictly separated**
   - Export each line's plain and structured mathematics only under its own zero-based Floating Numbers index.
   - Render that index only on its matching `line-N` writing surface.
   - Keep Line 0 read-only and outside solution-line ownership.

3. **Preserve existing behavior**
   - Do not change Smartboard tables: one complete table remains one writing surface.
   - Do not change marking, predicted-line evaluation, rewards, timers, Vaults, Floating Numbers controls, text-size settings, or Game Pro.
   - A long single step may still wrap and make only its own surface taller.

## Validation
- Reproduce the annotated example and confirm:
  - `x + 7 = 15` appears only on Surface 1.
  - `x + 7 - 7 = 15 - 7` appears only on Surface 2.
  - `x = 8` appears only on Surface 3.
- Confirm editing one line changes only its corresponding surface.
- Confirm previous/next and direct surface selection activate the matching Floating Numbers line.
- Add focused regression coverage for three completed solution rows with distinct owners.
- Run the relevant tests and verify the Game at phone and desktop sizes.
