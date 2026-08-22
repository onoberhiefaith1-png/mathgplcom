# Diagram sits where it was drawn — on the Floating page and on the Smartboard

## What the code shows today (verified)

- A diagram drawn straight onto the page is mirrored into the document as ONE hidden carrier node (`DocumentEditor.tsx` `syncPageGeometryNode`). On first save it is inserted at the **end of the section** (just before the next heading), not at the line it was drawn beside.
- The solution parser records each object's position as `afterLine = <number of text lines seen so far>` (`lessonOutline.ts`). Because the carrier sits at the end of the section, `afterLine` equals the last line — so the diagram is always ordered after all the solution text.
- The Highlighting page renders a notes-layer object as a bordered grey panel with an uppercase caption `DIAGRAM · NOTES CONTENT (NOT HIGHLIGHTABLE)` at full paper width (`FloatingPreparationPage.tsx`). The Floating Numbers page uses the same framed card.
- The board pipeline already carries `noteObjects` from highlights to `ReservoirLine` and into `TeacherNote.objects`, and the note icon shows when a line has prose OR objects. Whether a given note reveal actually draws the diagram on the real board is **not yet confirmed** — step 4 verifies it on your note before changing behaviour.

So there are two distinct defects: the diagram's **position** is lost at capture time, and its **appearance** is a boxed extra sheet instead of lesson content.

## Plan

1. **Anchor the drawing where it was drawn.** Give the page carrier a real line anchor: convert the drawn scene's vertical position into the paragraph it overlaps and insert/move the carrier there, inside the section, so a diagram drawn beside line 2 is stored between line 2 and line 3. Keep the anchor fresh when the drawing is moved or the text above it changes, and split a page scene with widely separated groups so each group anchors to its own line instead of one giant carrier.

2. **Render it as lesson content, not a panel.** On the Highlighting page a diagram renders inline, in document order, at the same size and alignment it has in the lesson note — no bordered card, no grey background, no uppercase caption, no full-page block. It stays unselectable and has no highlight checkbox (a small, quiet "notes content" hint on hover only).

3. **Same treatment on the Floating Numbers page.** The diagram appears inside its owning line's note area, inline and read-only, at note scale — not as a separate sheet under the list.

4. **Confirm and fix the Smartboard note.** Open the real note's board, press the note icon on the owning line, and confirm the diagram draws. If it doesn't, fix the actual break in the chain (highlight filter dropping the carrier, `noteObjects` missing from older saved states, or the reveal overlay), then re-test.

5. **Backfill existing notes.** Highlight states saved before this change carry no diagram or a wrong `afterLine`; re-derive their note objects and anchors on load so your current note works without redrawing anything.

6. **Test end to end in the browser** on this exact note: Highlighting page shows the diagram under line 2 inline, Floating page shows it in that line's note, Smartboard note icon draws it at classroom scale — with screenshots of the Floating page and the Smartboard as proof.

## Technical notes

- Files: `src/components/lessonnotes/DocumentEditor.tsx` (carrier anchoring + re-anchoring), `src/lib/lessonnotes/lessonOutline.ts` (honour an explicit anchor when present), `src/lib/floating/solutionItems.ts` (anchor normalisation), `src/pages/FloatingPreparationPage.tsx` and `src/pages/FloatingNumbersPage.tsx` (inline notes rendering), `src/components/lessonnotes/SolutionObjectView.tsx` / `src/styles.css` (note-scale inline variant), plus whatever step 4 identifies in `src/lib/smartboard/presentation.ts` / `PresentationView.tsx`.
- No schema change: objects stay in `notebook_blocks.content_json.objects` and `notebook_subsections.floating_highlights`.
- Unchanged: highlighting behaviour for text and tables, the diagram editor, and the rule that diagrams are never floatable.
