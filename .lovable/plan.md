## Rename "Edit" → "Present" and reshape it into a one‑to‑one presentation mode

The current Edit toggle in the Presenter Preview panel already does 90% of what you're describing — clicking any item mirrors it directly onto the Smartboard, without regeneration, and without wiping the board. The remaining work is a rename plus one behavioural change inside Solution blocks.

### 1. Rename the toggle
File: `src/components/smartboard/PresenterPreviewPanel.tsx`

- Button label: `Edit` → `Present`  (icon: swap `Pencil` for `Sparkles` or `MonitorPlay`)
- Exit label: `Done` stays
- Header caption: `"Edit mode — select any item"` → `"Present mode — click any item to send it to the Smartboard"`
- Header caption for the other state stays `"Normal mode"` (Normal mode is unchanged)
- Internal state can stay `"normal" | "edit"` under the hood (touches many spots); only the user‑facing strings change. Optionally rename the local const `AiEditButton` → `PresentStatusBadge` for clarity — no behaviour change.

Normal Mode is not touched anywhere.

### 2. Inside Solution blocks: hide the completed equation line
Same file, in the problem `section` render (around lines 680–815 where each `ReservoirLine` is drawn).

Currently each solution line renders, in order:
1. `LINE k` label
2. The completed equation inside a `HighlightBox` (e.g. `x = (−(5) ± √((5)² − 4(1)(6))) / (2(1))`)
3. Floating‑number chips (`−(5)`, `(5)²`, `x = □/□`, `±√□`, `2(1)`, `−4(1)(6)`)
4. The teacher note

Change: when `mode === "edit"` (Present mode), skip step 2 entirely. Keep everything else exactly as it is — the line container, `LINE k` label, floating chips, and teacher note continue to render and remain clickable. In Normal Mode the completed equation still shows exactly as today.

Because the equation row is what carried the `solution-line` click target, in Present mode we also drop the outer line‑level click handler (there's nothing to mirror for a hidden equation). Chips and notes each carry their own click handlers already, so they keep working.

Everything outside Solutions (Cover, Introduction, Explanation, Objectives, Example Question, Exercise Question, Summary) stays fully clickable and mirrors on click — no change.

### 3. Board is never cleared entering Present
Already true in `src/lib/smartboard/manualEdit/mirror.ts` (`applyMirror` is additive; `AiEditWorkspace` only clears on unmount by closing the floating panel, not by resetting the board). No code change needed — I'll re‑verify after the rename.

Floating Numbers keep working simultaneously. Teacher can flip between Present and the normal Floating‑Number workflow at any time; whatever is already on the Smartboard stays.

### 4. Future Student Mode (not built now)
This rename + hide‑equation change is exactly the surface Student Mode will consume later: students would open the same Present panel with the Normal Mode toggle removed. No student code is added in this task.

### Technical detail
- Only file edited: `src/components/smartboard/PresenterPreviewPanel.tsx`
- Guard around the equation `HighlightBox` block: render only when `mode === "normal"`
- Drop the `onClick={selectTarget(lineTarget)}` on the line wrapper when `mode === "edit"`; leave the wrapper for layout
- Keep the `LINE k` label visible so teachers can still see the line boundary
- No changes to `mirror.ts`, `AiEditWorkspace.tsx`, `PresentationView.tsx`, or the board controller

### Out of scope
- Splitting a rendered expression into finer sub‑clickable atoms (e.g. clicking just `−b` inside the quadratic formula). The current preview exposes the fillers you authored on the Highlight page as chips; those are the atoms teachers can click. Breaking a rendered equation into smaller pieces than the authored fillers would need a separate feature.
- Student Mode UI itself.
