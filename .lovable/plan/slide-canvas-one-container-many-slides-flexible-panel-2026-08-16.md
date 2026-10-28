# Slide → Canvas: one container, many slides, flexible panel

Rework the Slide feature so a **Canvas** is the presentation container and **Slides** are its pages. The panel becomes a real docked column that can be resized and exited, and Preview becomes a true full-screen presentation.

```text
CANVAS: Logarithms
├── Slide 1  Introduction
├── Slide 2  Product Rule
├── Slide 3  Worked Example
└── Add Slide
```

## 1. Canvas, not deck

The existing per-note deck structure is reused and re-labelled throughout: "Slide Deck" becomes **Canvas** in every visible string. First open shows **My Canvases** with **Create Canvas → [name] → Create Canvas**. Creating one immediately creates Slide 1 and opens its page, so the teacher never faces an empty tool screen.

Opening a Canvas shows its slide list (rename, reorder, delete, **Add Slide**) beside the open slide's page, with `Canvas: Logarithms · Slide 2 of 5`, **Previous** / **Next**, and **Preview**.

## 2. Panel behaviour — no more rigidity

- The panel becomes a **docked column inside the workspace layout**, not a fixed overlay pinned above it. The note area shrinks to the remaining width instead of being covered, so Back, Full screen and every ribbon control stay clickable while the panel is open.
- A **← Exit Slide** button sits at the top-left of the panel. It closes the panel completely and restores the full-width note. Canvas content is untouched.
- A drag handle on the panel's left edge resizes it (min 320px, max 60% of the workspace); the width is remembered per session.
- Full screen recalculates the available workspace whenever the panel opens, closes or resizes — nothing stays locked to an earlier width.

## 3. Preview = presentation mode

Preview renders the player into a top-level layer covering the whole screen (not inside the panel), requests browser full-screen where available, and shows only: canvas name, `Slide n of N`, the slide content, `← Previous`, `Next →`, and **Exit Presentation**. Arrow keys, Space and Esc work. Next walks reveal steps first, then moves to the next slide. Exiting returns to the Canvas editor with the same slide open and nothing reset.

The two exits stay distinct: **Exit Presentation** → Canvas editor; **Exit Slide** → main note.

## 4. Media is a real editable object

Images and videos on a slide get: click to select, drag to move, and **eight resize handles** (corners + edges). Corner drags keep aspect ratio unless Shift is held; edges resize freely. A selected object's toolbar gains **Fit width**, **Fill slide** and **Reset size**, so a video can be blown up to occupy the entire canvas for presentation. No permanent lock to the imported dimensions.

## 5. Capture is unchanged in spirit

Capture still places the selected region at its **original size** and relative position on a full blank slide page. `log₂ x` stays exactly as small as it was; no auto-fit, no centring, no enlargement.

---

## Technical notes

**No migration needed** — `notebook_slide_decks` already models the Canvas; only labels and UI change.

- `src/lib/lessonnotes/slides.ts` — add `SlideCanvas`-named aliases for the deck helpers (keep the table names), plus `updateSlideItem` already covers geometry writes.
- `src/components/lessonnotes/slides/SlidePanel.tsx` — restructure into `canvas list → canvas editor` with a header holding **Exit Slide**, canvas title, slide counter, Previous/Next and Preview. Remove `fixed right-0 top-0 h-screen w-[38vw]`; render as a flex sibling with an inline width driven by a resize handle (`sessionStorage` key per note).
- `src/components/lessonnotes/DocumentEditor.tsx` — wrap the sheet area and the panel in a flex row so the panel participates in layout; the note column keeps `min-w-0`. Full-screen/back controls stay in the note column and are no longer overlapped.
- `src/components/lessonnotes/slides/SlideCanvas.tsx` — replace the single corner handle with eight handles, add aspect-ratio-preserving corner logic, keyboard nudge for the selected item, and Fit width / Fill slide / Reset actions on the item toolbar.
- `src/components/lessonnotes/slides/SlideMedia.tsx` — ensure media fills its object box (`object-contain`) at any size and never sets intrinsic width.
- `src/components/lessonnotes/slides/SlidePlayer.tsx` — mount through a portal to `document.body` at the top layer, attempt `requestFullscreen`, relabel Exit to **Exit Presentation**, show `Slide n of N`.
- `src/components/smartboard/PresentationView.tsx` — Slide menu lists **Canvases**; presenting behaviour unchanged.

**Untouched**: capture extraction pipeline (`noteCapture.ts`, `SnipOverlay.tsx` scale rules), math tree, AI Edit, autosave, DOCX export.

## Acceptance checks

Create a Canvas named Logarithms with five slides; capture onto Slide 1; import and resize an image and a video, including to full-canvas; Preview full-screen and walk 1→5; Exit Presentation with content intact; Exit Slide restores the full-width note; reopen the panel repeatedly and confirm Back and Full screen keep working.
