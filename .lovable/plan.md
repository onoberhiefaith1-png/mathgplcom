## What you're seeing

Three separate issues to sort out:

1. **Floating Number Display drifts from line 7 onward.** Rows 1–5 obey the one-row-per-line rule; after that the writing spacing becomes inconsistent (extra gaps, wrong row, or occasionally none at all where a note-only line has no chip data).
2. **Green "Written: Example 1 · Line 12 · Chip 1" badge on Present view.** Not wanted. Clicking a chip must silently write to the board — nothing must animate or reposition in the Present panel afterwards.
3. **Active-line highlight is missing.** The current line the teacher is working on should have a soft orange outline around all its chips, in both Presenter Preview and Floating Number Display, updating live as the sensor advances — in normal mode and in Present mode.

## Fixes

### 1. Floating Number consistency past line 7 (diagnosis + fix)

Investigate why line spacing decays after ~line 6 in the Floating Number pathway (not the Present pathway, which is fine).

Suspected causes to verify in `PresentationView.tsx`:

- The sensor-anchor effect's "one row below last ink" search uses `rowOwners`, which accumulates entries every write. On later lines the recent fix (search only ≤ current sensor row) may miss ink written *above* the sensor if the sensor was manually nudged up, or double-count tall structures (fraction chips inserted from Floating Number). We'll re-verify by logging: for each Floating Number commit, capture `sensor.line before`, `insertion target row`, `lastInkRow scanned`, `intended next row`, `actual sensor.line after`. Reproduce with the exact 12-line quadratic-formula flow shown in the screenshot.
- The Floating Number commit path may reuse a stale `activeLineIdx` when consumed-fragments set advances, causing the next-line advance to skip or repeat.
- Cross-check with note-only lines: if a floating line has no chips (only prose) the Floating Number path currently does nothing to the sensor, so the next chip lands on the wrong row.

Fix approach: make the sensor advance for Floating Number commits use the **same rule** as the Present/Note path we just landed: sensor moves to `firstEmptyWritableRowBelow(lastRowOfCommittedContent)`, skipping locked rows, once per commit. Remove any additional "max of owned rows" push. If a floating line has no chip payload, the sensor still steps down one row so subsequent lines stay in sync.

Also prune `rowOwners` entries whose ink no longer exists (already done for the anchor scan — extend the same filter to the Floating Number path).

Add a regression test in `sensorSpacing.test.ts` that simulates 12 Floating Number line commits (chip + fraction chip mix, one note-only line at line 9) and asserts each lands exactly one writable row below the previous.

### 2. Remove the "Written" chip verification badge

- In `src/lib/smartboard/manualEdit/autofix.ts`, drop the `✓ Written: …` progress message — leave only the failure message.
- In `src/components/smartboard/PresenterPreviewPanel.tsx` (`AiEditButton`, ~L446–475), stop rendering the `ok` phase entirely. Only render `failed` (red X) so real errors still surface; success is silent.
- Confirm nothing else keys off `phase === "ok"` for layout — no chip repositioning, no scroll, no card resize on success. If any of those exist (e.g. `mirrorStatus` triggering a re-render that shifts chip layout), remove that side-effect so the Floating Number chips visibly do not change position when a Present chip is clicked.

### 3. Active-line orange highlight

Add a shared "current line" highlight ring driven by the same source of truth already used to route writes:

- **Presenter Preview** (`PresenterPreviewPanel.tsx`): the panel already knows which line number is active via the sensor / edit target. Wrap each `LINE N` group so that when `N === currentPresenterLine`, its container gets `ring-2 ring-[hsl(var(--sb-orange))]/70 rounded-lg` (or the existing orange token used elsewhere — reuse, don't hardcode). All chips on that line inherit visually via the outer ring.
- **Floating Number Display** (`FloatingNumberPanel.tsx`): the "active line" is `activeLineIdx`. Add the same orange ring around the current strip when `viewingActive && useLineMode`. Do not restyle individual chips — keep their existing look; only the containing row gets the ring.
- The highlight follows the sensor: when the teacher moves the sensor with the D-pad or a chip auto-advances to the next line, the ring updates. Works identically in normal and Present modes since both feed from the same active-line signal.

Use a semantic token (add `--sb-active-line` in `src/index.css` if none exists — warm orange) so dark/light modes stay consistent.

## Files touched

- `src/components/smartboard/PresentationView.tsx` — unify Floating Number sensor advance with Present path; expose `currentLineIdx` for highlighting.
- `src/components/smartboard/PresenterPreviewPanel.tsx` — remove `ok` badge; add active-line ring around each line group.
- `src/components/smartboard/FloatingNumberPanel.tsx` — add active-line ring around active strip.
- `src/lib/smartboard/manualEdit/autofix.ts` — drop success toast/progress.
- `src/index.css` — add `--sb-active-line` token if needed.
- `src/test/sensorSpacing.test.ts` — new 12-line Floating Number regression.

## Verification

- Playwright: reproduce the quadratic-formula flow from the screenshot, drive 12 Floating Number commits, screenshot after each — assert one-row advance and orange ring on the current line.
- Click a Present chip — confirm no green badge appears and Floating Number chips do not shift.
- Run `sensorSpacing.test.ts` and typecheck.

No backend changes.