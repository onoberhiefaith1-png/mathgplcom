# Smartboard back button returns the way you came

## The problem

Opening the Smartboard from inside a lesson note works, but the Smartboard's back button always says **Shelf** and drops the teacher on the Smartboard shelf. Getting back to the note then takes several extra steps (shelf → rotating building → lesson notes → open note).

## The behaviour to build

- Smartboard opened from a lesson note (the Present / board icons inside the note editor) → back button reads **Lesson note** and returns to that exact note page it was launched from.
- Smartboard opened from the Smartboard shelf (or by a student through the class/student board) → back button stays **Shelf**, exactly as today.
- Same rule for the Presentation Preview screen's back button.
- A direct link with no origin falls back to **Shelf**.

## Technical notes

- The lesson-note entry points (`NotebookEditorPage` header Present button and the toolbar `onPresent`) navigate to `/smartboard/:id` with an origin marker, e.g. `?from=note`.
- `PresentationView` top-chrome back control and `SmartboardPreviewPage` read the marker: label it "Lesson note" and navigate to `/lesson-notes/:notebookId`; otherwise keep `/smartboard`.
- Shelf launches and `LessonNotesPage`'s list-level Present action do not set the marker, so shelf behaviour is unchanged; student/class launches (`?viewer=`, `?classId=`) are untouched.
- Navigation and labelling only — no database or content changes.
