# Stabilise the Lesson Note workspace: no freezing, always-visible controls, section navigation

Priority is the workspace itself, not the mathematics content. Nothing in this pass changes lesson text, AI prompts, or the diagram engine.

## What is confirmed today

- The lesson toolbar (Undo, Note Extend, Asset Library, Section, Session, Subtopic …) is pinned with `position: fixed; top: 54px` (`src/styles.css`). The page header above it is taller than 54px — it stacks a title row, an AI-mode line, a save pill and sometimes a recovery banner — and on a narrow window it is taller still. So the toolbar sits *underneath* the header and looks like it disappeared. This is a hard-coded offset, not a scroll problem.
- There is no section navigation anywhere in the workspace. `NotebookEditorPage` has only Shelf / title / Save to class / AI mode / Present. Moving between Lesson Note, Diagram, Example and Solution is done purely by scrolling the long page.
- The freeze itself is **not yet diagnosed**. There are three candidate mechanisms in the code and I will not guess between them: full-screen overlays that cover the whole app (`GeometryPropertiesWorkspace` at `z-95`, slide/snip/screenshot overlays at `z-9999+`) which leave the app looking dead if their close path is missed; the session layout guard (`src/lib/lessonnotes/sessionLayout.ts`), which dispatches document transactions from a `requestAnimationFrame` that is itself re-triggered by those transactions and by a `ResizeObserver`, so it can feed itself; and Co-Pilot request lifecycle state. Step 1 below identifies which one actually fires before anything is "fixed".

## Plan

### 1. Find and eliminate the frozen state (first, before anything else)

- Reproduce in the live preview: open a note with a solution and a diagram, run the flows that precede the freeze (open solution, open Geometry Map, generate, cancel), and capture console output, long-task/animation-frame activity and whether the blocking element is an overlay or a busy main thread.
- Fix the confirmed cause, then add the guards that make the class of failure impossible:
  - The layout guard runs at most a bounded number of passes per change and stops re-scheduling when it does not converge, so it can never occupy the main thread.
  - Every full-screen workspace/overlay in the note (Geometry Map, slide capture, screenshot, media picker, player) gets a guaranteed exit: Escape closes it, its own close button always renders, and it is unmounted when the note it belongs to unmounts.
  - A crash inside any of those surfaces is contained by the existing feature boundary instead of leaving an undismissable layer.

### 2. Restore and guarantee the top controls

- The toolbar offset is measured from the real header height instead of the hard-coded 54px, so the toolbar always sits directly under the header at any window width and with the recovery banner shown or hidden.
- The header itself is compacted into one row on narrow widths so it cannot grow tall enough to swallow the toolbar again.

### 3. Persistent Lesson Note section navigation

- A single fixed navigation strip under the header, always visible while the content below scrolls:

```text
Lesson Note | Diagram | Example | Solution | Exercise | Classwork | Homework | Summary
```

- The strip is built from what the open note actually contains, so it reflects the real sections rather than a fixed menu.
- Clicking an entry moves the workspace to that part of the note and puts the caret there. It never reloads the editor, never resets the document, never touches the Co-Pilot session, and never re-runs generation — it is navigation only, so it cannot pause or lock the workspace.
- The current section is highlighted as the teacher scrolls or edits.

### 4. Solution as an independent editable section

- A Solution stays a normal, always-editable part of the note. Entering, editing or leaving a Solution puts the workspace into no special mode, blocks no other section, and shows no blocking spinner over the note.
- While AI work is running, only the control that started it is disabled. The note, the toolbar and the section navigation remain fully interactive.

## Technical notes

- `src/styles.css` — `.lesson-ribbon-shell` top offset becomes a CSS variable fed by the measured header height.
- `src/pages/NotebookEditorPage.tsx` — measure and publish header height; render the new persistent section nav; compact header rows on narrow widths.
- New `src/components/lessonnotes/SectionNav.tsx` — derives sections from the document and scrolls/focuses on click.
- `src/components/lessonnotes/DocumentEditor.tsx` — expose section positions for the nav; ensure per-section AI busy state is local to its own control.
- `src/lib/lessonnotes/sessionLayout.ts` — convergence limit and bail-out so the guard cannot loop.
- Overlay surfaces under `src/components/lessonnotes/slides/` and `geometry-editor/GeometryPropertiesWorkspace.tsx` — Escape-to-close and unmount safety.

Unchanged: lesson content, AI prompts and standards, diagram construction engine, Co-Pilot procedure, database schema.

## Verification

In the live preview: open a geometry note, confirm the toolbar and the section strip are both visible at the current window size; click Diagram, Example and Solution and confirm each moves without reloading or locking; edit inside a Solution and confirm the rest of the note stays clickable; open and close the Geometry Map with both the button and Escape; run a Co-Pilot build and confirm the note, toolbar and navigation all stay interactive throughout; then repeat the flow that previously froze and confirm the page stays responsive.
