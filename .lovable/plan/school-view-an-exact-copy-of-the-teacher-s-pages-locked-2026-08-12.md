# School View: an exact copy of the teacher's pages, locked

The school currently sees purpose-built "shared workspace" screens with their own layout, badges and simplified content. That is wrong. The school must see the teacher's own pages — same layout, same text, same covers, same editor page — with every change blocked.

## What changes

- Lesson Notes, Smartboard, Classes, Adventure and Skill Builder in the school view will render the *same page components* the teacher uses, not custom copies.
- The lesson-note page opens the real note editor UI (toolbars, panels, pages, paper, assets) exactly as the teacher sees it — just frozen.
- Any action that would alter the teacher's work (New note, AI generate, rename, cover, duplicate, delete, assign, session, save, typing in the document, dragging assets) shows one message: **"You cannot make changes here. Only the teacher can edit this workspace."**
- Read-only actions stay alive: opening a note, scrolling, zoom, page navigation, previewing/presenting, opening a class to see students, assignments and progress.
- The purpose-built shared screens are removed so there is only one set of pages to maintain.

## How it will work (technical)

1. New `src/lib/accounts/viewAs.tsx` — a `ViewAsProvider` holding `{ ownerId, orgId, viewOnly: true, personName }`, plus:
   - `useViewAs()` for components,
   - `blockEdit()` helper that toasts the single lock message and returns false.
2. `src/lib/accounts/workspaceScope.ts` gains an override channel: when view-as is active, `activeSchoolOrgId()` resolves to the school org and owner-scoped queries use the viewed teacher's `user_id` instead of `auth.uid()`. Implemented as a module-level "impersonated scope" set by `ViewAsProvider` on mount and cleared on unmount, so existing pages need no query rewrites.
3. Teacher pages that write (`LessonNotesPage`, `NotebookEditorPage`/`DocumentEditor`, `ClassDashboardPage`, `Adventure`, Skill Builder pages) get a single guard at their mutation entry points: `if (!allowEdit()) return;`. Editor surfaces receive `readOnly` (contentEditable off, keyboard/paste/drag ignored, save timers disabled) driven by `useViewAs().viewOnly`.
4. School routes under `src/routes/school/teachers/$userId/*` swap their `Shared*Page` imports for the real teacher page components wrapped in `ViewAsProvider`, keeping the existing thin "Viewing <Teacher> · view only" bar above them.
5. Delete `src/pages/school/shared/*` and `SharedWorkspaceShell.tsx` once the routes point at the real pages.

## Notes

- Read access already exists via the school RLS policies added earlier, so no migration is needed; writes are blocked in the UI and would also be refused by the database.
- The teacher's own experience is untouched: without `ViewAsProvider`, `viewOnly` is false and every guard is a no-op.
