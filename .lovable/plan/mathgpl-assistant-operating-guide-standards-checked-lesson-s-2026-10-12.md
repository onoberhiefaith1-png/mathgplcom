# MathGPL Assistant Operating Guide + standards-checked lesson saving (Stage 1)

## What was found
- The ChatGPT connector has 63 tools. `create_notebook` / `update_notebook` save free text straight into sections. They don't create question sessions or Solution areas, so they bypass the Smartboard structure. That is why the surds lesson came out as 1 section with 1 block of about 1,790 characters.
- The richer tools already exist and follow the standard: `add_lesson_session`, `write_question`, `append_lesson_lines`, `inspect_lesson_structure`, `repair_lesson_structure`, `read_lesson_note`, `highlight_solution`, `generate_floating`, `smartboard_test`, `assign_question`, plus the `slate_*` Game tools. The connector's startup instructions don't make the assistant use them in the right order.
- These standards already exist and are shared by Co-Pilot and AI Edit:
  - Pedagogy reference
  - Integrity (QUESTION_LOCK)
  - Session pairing
  - Solution completeness
  - Rendering and structure
  - Aura's `solutionContract`: line 1 restates the question, one step per line
- `generate_lesson_content` calls the notebook AI and spends credits. ChatGPT writing the lesson itself spends nothing.

## Stage 1 (this delivery)
1. **Capability map.** A document listing every production step that exists in the code, with its real page name and tool, in this order: Lesson note → Question session + Solution → Highlighting → Floating Numbers → Smartboard test → Game / activity → Assignment → Academia. Each step is marked available through ChatGPT, partial, or not available.
2. **Operating Guide v1.** One versioned guide, served to every connected assistant through new read-only tools:
   - `get_operating_guide` returns the version, the sequence, prerequisites, the approval rules, how to recover from a partial failure without making duplicates, and current limits.
   - `get_lesson_standards` returns the same standard text Co-Pilot reads, composed from the existing standard modules. No standard is forked.
   - The startup instructions are shortened to: load the guide first, then follow the lesson workflow.
3. **Standards-checked lesson saving.** A new `save_structured_lesson` tool:
   - It takes typed sections. Each Example, Exercise, Classwork or Homework question carries its own question text and solution lines.
   - It creates the proper question session and its paired Solution area, using the same session creation `add_lesson_session` / `write_question` use today.
   - It checks every solution before writing: line 1 restates the question, one micro-step per line, no split or merged equations, supported notation (no calculator or code syntax), and every question has a solution. If any check fails, nothing is saved and the tool returns a precise report.
   - It requires the current `guideVersion`. An old or missing version is refused and the assistant is told to reload the guide.
   - After saving, it reads the note back, runs the structure check, and only then reports success.
   - It calls no AI and spends no credits. AI generation stays a separate, labelled step that says it uses MathGPL credits.
4. **Steer away from the old write path.** `create_notebook` and `update_notebook` stay available for titles and cover details. Their descriptions will point lesson content to `save_structured_lesson`. Free-text worked questions that arrive through them get a warning and are not treated as finished.
5. **Repair preview for existing notes.** A read-only `preview_lesson_repair` tool shows what would change, for example the surds note split into sessions. Nothing is applied without your approval; the existing restore-point tools are used first.
6. **Approval rules stay in force on the server.** Deleting content, assigning to students and publishing still require a second call with `confirmed: true`. Each tool checks this itself.

## Later stages (planned, not built now)
- **Stage 2:** Highlighting, Floating Numbers and Smartboard test through the guide. Success is reported only after `inspect_board_state` reads the board back, so "command sent" is kept separate from "board applied it".
- **Stage 3:** Game and activity, assignment, then Academia content.
- **Stage 4:** A tutorial recording assessment report covering step playback, narration sync, screenshots, board video capture and upload to Academia. Each item is marked as existing, needs a new tool, needs browser permission, or needs an outside service. ChatGPT voice gives no exportable narration track, so narration would need text-to-speech.

## Verification
- Automated tests:
  - A compliant lesson is saved, read back and passes.
  - A merged or split step is rejected, and nothing is written.
  - A missing solution is rejected.
  - An old `guideVersion` is refused.
  - The owner comes only from the verified sign-in.
  - Another teacher's note can't be touched.
  - The guide tools return the same standard text Co-Pilot uses.
- Type check and the full test suite run; the tool list is regenerated.
- **Your live check after publishing:** a brand-new ChatGPT chat loads the guide, creates a short surds lesson with 2 questions, reads it back, and it opens correctly on the Smartboard.
- No publishing from my side. The plugin stays private, the Chemistry draft and other work are untouched, and no database changes are expected.

## Technical details
- New files:
  - `src/lib/mcp/guide/operatingGuide.ts`: guide text and the `GUIDE_VERSION` constant.
  - `src/lib/mcp/guide/lessonValidator.ts`: pure checks that reuse `checkSolution` from `src/lib/agent/solutionContract.ts` and the notation guard in `src/lib/notebook/mathSafety.ts` / `proseGuard.ts`.
  - `src/lib/mcp/tools/guide.ts`: the two read-only guide tools.
  - `src/lib/mcp/tools/save-structured-lesson.ts` and `src/lib/mcp/tools/preview-lesson-repair.ts`.
- Saving reuses the session and subsection insert logic behind `add_lesson_session` / `write_question` in `src/lib/agent/tools.server.ts`, so there is one way to build a session.
- The standards are composed through `lessonNoteTrainingBlocks()` in `src/lib/agent/lessonKnowledge.ts`.
- Edits: `src/lib/mcp/index.ts` (registration and shorter instructions), the descriptions in create/update-notebook, `docs/chatgpt/capability-map.md`, tests in `src/lib/mcp/__tests__/`, a rule line in `AGENTS.md`, and a `roadmap.md` for the later stages.
