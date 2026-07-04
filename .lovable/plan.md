# Smartboard ↔ Presenter Preview — full synchronization

Two problems remain after the split-screen shell landed:

1. Several Smartboard controls are still anchored to the browser viewport instead of the resized 70% pane.
2. The Presenter Preview follows the beat cursor, but not in the exact way the spec now describes (whole-card border highlight, single active solution line, floating-number line follow, one shared source of truth).

Fix both in this pass. No changes to the student view, sync protocol, board data, or the underlying preview render pipeline.

---

## 1. Move every Smartboard control with the 70% pane

**Root cause found:**
- `FloatingNumberPanel` renders via `createPortal(panel, document.body)` and uses `position: fixed` + `100vw` math → it ignores the `transform` containing block and stays anchored to the viewport. This is the "Floating Number display still positioned according to the old 100% layout" the user is seeing.
- `SensorDPad` also portals into `document.body` for the same reason.
- `AssistantButtons` (Numbers / Structures / Symbols pills) uses `position: fixed` — inside the transform pane it *is* contained, but its `right`/`bottom` values are hard-coded to the viewport intent. They currently work only because of the transform trick; we'll make them explicit.

**Fix — a single, real Smartboard container the chrome lives inside:**

- In `PresentationView.tsx`, give the 70% pane a ref and an `id="sb-root"`. Publish that DOM node via a small React context (`SmartboardRootContext`, new file `src/components/smartboard/SmartboardRoot.tsx`) so any descendant can portal into it.
- `FloatingNumberPanel` and `SensorDPad`: change `createPortal(panel, document.body)` → `createPortal(panel, root ?? document.body)` where `root` comes from the context. Their `position: fixed` becomes `position: absolute` (relative to `#sb-root`). Replace the `calc(100vw - …)` in FloatingNumberPanel with `calc(100% - …)` using the container width.
- `AssistantButtons.tsx`: change all three buttons from `fixed` → `absolute`. They now sit inside `#sb-root` naturally (no portal needed) — `right: 12`, `bottom: bottomInset + 12`, `top: 50%` become relative to the pane.
- `PresentationView.tsx`: convert every remaining `position: fixed` chrome element inside the return tree (eraser toolbar, `#` button, cursor toolbar, per-line "Check line" button, bottom-right assessment score/finish button, "Not yours" badge, top pill) to `position: absolute` so nothing is left hanging on the viewport. Replace `100vw`/`100dvw` widths with `100%`.
- Keep the "Presenter Preview" toggle icon inside `#sb-root` (already `absolute`, left: 12, top: 12).
- Keep the split shell (`fixed inset-0 flex`) at the page root — that's the only remaining viewport-anchored element and it's intentional.

Result: shrinking to 70% moves the eraser, the `#` pill, the floating-number display, the floating-number toolbar, the cursor D-pad, the symbol/structure panels, the bottom panel, all navigation arrows, and the right toolbar together as one unit.

---

## 2. Presenter Preview becomes a live mirror

The board already exposes the right state:
- `beatCursor` → `current = beats[beatCursor]` → `current.id` matches the preview panel's item id (`__cover__`, `<secId>-text`, `<subId>-q`).
- `activeLineIdx` → the currently active solution/floating-number line for a problem beat.
- `activeReservoirIdx` → which problem's floating set is active.

Both values are already forwarded to `PresenterPreviewPanel` as `activeBeatId` / `activeLineIdx`. Wire the last-mile behavior:

### 2a. Highlight = border only, whole card
In `PresenterPreviewPanel.tsx`, remove the tinted background (`HIGHLIGHT_BG`) and replace the ring style with a real border highlight:
- Active card: `borderColor: rgba(138,106,31,0.9)`, `borderWidth: 2`, `boxShadow: 0 0 0 4px rgba(138,106,31,0.15), 0 6px 22px rgba(138,106,31,0.18)`.
- Card content, background, and text colors stay exactly as they are.
- Applies uniformly to Cover / prose (Introduction, Explanation, Summary) / problem cards (Example, Exercise, Classwork, Homework).

### 2b. Solution line highlight — one at a time
For problem cards, the outer card gets the border ring only when the teacher is on the *question* (no line yet). Once a solution line is active:
- Remove the card-level border ring.
- Apply the same border-only highlight to the single active line row, keyed by `${beatId}::${lineIdx}`.
- Never highlight more than one line, and never highlight both the card and a line at the same time.

### 2c. Solution "line" ≠ text row
The panel already renders one `<div>` per `ReservoirLine`, and each `ReservoirLine` represents one presentation step (a fraction, sqrt, matrix, etc. is one entry — multiple visual rows). No data change needed; just make sure the highlight target is the whole `ReservoirLine` block (equation + floating chips + note), which is what the DOM already does.

### 2d. Floating-number sync
`activeLineIdx` in `PresentationView` is driven by both:
- Navigation (`beatCursor` + line advances)
- Floating-number panel line changes (`setActiveLineIdx`)

Nothing else is required — both paths already flow into the same state. The preview highlight will follow whichever moves it.

### 2e. Auto-centering
`PresenterPreviewPanel` already calls `scrollIntoView({ block: "center" })` on active-key changes. Keep that. When only `activeLineIdx` changes but `activeBeatId` does not, scroll to the line ref; when only the beat changes, scroll to the card. Both cases fall out of the existing effect — verify and keep.

### 2f. Manual scroll grace
Already implemented. Keep the 6s timer and the "position change clears manual mode" behavior. The header status ("Following teacher" / "Paused — manual scroll") stays.

### 2g. One shared source of truth
No new state, no new store. The preview never writes to `beatCursor`, `activeLineIdx`, or the sync channel — it only reads. Remove any leftover click handlers on preview cards/lines (audit `PresenterPreviewPanel.tsx` — currently none exist, keep it that way).

---

## Files to touch

- **edit** `src/components/smartboard/PresentationView.tsx`
  - Add `SmartboardRootContext.Provider` around the 70% pane, expose the ref/DOM node.
  - Convert every `position: fixed` inside the pane → `position: absolute`; replace `100vw`/`100dvw` widths with `100%`.
- **new** `src/components/smartboard/SmartboardRoot.tsx` — 12-line context module (`createContext<HTMLElement | null>`, `useSmartboardRoot()` hook).
- **edit** `src/components/smartboard/FloatingNumberPanel.tsx`
  - Portal target = `useSmartboardRoot() ?? document.body`.
  - `position: fixed` → `absolute`; `100vw` → `100%`.
- **edit** `src/components/smartboard/SensorDPad.tsx`
  - Same portal-target + `fixed`→`absolute` change.
- **edit** `src/components/smartboard/AssistantButtons.tsx`
  - Three buttons: `className="fixed …"` → `"absolute …"`. Coordinates unchanged.
- **edit** `src/components/smartboard/PresenterPreviewPanel.tsx`
  - Replace tint+ring highlight with border-only highlight (card + line variants).
  - When a problem beat has an active `activeLineIdx`, suppress the card-level highlight and highlight only the active line row.
  - No other logic changes.

No schema changes, no backend changes, no sync-protocol changes, no student-view changes.
