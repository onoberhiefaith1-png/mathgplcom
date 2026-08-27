# Fix Floating-Number Pipeline to Class Teaching Workspace

## Goal
Restore the existing pipeline so floating numbers created/saved in a Lesson Note appear in the Smartboard launched from the Class Dashboard, without redesigning the system.

## Current understanding (verified)
- The Smartboard source path is: `notebooks.document_json` → `syncDocumentToNotebook()` → `notebook_sections` / `notebook_subsections` / `notebook_blocks` → `useNotebook.loadStructure()` → `buildReservoirs()` → `FloatingNumberPanel`.
- The class launcher (`ClassSmartBoardLauncher`) opens `/smartboard/:notebookId?classId=:classId`, so it uses the same `PresentationView` component.
- Database check shows the attached notebook (`cdbaf0ae-d03b-4bdf-a0cc-2cd22b9dbe1c`) still has `floating_lines`, `floating_bucket`, and `floating_highlights` on its Example 1 subsection.
- A headless run of that exact route shows the Floating Number panel can open and render chips.
- The Lovable build is currently failing with a timeout, so the deployed preview is stale/broken and may be masking the actual runtime state.
- A plausible break point is `syncDocumentToNotebook`: if a recent outline change (e.g. `ownerQuestionId`) shifted `doc_key` or normalized problem text, subsections are recreated and their saved floating state is dropped.

## Plan

1. **Stabilize the build baseline**
   - Investigate the current `deadline_exceeded` / timeout failure.
   - Determine whether it is infrastructure or caused by a recent edit, and get a clean build before making pipeline changes.

2. **Verify the class-dashboard smartboard route end-to-end**
   - Re-run the headless path that launches from `/teaching-hub/classes/:classId/smartboard/` and selects the notebook, navigating to a question beat.
   - Confirm whether the Floating Number panel opens and shows the saved chips.

3. **Trace the exact pipeline break**
   - Add temporary diagnostics (or use existing logs) to `syncDocumentToNotebook`, `useNotebook.loadStructure`, and `buildReservoirs` to answer:
     - Does `syncDocumentToNotebook` run when launched from the class dashboard?
     - Does it match existing subsections by `doc_key` / problem text, or does it recreate them?
     - If subsections are recreated, are `floating_lines`, `floating_bucket`, and `floating_highlights` lost?
     - Does `loadStructure` return the floating columns to `PresentationView`?
     - Does `buildReservoirs` produce non-empty `reservoirs` for the active beat?

4. **Patch the precise break**
   - If the break is subsection re-creation losing floating state, make `syncDocumentToNotebook` preserve floating columns when it re-keys/moves a subsection, or make matching backward-compatible with the previous outline format.
   - If the break is the on-open sync not firing for class-launched notes, fix the `useNotebook` trigger condition.
   - If the break is in `buildReservoirs` filtering, adjust the empty/content checks without changing the overall pipeline.

5. **Add regression coverage**
   - Add a Playwright or unit test that simulates launching the class smartboard and asserts the Floating Number panel renders chips from saved `floating_bucket` / `floating_lines`.

6. **Verify the fix**
   - Re-run the headless class-dashboard launch.
   - Confirm the panel opens and the saved chips are present.
   - Run `bunx tsgo --noEmit` and any relevant tests.
