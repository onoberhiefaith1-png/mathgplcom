# Canvas presentation system

## Goal

Make **Canvas** a first-class lesson session that opens a presentation selector, not an ordinary text, diagram, image, or Solution section.

The three levels stay separate:

1. **Canvas session** — a fixed `Canvas` heading placed anywhere in lesson flow.
2. **Canvas presentation** — a teacher-named container such as “Building a Venn Diagram”.
3. **Slides** — ordered 16:9 visual pages inside that presentation.

## What is already reusable

The project already stores multiple named Canvases per lesson, multiple ordered slides per Canvas, ordered image/video/content objects, media positions, sizes, reveal steps, and private media. The editor already supports Canvas renaming, slide creation/deletion/reordering, image/video import, object movement/resizing, Preview, and Smartboard playback.

The main gaps are that Canvas is currently a separate toolbar workspace rather than a real lesson session, the page is portrait (`794 × 1123`), Capture/Screenshot remain in the Canvas editor, Smartboard loads a flat lesson-wide slide list instead of a selected Canvas, and navigation still uses text buttons.

## Result

- **Section → Canvas** inserts a real structural Canvas session without a Solution.
- Opening that session shows a scrollable list of the lesson’s Canvas presentations and a selected presentation’s slides.
- Teachers create, rename, delete, and select Canvases; add, rename, delete, select, and reorder slides; and import or replace image/video media.
- Editor, Preview, embedded lesson playback, and Smartboard all render the same 16:9 scene with the same normalized coordinates.
- Presentation uses one large left chevron, one large right chevron, a subtle position indicator, keyboard arrows, and correct disabled states.
- Existing Canvas records and media are reused rather than copied or flattened.
- AI-created Canvas sequences remain a future extension point; this phase does not add AI generation or autoplay.
