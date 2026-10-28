## Technical details

- `NotebookEditorPage.tsx` / `SubtopicDrawer.tsx`: first confirm in the browser why the drawer looks empty in your screenshot. The likely cause is the DocumentEditor's own left panel covering it, or the drawer losing its list after the first add. Then fix it so the drawer always shows the header **+**, the list, and visible delete buttons (not hover-only). Keep the existing open/closed state, and remember it per note.
- Check that `switchSubtopic` saves the current document before it loads the next one, over several switches in a row.
- `AcademiaApp.tsx` topbar: on desktop widths, add right padding (about 56px) so the palette and theme buttons sit clear of the fixed `FullscreenToggle` (top-3 right-3, z-9999). Phones are unchanged.
- Verify with Playwright at 1280px (Mathemagine buttons can be clicked) and in the lesson-note editor (add 3 subtopics, switch between them, close and reopen).
