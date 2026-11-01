# Smartboard solution and writing-sensor draft

Based on the source retrieved at main revision 1a9a53f29526162160474ce5d5ffd3d6c15fd61a.

## Findings and changes

The first standalone floating-preparation note is automatically written beneath Solution. A copy of the problem stored in that note therefore repeats the header. The draft strips only a complete leading question echo from displayed notes, before note-prose filtering. It retains original lesson data, real equations, floating chips, diagrams, saved line identities and later recaps. Redundant leading note-only entries are bypassed without renumbering saved lines or setting student engagement.

Deleting the ink of a copied note could leave the physical row locked. The draft releases locks only when visible note ink existed and was subsequently erased; object-only reservations and rows with remaining half-row ink stay protected.

The sensor surrendered a manual placement as soon as ink appeared and could re-anchor when a physical row changed during typing. It now keeps a valid current/manual row until an explicit logical-line change. The fallback that pulled it below unrelated ink farther down the band is removed. The question/Solution caption boundary and nested mathematics navigation remain.

## Verification

19 new tests pass for duplicate notes, retained explanations/equations/diagrams, initial entry selection, erased-row reuse and sensor stability. Existing presentation, nested vertical maths, caret and saved-ownership tests pass: 23 more tests. Total: 42. The new helper passes strict TypeScript checks; modified production files pass syntax checks.

The checkout is partial. A full production build and live desktop/phone interaction test have not been performed. This is an unpublished local draft.

## Limits

Suppression is conservative: the note must start with a complete textual copy of its own problem (allowing a question/problem label and wrapped whitespace). It does not delete genuine first algebra equations or rewrite stored lessons. Existing duplicate ink already saved on a board is not silently deleted; erase it normally, and its row will now be reusable.

## Apply and release

Prefer the minimal changes.patch in this package, applying it to a current review branch after checking its context. The full source files are included for review, not as instructions to overwrite newer unrelated changes. Earlier Practice/Arena work is separate and must be rebased independently.

Before release, run the complete app build. Open a question whose first saved standalone note repeats the question: it should display once above Solution, then begin at the first real solution entry. Verify the initial caret starts just below Solution. Erase a note, move back into that row, and type. Move manually up/down and type fractions, powers and matrices: no unrequested jump or cursor reset should occur. Advance a genuine solution line and verify normal forward flow and marking. Reopen saved work and test teacher/student mirroring. Confirm introductory narration is not interrupted by automatic duplicate-note cleanup.
