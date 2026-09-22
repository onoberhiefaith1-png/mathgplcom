# Two targeted fixes on the Floating Numbers Game page

Two separate, contained changes. Nothing else in Floating Numbers, the Game, rewards, Vault matching or the Hourglass behaviour is touched.

## 1. The chosen Vault value must be visible

What I checked: the Vault value is stored correctly (the saved values for your linear-equation lines include entries such as `+7`, `=5`, `3x = 15`, `= 15/3`), and drawing a small value like `+5` produces the right visible content on its own. The Vault row is the one place on that page that takes its writing colour from the app theme instead of pinning the page's dark ink the way the equation line right above it does, so on a light paper panel the value can come out effectively unreadable.

Change:

- Draw the chosen Vault value in a proper value slot with the same dark ink and size the equation uses, so it always reads clearly.
- No value chosen yet: the slot shows its "value" placeholder.
- Value chosen: the slot shows the actual mathematics immediately — `+5`, `3x`, `=`, `10`, fractions and roots keep their shape.
- Delete empties the slot and the placeholder returns.
- Nothing about how Vaults are stored, matched, ordered or rewarded changes, so the value stays visible after Save, after reopening the generator, and when the Game loads.

Acceptance: choose `+5` → `+5` shows → Save → reopen → `+5` still shows → delete → placeholder returns.

## 2. Per-line time must read 00:00, be adjustable, and stick

What I checked: the per-line time does reach storage (one of your questions holds 01:02, 01:02 and 00:31 on three separate lines), but the field is written so that a zero or empty time draws nothing at all instead of `00:00`, typing `00:00` is thrown away as "no time", it is a single free-text box with no up/down controls, and it only commits when the box loses focus. It also only appears on lines that show a score box.

Change:

- A dedicated minutes/seconds control: `00:00` always visible, minutes on the left, seconds on the right, each with its own up and down controls.
- Minutes 0–60, seconds 0–59, and the total is capped at exactly 60:00 — `60:01` and `60:60` cannot be produced.
- Every adjustment is written to that line's own saved configuration straight away, not held in temporary screen state, so the value survives changing lines, saving, leaving and reopening the Game, editing another line and reloading the page.
- Each line keeps its own independent time: Line 1 `02:00`, Line 2 `00:30`, Line 3 `05:00`, and changing one leaves the others untouched.
- The control shows on every line in Game mode, not only lines with a score box.
- The Game Line Hourglass keeps using that exact saved duration. The overall Game timer, the Hourglass reward behaviour and the Hourglass-to-Time conversion are untouched.

Acceptance: set three different times → save → leave → reopen → all three still show exactly what was set; change one and the other two are unchanged.

## Technical notes

- `src/components/lessonnotes/FloatingWorkspace.tsx`: Vault row gets an explicit ink colour and a bordered value slot with placeholder; the Game time control moves out of the `scoreLabel` block.
- New `src/components/common/MinuteSecondInput.tsx`: two clamped number fields plus steppers, `formatMmSs` for display, emits whole seconds on every change, total clamped to 3600. `DurationInput` stays as it is for the question-level time.
- `line.timerSeconds` remains the single stored field (whole seconds, `0`/absent = no time on that line). `normalizeFloatingLine` in `src/pages/FloatingNumbersPage.tsx` clamps it to 0–3600 on save and load so a legacy out-of-range value is corrected once.
- `src/lib/slate/pattern.ts` (Hourglass derivation from the line time) and Vault matching are not modified.
