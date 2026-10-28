# Board B = Independent Working Copy of the Lesson Note

Board A stays exactly as it is. Board B stops being a tools/companion board and becomes a full duplicate of the lesson note that the teacher can freely edit without touching the original.

## What changes

1. **Board B opens as a copy of the lesson note.** The first time a lesson note's Board B is opened, the entire note content is copied into the working copy: headings, sections, text, equations, diagrams, graphs, tables, questions and solutions — same order, same objects.
2. **Independent from then on.** Every later edit on Board B (delete a solution, add working, retype, rearrange) writes only to the working copy. The master lesson note is never modified, and later changes to the master do not overwrite the working copy.
3. **Same lesson-note experience.** Board B keeps the full Lesson Notes editor: formatting, math notation, diagrams, graphs, tables, zoom, paper settings, asset tools. Not a simplified editor.
4. **Removals.** The Calculator / Conversion / "Companion page" tab strip in Board B is removed. Board B is a single surface: the working copy. No extraction logic, no diagram/graph companion.
5. **No Session system.** Board B hides the session-authoring controls ("Add Session" / session-driven AI generation). It is rough work, not a lesson structure to build.
6. **Reset control.** A single "Copy again from lesson note" action in the Board B header lets the teacher discard the working copy and re-duplicate the current master (with a confirm step). This is the only path where the master flows into Board B after the first copy.

## Flow

```text
LESSON NOTE (master)
   |
   +---> BOARD A   presentation / teaching (unchanged)
   |
   +---> BOARD B   duplicate on first open, then independent rough work
```

## Technical notes

- Board B content already has a home: `notebooks.companion_json`, saved via `useNotebook().saveCompanionJson`. No schema change needed.
- Seeding: on Board B mount, if `companion_json` is empty/absent, deep-copy `notebook.document_json` into it once (guarded by a per-notebook ref so it never re-seeds), then render `DocumentEditor` with `documentJson={notebook.companion_json}` and `scopeSuffix="companion"`. Because the copy is a separate ProseMirror doc saved to a separate column, edits cannot reach `document_json`.
- Node identity: diagram/graph/table nodes carry ids used for per-note persistence. During the copy, regenerate those ids in the duplicated doc so deleting or editing an object on Board B cannot mutate the master's stored scene/graph records.
- `CompanionNoteBoard.tsx` becomes the whole Board B surface (renamed conceptually to the working copy); `InteractiveBoard.tsx` loses the tab strip and simply renders it with the back-to-Board-A button. Calculator/Conversion imports drop out of Board B.
- Session controls are hidden inside the companion scope via the existing `scopeSuffix`/chrome flags, not by forking the editor.
- `PresentationView.tsx` keeps the existing slide-in wrapper and `sectionId`/`sectionLabel` context wiring; only content editing is unsynchronised.
