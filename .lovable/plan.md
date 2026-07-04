## Smartboard Presentation Preview

A new rehearsal stage between Floating Number generation and Live Smartboard. The teacher opens it from the Smartboard shelf, scrolls through the *exact* presentation students will see, verifies floating numbers + notebooks are attached to the right lines, toggles Present/Skip per section, and (optionally) fixes wrong tagging via an inline AI. Once approved, Live Smartboard replays the approved plan verbatim — no re-generation.

---

### 1. Entry point

On `/smartboard` shelf, each notebook card gets a third action alongside "Open / Present":

- **Preview** — opens `/smartboard/:id/preview` (new route)
- Present button stays, but is disabled with tooltip "Preview first" until a preview has been approved for that notebook (soft nudge, not a hard block for now — configurable).

Top toolbar on the preview page mirrors Lesson Notes: back, notebook title, chef/recent/zoom/AI, and a primary **"Approve & Go Live"** button.

### 2. Page layout — identical to Smartboard

Reuses the exact background, fonts, colors, chalk textures, and typography from `PresentationView`. The teacher must feel it *is* the smartboard. Difference is only:

- Vertical scroll instead of beat-by-beat advance
- Every section renders in final order
- Each block has a small hover-revealed control strip on the right edge

Scroll order (from `buildBeats` + `buildReservoirs`):

```
Cover → Introduction → Explanation → Example 1 → Solution 1 → Example 2 → Solution 2 → Exercise → Classwork → Homework → Summary
```

### 3. Solution rendering (the important part)

For every reservoir line we render *what the smartboard will actually paint*, using the same paint pipeline the live view uses:

- **Highlighted equation line** — rendered in Smartboard "chalk" style with the same highlight box the live board draws.
- Directly beneath it, a small **inline chip** labels its role:
  - `● Floating Number #k` (matching floating panel color) when the line has fillers/containers
  - `📓 Notebook` when the line is `notebookOnly` or has `precedingNotebook`
  - `— (no attachment)` if neither
- **Notebook prose** — rendered above/below in the unhighlighted color exactly as live board writes it, prefixed with a small notebook glyph.
- The floating fragments for the line appear as ghosted chips to the right, in the arranged order, so the teacher can eyeball order and grouping.

This uses the existing `Reservoir.lines[k]` data — no new AI call, no re-derivation. If the live board would show it, the preview shows it. If the live board would show nothing, the preview shows nothing.

### 4. Present / Skip control

Every renderable unit (cover, intro block, explanation block, each example subsection, each exercise, summary) gets a small right-edge pill:

- `✓ Present` (default)
- `✗ Skip`

State persists in a new table `notebook_presentation_plan` keyed by `(notebook_id, unit_id)`. Skipped units are visually dimmed with a strike-through header and are **excluded** from `buildBeats`/`buildReservoirs` when Live Smartboard reads with `?plan=approved`.

Skipping never edits the lesson note — it only removes the unit from the presentation feed for this session.

### 5. AI-fix affordance (per line)

Each solution line and each notebook block has a tiny `AI` button (matches the pattern already used in Lesson Notes highlight-then-AI-edit).

- Click AI on a line → floating popover with three quick actions and a free-text/voice input:
  - "This should be a Notebook, not a Floating Number"
  - "This should be a Floating Number, not a Notebook"
  - "Reorder the floating fragments"
  - Free prompt / mic / image (reuses existing `useVoiceInput` + assistant pipeline)
- Correction is applied to the underlying `floating_highlights` / `floating_lines` record, then the preview re-renders. No mutation to the raw Lesson Note text.
- Highlight-a-region-then-ask (same UX as Lesson Notes AI edit) is also supported for larger reflows.

### 6. Approval → Live Smartboard is a copy

"Approve & Go Live" writes a snapshot into a new table `notebook_presentation_snapshots`:

- `notebook_id`
- `snapshot_json` — the resolved beat list + reservoir list + skip flags at approval time
- `approved_at`, `approved_by`

When `PresentationView` loads with `?snapshot=<id>` (or the notebook's latest approved snapshot when launched from shelf `Present`), it hydrates from the snapshot instead of recomputing from sections. This gives the 1:1 guarantee: no re-interpretation, no fresh AI, live board = approved preview byte-for-byte.

Re-approving overwrites the previous snapshot. Editing the lesson note invalidates approval (`approved_at` cleared) so the teacher is forced to re-review.

### 7. Files touched

New:

- `src/pages/SmartboardPreviewPage.tsx` — route + page shell
- `src/components/smartboard/preview/PreviewCanvas.tsx` — scrollable canvas, identical styling to `PresentationView`
- `src/components/smartboard/preview/PreviewUnit.tsx` — one section wrapper with Present/Skip pill
- `src/components/smartboard/preview/PreviewSolutionLine.tsx` — highlight + role chip + notebook + fragment ghosts
- `src/components/smartboard/preview/PreviewAiPopover.tsx` — line-level AI fix
- `src/lib/smartboard/previewPlan.ts` — plan resolver: sections → units, applies skip flags
- `src/lib/smartboard/snapshot.ts` — build/load snapshot JSON
- `src/test/previewSnapshot.test.ts`
- `src/test/previewNoteRoleChip.test.ts`

Edited:

- `src/App.tsx` — new route `/smartboard/:notebookId/preview`
- `src/components/smartboard/SmartboardShelf.tsx` — third "Preview" action on each card
- `src/pages/SmartBoardPage.tsx` / `PresentationView.tsx` — when snapshot exists, hydrate beats + reservoirs from it instead of recomputing
- `src/lib/smartboard/presentation.ts` — accept `skippedUnitIds` filter

Backend (migration):

- `notebook_presentation_plan (notebook_id, unit_id, action, updated_at)` — GRANTs + RLS scoped to owning teacher
- `notebook_presentation_snapshots (id, notebook_id, snapshot_json, approved_at, approved_by)` — GRANTs + RLS

### 8. Guarantees

- **Zero visual drift**: preview reuses the same `Board` / `SmartboardLessonText` / `FloatingMath` components live smartboard uses. Anything that would render on the live board renders here identically.
- **Zero re-interpretation on go-live**: snapshot is the source of truth once approved.
- **Note-purity + note-attachment laws stay in force**: preview reads through the same `notebookFor` guard, so anything the live board would reject is *also* not shown in preview — teacher sees the truth, not the pre-filter data.
- **Universal**: works for a lesson with 1 example or 1,000; no line-count assumptions.

### Technical notes

- Skip flags are session-scoped-ish (per notebook), not per launch, because the user described them as "this presentation" but never asked to reset them each open. We can add a "Clear skips" button in the toolbar.
- The AI-fix popover reuses the existing assistant pipeline (`floating-assistant` edge function). No new model, no new secret.
- Snapshot JSON schema versioned via `schema_version: 1` field to allow safe migration later.
- The "Approve" action does not lock the lesson note — teachers can still edit; edits just invalidate approval.
