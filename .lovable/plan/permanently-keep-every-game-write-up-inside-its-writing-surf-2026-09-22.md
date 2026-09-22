# Permanently keep every Game write-up inside its writing surface

## Goal
Make “text belongs inside its own writing surface” a continuously enforced Game rule. Surface 0, every Floating Numbers line, notes, both retained text renderers, every device size, room, material, and scroll position must obey it.

## Confirmed gap
- The surface and text currently share calculated dimensions, but the final visible letters are never checked against the final visible panel.
- Existing tests validate calculated widths and gaps only; they do not verify the rendered text’s actual left, right, top, and bottom edges against its matching surface.
- A renderer measurement, alignment offset, delayed font result, resize, room-safe-width change, or stale measurement can therefore separate the visible text from the panel without triggering a repair.
- The supplied image shows that exact failure: the panel and part of its equation occupy different horizontal ranges.

## Build

### 1. One authoritative writing rectangle
Create one immutable per-line `WritingSurfaceFrame` from the canonical 5%–95% room-safe band. It will contain the surface position, outer bounds, padded inner writing bounds, and line identity.

The physical surface, visible text, invisible layout text, pointer target, fallback text, notes, and renderer measurement will all consume this same frame. No child renderer may calculate a separate horizontal origin.

### 2. Primary containment rule — before paint
Normalize each renderer’s reported bounds into the surface’s local coordinate system before using them. Correct alignment/origin handling for left, centre, and right text, and clamp every renderer to the padded inner frame.

Surface growth and text placement will be committed from the same frame in one layout update, preventing a newly written expression from appearing before its surface has grown.

### 3. Backup containment rule — measured repair
After a renderer reports its real glyph bounds, compare all four text edges with that line’s padded writing bounds.

If any edge escapes:
- expand the same surface up to the safe-band limit;
- otherwise wrap the text within the existing teacher-selected size and spacing;
- recompute the line’s height and move later surfaces down while preserving their gaps.

The repair is idempotent and revision-keyed, so it cannot create a resize loop or move text to another line.

### 4. Final backup — visible-object guard
After fonts, 3D letters, tiles, resize, room changes, renderer changes, scrolling, and graphics recovery settle, verify the final visible object bounds against the matching surface object.

If they still disagree, suppress only the escaped visual pass for that frame and show the same text through the safe in-surface renderer. Keep the inactive renderer, input state, question state, and measurements mounted. Retry the preferred renderer after a valid measurement; never display escaped text, blank the mathematics, or relocate it to the margin.

### 5. Continuous checks without slowing the Game
Run containment checks only when a relevant revision changes: text, note reveal, active line, text settings, device class, room-safe width, selected renderer, font sync, graphics recovery, or measured bounds. Do not run a second permanent animation loop and do not touch grading, predictive evaluation, rewards, timers, Vault matching, Slate Artisan, room design, or camera behavior.

In development diagnostics, record the line ID, renderer, surface bounds, text bounds, and which guard repaired the mismatch. Production repairs remain silent.

### 6. Verification
Add layered regression coverage:
- pure bounds tests for left/centre/right alignment, minimum and maximum surfaces, long equations, multiline notes, and oversized saved text;
- renderer tests proving Surface Test and 3D Test use the same frame while the inactive renderer remains invisible but mounted;
- visual browser checks that compare actual text and panel bounds for Surface 0 and rapid Lines 1–3 entry;
- desktop, tablet, and phone sizes; roomless plus every room-safe-width family; all writing materials; scroll top/middle/bottom;
- note reveal only after an awarded line, confirming growth preserves gaps and never clips adjacent surfaces;
- font-delay, resize, graphics recovery, and fallback scenarios;
- a permanent screenshot regression based on the supplied failure: `x + 7 = 12` and `x + 7 − 7` must have every visible glyph inside their own cloud panels.

Also resolve the current Game runtime reference error before visual verification, then confirm there are no page errors.

## Acceptance rule
For every visible Game line:

```text
text.left   >= innerSurface.left
text.right  <= innerSurface.right
text.top    <= innerSurface.top
text.bottom >= innerSurface.bottom
```

If the preferred visual renderer cannot satisfy that rule on the current frame, the safe in-surface renderer is shown instead. The student must never see mathematics outside its matching writing surface again.
