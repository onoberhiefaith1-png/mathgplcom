# Optional Curriculum Hierarchy for Class Lesson Notes

Adds an optional, teacher-configurable organisation structure above the lesson notes
list **inside a class**. The main Lesson Notes editor is untouched — it still opens
exactly as it does today once a note is reached.

## Default behaviour (unchanged)

A class with no settings changed shows the same flat grid of attached lesson notes,
with the same Add To Class, visibility, Adventure and remove controls. Existing
classes stay in this mode automatically.

## Settings

A Settings button on the Class Lesson Notes page opens a small dialog with three
toggles: Curriculum, Syllabus, Scheme of Work. Lesson Notes is always on and cannot
be disabled.

Dependency rules applied automatically when toggled on:
- Scheme of Work → Scheme of Work > Lesson Notes
- Syllabus → also turns on Scheme of Work
- Curriculum → also turns on Syllabus and Scheme of Work

Turning a level off cascades the other way (turning off Scheme of Work also turns
off Syllabus and Curriculum). If folders already exist at a level being disabled,
the dialog warns that their notes will appear ungrouped; the folder rows are kept in
the database so re-enabling restores the structure.

## Navigation

A breadcrumb at the top of the page shows only the enabled levels, e.g.
`Curriculum > Syllabus > Scheme of Work > Lesson Notes`. Each crumb is clickable and
jumps back to that level. Selecting an item at any level immediately filters the
level below it — no reload.

At each non-leaf level the page shows a card grid of that level's items plus a
"New …" card to create one (name + optional description). At the deepest level the
existing lesson-note grid renders unchanged, filtered to the selected folder.

## Creating and attaching notes

The "Add To Class" picker is unchanged, but when a hierarchy is enabled the notes
selected are attached to the currently selected folder. Attaching is only possible
once the teacher has navigated to the deepest level. Notes attached before the
hierarchy was enabled sit in an "Unsorted" bucket at the deepest level, and can be
moved into a folder from the card's menu.

## Student view

Students get the same breadcrumb navigation, read-only, driven by the same class
setting — no Settings button, no create cards, and only notes marked
student-visible. With no hierarchy enabled they see today's flat list. Back through
the breadcrumb walks up one level at a time.

## Technical notes

Additive migration only — nothing existing is altered destructively:

- `class_content_settings` (or a `lesson_note_levels text[]` column on `classes`,
  defaulting to `{}`) holds which levels are enabled per class.
- One self-referencing table `class_content_nodes`: `id`, `class_id`,
  `parent_id` (nullable, references itself), `level` (`curriculum` | `syllabus` |
  `scheme`), `name`, `description`, `order_index`, timestamps. Parent-child chain
  stores the hierarchy; unlimited curricula supported.
- `class_lesson_notes` gets a nullable `node_id` column referencing
  `class_content_nodes`. Null = unsorted, which is what every existing row is, so
  nothing breaks.
- GRANTs plus RLS: class owners manage nodes and settings; class members read them.
- Frontend: `src/pages/class/ClassLessonNotesPage.tsx` gains a level-state machine,
  breadcrumb, folder grid and settings dialog; `src/pages/student/StudentClassPage.tsx`
  (lesson notes area) reuses the same read-only browser component. Shared logic lives
  in a new `src/lib/classes/contentHierarchy.ts`.
- No changes to `NotebookEditorPage`, the notebook tables, or any editor component.
