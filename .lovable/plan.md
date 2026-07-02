# Final Rule: The ▼ Button Never Reveals Content

## What is happening

- Everything written on the Smartboard is saved locally so the board survives reloads.
- Rows that fall outside the current writable band are hidden from view — but their ink is still stored.
- The recent fix made the ▼ button grow the writable band by one row so the sensor can always reach empty space.
- Side effect: each ▼ press un-hides one more row of the old, saved solution. It looks like the scroll-down button is "solving the equation by itself."

## The Final Law: Fresh-Row Growth

**When the ▼ button extends the writable band, the newly opened row must always be blank. Growth may never reveal previously hidden ink.**

- ▼ still works exactly as you asked: the sensor can always keep moving down into empty working space.
- But before the new row becomes visible, any stale hidden ink sitting on it (leftover from an earlier session or an earlier band size) is cleared.
- Rows genuinely owned by the current lesson's completed lines are never touched — only orphaned ink outside the lesson's owned rows is purged.

## Technical Details

1. `src/components/smartboard/PresentationView.tsx` — in `nudgeCursor` (▼ at band bottom, ~line 1685):
   - Before calling `growActiveBand()`, check `freeLines[b + 1]` and `freeLines[b + 1.5]`.
   - If ink exists there and the row is not in `rowOwners` / `notebookRowLines` (i.e. it's not part of this lesson's committed lines), delete those keys from `freeLines` in the same update.
   - Then grow the band and park the sensor on the now-guaranteed-blank row.
2. Apply the same guard to the other two ▼-driven grow paths (keyboard ArrowDown at ~line 3650 and Enter-advance at ~line 3560) so no growth path can reveal stale ink.
3. Guard against the erase-rewind effect (Law 1) misreading the purge: purged rows are unowned, so the rewind check is unaffected — verified in the plan, confirmed during implementation with a quick Playwright pass (grow band over a row with stale ink → row appears blank, sensor lands on it, no rewind).

No changes to saved lessons, floating numbers, or any other sensor behavior.
