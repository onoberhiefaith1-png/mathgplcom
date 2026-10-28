# Slide Decks — presentation system rebuild

Slide becomes a deck-based teaching presentation tool. Decks live inside one lesson note only: opening Lesson Note B never shows Note A's decks.

```text
SLIDE DECKS (this lesson note)
▸ Algebra          ▸ Indices
  ├── Slide 1        ├── Slide 1
  ├── Slide 2        ├── Slide 2
  └── Slide 3        └── Slide 3
```

## 1. Workflow

Click **Slide** → deck list. If the note has no deck yet, the panel opens straight on **Create Slide Deck → [name] → Create**.

Opening a deck opens **Slide 1's canvas directly** (never an empty tool screen). Deck header shows `Algebra · Slide 1 of 8` with Previous / Next, plus New slide, rename, reorder, delete, and **Present**.

## 2. Adding content — four actions

- **Capture** — drag a region of the note; that region becomes the next slide.
- **Import image** — placed on the current slide as a movable object.
- **Import video** — placed on the current slide; plays in presentation.
- **Blank canvas** — a new empty slide to write or draw on.

## 3. Capture — the main fix

Renamed **Capture** (never "Screenshot"/"Caption"), and its availability is deterministic:

- No selection → Capture visible but disabled, with the hint "Drag across the area you want to capture".
- Valid selection (larger than a few pixels) → Capture enabled, and it stays enabled while the selection exists. It never hides on its own, never disappears on pointer-up, and never depends on hover or a timeout.
- Cancel or a new drag replaces the selection; only pressing Capture creates a slide.

**Capture is a viewport, not a zoom.** The selected region is placed on a full blank slide at its original size and at the same relative position it occupied in the note. A small `log₂ x` stays exactly as small as it was; only the amount of surrounding white space changes. No fit-to-selection, no auto-centre, no stretch, no proportional enlargement.

**Capture preserves live mathematics.** The lines inside the selection are copied as real text and math objects and rendered by the same pipeline as the note, so subscripts, superscripts, fractions, symbols, spacing and alignment come across identically and the teacher can click inside an equation on the slide and edit it. Content that has no live equivalent inside the region (diagrams, graphs, drawings) is copied as an image object of exactly the same size, so the slide still looks like the source.

Repeating a capture is how a solution is revealed piece by piece: capture `2³ × 2²`, then `= 2³⁺²`, then `= 2⁵`, then `= 32` — four slides in the deck.

## 4. Presentation mode

Present shows the deck full-screen: deck name, `Slide n of N`, content, `← Previous` / `Next →`, Esc to exit. Arrow keys and Space work. No editing chrome is visible while presenting. Reveal steps inside a single slide keep working as they do today, then Next moves on to the following slide.

## 5. Smartboard

The Smartboard Slide button lists the current note's **decks**; choosing one presents it on the board. Presentation only — no authoring there.

---

## Technical notes

**Data (additive migrations only)**
- New `notebook_slide_decks`: `id`, `notebook_id` (FK notebooks, cascade), `name`, `position`, timestamps. GRANTs for `authenticated` + `service_role`, RLS enabled, policies scoped through the parent notebook's owner exactly like `notebook_slides`.
- `notebook_slides` gains nullable `deck_id` (FK cascade). Existing slides of a note are backfilled into an auto-created "Slides" deck per note, so nothing already saved is lost.
- `notebook_slide_items` gains nullable `content_json` (jsonb) and its `kind` accepts `content`. Existing `screenshot`/`image`/`video` rows keep working unchanged.
- Slides remain reachable only through `notebook_id`, so cross-note leakage stays impossible by construction.

**Client**
- `src/lib/lessonnotes/slides.ts` — add deck CRUD/reorder, `deck_id` filtering on slide queries, and `content_json` in the item read/write shapes.
- `src/components/lessonnotes/slides/SlidePanel.tsx` — three views: deck list → deck (slide strip + canvas of the open slide) → present. Create-deck prompt on first open; the four content actions live in the deck view.
- `src/components/lessonnotes/slides/SnipOverlay.tsx` — selection state becomes explicit (`idle | dragging | selected`); Capture button rendered from that state only. On confirm it extracts the note nodes intersecting the selection (via the sheet DOM rects and the existing document node model) and returns both the node payload and the selection geometry in note pixels.
- New `SlideContentBlock.tsx` — renders a captured content object using the existing `renderMathInline` / MathInline path, absolutely positioned at the captured pixel offsets inside a note-width canvas so scale is 1:1; editable in the slide editor, read-only in the player.
- `SlideCanvas.tsx` / `SlideMedia.tsx` / `SlidePlayer.tsx` — canvas becomes a fixed note-sized page scaled uniformly to the viewport (never per-object), and items may be content blocks as well as media.
- `DocumentEditor.tsx` ribbon button and `PresentationView.tsx` Slide menu switch to listing decks.

**Untouched**: Master Sensor, math tree and `#` navigation, AI Edit pipeline, math spacing repair, notebook autosave, DOCX export, geometry/graph/table tools.
