
## Goal

Add a left-side, expandable **Presenter Preview** panel to the live Smartboard Presentation page. It reuses the existing Smartboard Preview (from the Lesson Library) as a *read-only, synchronized teaching guide* — highlighting the teacher's current position and auto-scrolling to follow it, with support for temporary manual scrolling that snaps back when the teacher resumes.

Nothing about the existing preview page (`/smartboard/:id/preview`) or the live board's behavior changes. The panel is an additional view onto the same content.

## Deliverables

### 1. Extract the preview into a reusable component
Move the render logic already inside `src/pages/SmartboardPreviewPage.tsx` (cover / prose / problem blocks, solution lines, HighlightBox, FloatingChips, NoteBlock) into a new component:

- `src/components/smartboard/PresenterPreviewPanel.tsx`

Props:
```
{
  notebookId: string;
  activeBeatId?: string | null;   // e.g. "<subsectionId>-q", "<sectionId>-text", "__cover__"
  activeLineIdx?: number | null;  // solution line index within active beat, if any
  readOnly?: boolean;             // when true: no Present/Skip pills, no AI Edit, no Approve/Reset
  onManualScrollChange?: (isManual: boolean) => void; // for auto-return logic
}
```

The existing `SmartboardPreviewPage` becomes a thin wrapper that renders `<PresenterPreviewPanel readOnly={false} />` plus its header (Reset / Approve & Go Live). This guarantees there is only **one** preview implementation in the system.

In `readOnly` mode the panel hides: Present/Skip toggle pills, AI Edit popovers, footer approve bar. It also removes the sticky header — the parent (side panel or page) supplies its own frame.

### 2. Highlight the teacher's current position
Inside `PresenterPreviewPanel`, each rendered item receives a stable `data-beat-id` and each solution line a `data-line-idx`. When `activeBeatId` matches an item, wrap it with a soft highlight ring:

```
background: rgba(138,106,31,0.08);
box-shadow: inset 0 0 0 2px rgba(138,106,31,0.35);
```

For the active solution line, apply the same subtle highlight to the `Line k` row. Colour is intentionally muted (amber-tint at 8%) — locator, not attention-grabber.

### 3. Auto-scroll + manual-scroll grace period
`PresenterPreviewPanel` keeps an internal scroll container ref and a `userScrolling` flag:

- On `activeBeatId` / `activeLineIdx` change, if `!userScrolling`, `scrollIntoView({ block: "center", behavior: "smooth" })` the active element.
- When the panel detects a wheel / touch / pointer scroll originating inside it, set `userScrolling = true` and start/refresh a 6-second timeout.
- When the teacher's active position advances (i.e. `activeBeatId`/`activeLineIdx` changes) *after* they went manual, clear `userScrolling` immediately and auto-scroll back — matching the spec's "as soon as the teacher continues teaching, the preview returns."
- The 6-second timeout is a safety net for the case where no beat change occurs.

Manual scrolling never mutates any board state — the panel is pure display.

### 4. Compute active beat from the live board
In `src/components/smartboard/PresentationView.tsx`:

- Derive `activePreviewBeatId` from the existing `beats[beatCursor]`. `Beat` already carries an `id`; map beat ids to preview item ids using the same conventions the preview page uses:
  - Cover beat → `"__cover__"`
  - Prose beats (introduction/explanation/summary) → `"<sectionId>-text"`
  - Problem beats → `"<subsectionId>-q"`
- Pass `activeLineIdx` when the teacher is on a solution beat (already tracked in state near line 1961).

If the beat/reservoir structures don't already expose the source section/subsection ids on each beat, add a small `previewAnchor?: string` field when `buildBeats` constructs them (in `src/lib/smartboard/presentation.ts`) so the panel can look up items unambiguously. No behavioral change.

### 5. Left-side expandable panel on the live board
In `PresentationView.tsx`, add:

- A new expandable button in the top-left area, styled identically to the existing chrome buttons there (same size, same `chromeBg` / `chromeFg` / `chromeBorder` tokens from the `SURFACES` palette, same rounded pill). Icon: `PanelLeftOpen` (lucide) — matches the sibling chrome icons.
- Reuse the same `useAutoHide(10000)` pattern already used for the left rail: the button fades after 10s of inactivity and re-appears when the pointer enters a hit zone on the left edge (mirroring `revealLeftTools` at line 384).
- When clicked, open a `<aside>` docked to the left with `width: 30vw; min-width: 320px; max-width: 480px`. The board container's existing full-viewport rendering stays; the panel overlays with `position: fixed; inset: 0 auto 0 0; z-index: <one below settings sheet>`. A subtle right divider and `boxShadow` matches the existing `SettingsSheet`/`BottomPanel` chrome.
- The panel header shows the notebook title, a close (`X`) button, and a small "Following teacher" indicator that dims to "Paused — manual scroll" while `userScrolling` is true.
- Body: `<PresenterPreviewPanel notebookId={notebookId} activeBeatId={...} activeLineIdx={...} readOnly />`.

The panel is teacher-only (`isTeacher === true`). Students never see it.

Panel open state is persisted per notebook in `localStorage` under `smartboard:presenterPanelOpen:<id>` so re-entering the board keeps the teacher's choice.

### 6. Layout when open
The Smartboard surface itself does **not** re-flow — the panel is an overlay on the left 30%. This preserves all coordinate math the writing surface relies on. Spec says "presentation remains visible on the remaining 70%": with an overlay of ~30vw the board is still fully rendered underneath and the right 70% is visually unobstructed. If the teacher wants the surface fully clear, they close the panel with the same button.

(Reflowing the board width would require touching grid, sensor, and freewrite coordinate systems — out of scope and explicitly a UI change only.)

### 7. Read-only guarantees
Inside `readOnly` mode the panel:
- Renders no interactive controls except a scrollable container.
- Does not call any Supabase mutation, does not touch `presentationPlan`, does not emit AI-edit toasts.
- Uses `pointer-events: auto` only for scroll; everything else is presentational.

## Files touched

- **new** `src/components/smartboard/PresenterPreviewPanel.tsx` — extracted, reusable preview body with active-highlight + auto-scroll logic.
- **edit** `src/pages/SmartboardPreviewPage.tsx` — becomes a thin wrapper using the new component (no functional change for existing preview users).
- **edit** `src/components/smartboard/PresentationView.tsx` — adds top-left expandable button (auto-hide 10s), left overlay panel, active-beat computation.
- **edit (small)** `src/lib/smartboard/presentation.ts` — expose `previewAnchor` on each beat if not already derivable.

## Out of scope

- Any change to the existing preview page's editing/approval flow.
- Any change to the live board's writing surface, grid, sensor, floating math generation, or sync protocol.
- Student-side view.

## Acceptance checks

1. Teacher opens `/smartboard/:id`, clicks the new left icon → 30%-wide panel slides in, shows the same content as `/smartboard/:id/preview` but with no Present/Skip/AI-Edit chrome.
2. Advancing the board (Next beat, activating a floating line) moves the highlight in the panel and auto-scrolls it into view.
3. Scrolling inside the panel with the wheel does not move the board; highlight stays where the teacher actually is; header switches to "Paused — manual scroll".
4. Advancing the board after manual scroll immediately snaps the panel back to the current position.
5. Idle for 10s with no pointer near the top-left → the expandable button fades. Moving the pointer to the left edge → it reappears. Panel state itself is unaffected.
6. Students on the same board never see the button or panel.
