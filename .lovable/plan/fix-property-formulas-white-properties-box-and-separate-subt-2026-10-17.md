# Fix property formulas, white properties box, and separate subtopic pages

## 1. Geometry property formulas drawn properly
**What's wrong:** In "How this was solved", the second property (Tan ∠BAC = BC / AB) shows an empty fraction bar with stray brackets `{ }BC} { }AB}` beside it, and the first shows the squares floating loose. In the editor the teacher sees them correctly.

**Cause (confirmed in the code):** when a property contains coloured side names (BC, AB…), the display cuts the formula into separate pieces around each name and draws each piece on its own. So a fraction gets split: the fraction bar is drawn empty and its top and bottom end up beside it as broken text. Squares, square roots, subscripts and powers that wrap a coloured name break the same way.

**Fix:**
- Draw the whole formula in one go, using the same maths drawing used by AI Edit and Co-Pilot. Each coloured side name keeps its colour inside it. Fractions stack, roots cover their whole contents, and powers and subscripts sit in the right place.
- Use this one drawing everywhere a property appears: "How this was solved", the Smartboard, properties under the diagram in Practice, Play and the Game, and the review list. All of them will look the same as the editor does.
- Add checks that a property like `tan∠BAC = BC/AB`, `AC² = BC² + AB²` and `√(AB² + BC²)` comes out as one stacked fraction, root or power, with no stray brackets.

## 2. White properties box
Change the dark grey property cards (and their small chips) to a white background with dark ink and a light border, so they read like the rest of the note.

## 3. Each subtopic opens its own lesson note
**Checked in the saved data:** "right angle triangle" and "sum of the angle in a triangle" currently hold exactly the same saved page. The second subtopic was given the first one's work, which is why clicking either shows the same note.

**Fix:**
- First, find exactly which step copies the old page into the new subtopic. The most likely cause is a delayed autosave from the previous subtopic finishing after the switch. Then stop it, so that:
  - Adding a subtopic always starts with a blank page.
  - Switching saves the page you're leaving to that subtopic only, then loads the target's own page.
  - A delayed save from the page you just left can never land in another subtopic.
- Your existing note: "right angle triangle" keeps its current work. "sum of the angle in a triangle" will be reset to a blank page, since right now it's only a copy. Your right-angle note is not touched.
- Add a check: two subtopics, write in A, switch to B (blank), write in B, switch back. A and B each keep their own work.

## 4. Co-Pilot knows the current subtopic
- Co-Pilot and AI Edit get the name of the subtopic you have open, and it updates the moment you switch. Today the name can stay on the old one until the page reloads.
- Co-Pilot's conversation history is kept per subtopic, so answers are about the subtopic you're on.

## Technical details
- `src/lib/geometry/map/renderTokens.tsx`: replace the fragment-splitting `renderWithGeoRefs` with one pass. `\georef{id}{label}` becomes a colour-scoped group that `renderMathInline` / the math tree renders inside the full expression (`\frac`, `\sqrt`, `^`, `_` intact). Normalise through `normalizeMathSource`. Same change for the token-fallback path.
- `GeometryGuideView.tsx`: card and chip backgrounds become a white surface token with foreground ink.
- `NotebookEditorPage.tsx`: cancel or guard the pending save in the editor's save layer (`flushLessonNote` / debounced save) using the subtopic id it was started for. Write `latestDocRef` per subtopic id. Update local `notebook.subtopic` / `active_subtopic_id` after a switch, and pass the subtopic to CoPilotPanel / AI context.
- One-time data correction: clear `document_json` for the duplicated second subtopic of this notebook. Its content is identical to the first, so nothing unique is lost.
- Tests: renderTokens structure test; a subtopic switch/save isolation test in `src/lib/lessonnotes/__tests__`.
