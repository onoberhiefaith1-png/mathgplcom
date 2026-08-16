# Slide — a Lesson Note workspace

Slide is an extra workspace that belongs to one Lesson Note only. Opening Lesson Note B never shows Lesson Note A's Slides. The word "Slide" is used everywhere — never "Animate" or "Presentation".

```text
Lesson Note A            Lesson Note B
  ├── Introduction         ├── Intro
  ├── Quadratic Formula    ├── Example 1
  └── Worked Example       └── Conclusion
```

## 1. Entry point and Slide manager

A **Slide** button joins the Lesson Note ribbon. Clicking it opens a small side panel (not a big editor) listing only this note's Slides, with:

- Add Slide (teacher types the name)
- Rename, Delete
- Move up / Move down for ordering
- Open — enters the Slide editor
- Preview — plays the Slides over the Lesson Note

## 2. Slide editor

Opening a Slide gives a clean blank canvas overlaying the note, plus a light element toolbar:

- **Import Image** — from a local file or the existing platform asset library.
- **Import Video** — local file; plays on the canvas and during presenting.
- **Screenshot** — snip a region of the Lesson Note behind the panel (see below).

Every item on the canvas is a free element: drag to move, corner handles to resize, delete, and bring forward/back. A Slide can mix screenshots, images and videos freely. Each element also has a **step number** — this is what makes progressive teaching work (section 4).

## 3. Screenshot — snipping-tool behaviour

1. Click Screenshot. The Slide panel and its chrome hide themselves so the Lesson Note is fully visible; a light snip overlay covers the sheet.
2. Press and hold at the first point, drag to the second point. The selection rectangle grows live: the chosen region shows through bright and clear while everything outside it is dimmed.
3. Release — the rectangle stays highlighted and can be re-drawn or nudged.
4. A **Screenshot** (capture) button appears near the selection, with Cancel. Nothing is captured until it is pressed, so the teacher can confirm the area first.
5. On capture, only that region is rasterised and placed on the Slide canvas at the same relative position it was selected from — on an otherwise clean page. The rest of the note never appears, and the Slide panel itself is never in the image.

Progressive capture is just repeating this: write `2`, snip; write `2 +`, snip; and so on. Each snip becomes the next step.

## 4. Preview (in the Lesson Note)

Preview shows the Slide on top of the Lesson Note, exactly as students will see it. **Next** reveals the next step (step 1 elements, then step 2, and so on) so content appears progressively; Back reverses; Esc / Exit returns to the note. When a Slide has no steps set, Next moves to the next Slide.

## 5. Slide on the Smartboard

The Smartboard top panel gets a **Slide** button. It lists the Slide names of the current Lesson Note only. Selecting one takes over the whole board as the active teaching screen, with Next / Back stepping through the Slide's reveals and then on to the next Slide, and Exit returning to the board. The Smartboard is presentation-only — no authoring, no importing, no snipping there.

## 6. UI principle

Slide stays lightweight: one small manager panel, a clean canvas, three import buttons, and the snip overlay. It is not another heavy tool like Geometry or the Calculator.

---

## Technical notes

**Data (additive migration only)**

- `notebook_slides` — `id`, `notebook_id` (FK `notebooks`, cascade), `name`, `position`, `created_at`, `updated_at`.
- `notebook_slide_items` — `id`, `slide_id` (FK cascade), `kind` (`screenshot` | `image` | `video`), `storage_path`, `x`, `y`, `w`, `h`, `z`, `step`, `created_at`.
- Both get `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated`, `GRANT ALL ... TO service_role`, RLS enabled, and policies scoped through the parent notebook's `owner_id` (matching how existing notebook child tables are gated), so Slides are structurally impossible to read from another teacher's note.
- New private storage bucket `slide-media` for captured PNGs and imported image/video files, path `<notebook_id>/<slide_id>/<uuid>`, read via signed URLs like the existing `course-media` flow.

**Client**

- `src/lib/lessonnotes/slides.ts` — types plus CRUD/reorder helpers keyed by `notebookId`; every query filters on `notebook_id`, so there is no global gallery by construction.
- `src/components/lessonnotes/slides/SlidePanel.tsx` — manager list (add / rename / delete / up / down / open / preview).
- `src/components/lessonnotes/slides/SlideCanvas.tsx` — element canvas; drag/resize reuses the free-object pointer-drag pattern already used by canvas frames and diagrams.
- `src/components/lessonnotes/slides/SnipOverlay.tsx` — full-sheet overlay: dim mask with a cleared selection rect, pointer down/move/up, confirm button. Capture rasterises the note sheet element (`sheetRef` in `DocumentEditor`) with `html-to-image` (added dependency; DOM-to-canvas, no native binary), then crops to the selection rect on a `<canvas>` before upload. The overlay and panel are unmounted during capture so they cannot appear in the output.
- `src/components/lessonnotes/slides/SlidePlayer.tsx` — shared player used by both Lesson Note Preview and the Smartboard, driven by `step` ordering.
- `DocumentEditor.tsx`: one ribbon button + panel mount; no change to the sensor, caret, insertion logic or existing tools.
- `PresentationView.tsx` / `TopBar.tsx`: a Slide menu listing the current notebook's Slides and mounting `SlidePlayer` full-board. Presentation only — no authoring path on the board.

**Untouched**: Master Sensor, canvas frames, Geometry/Graph/Table/Calculator/Conversion layers, AI generation, notebook autosave and DOCX export.
