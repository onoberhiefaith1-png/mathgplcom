# MathGPL production steps available to ChatGPT (MCP)

Guide version: see `GUIDE_VERSION` in `src/lib/mcp/guide/operatingGuide.ts`.

| Step | Page in MathGPL | MCP tool(s) | Status |
| --- | --- | --- | --- |
| Lesson note + standards | Lesson Notes editor | get_operating_guide, get_lesson_standards, save_structured_lesson, read_lesson_note | Available, validated + read back |
| Question session + Solution | Lesson Notes (Example/Exercise/Classwork/Homework sessions) | save_structured_lesson / write_question | Available |
| Repair old notes | Lesson Notes | preview_lesson_repair → snapshot_lesson_note → repair_lesson_structure | Preview available; repair needs teacher approval |
| Highlighting | Floating Preparation page (`/lesson-notes/:id/floating-prep/:sub`) | highlight_solution, edit_highlights | Partial — read-back not yet enforced |
| Floating Numbers | Floating Numbers page (`/lesson-notes/:id/floating/:sub`) | generate_floating (uses MathGPL AI credits), read_floating_numbers | Partial |
| Smartboard test | Smartboard | smartboard_test, open_screen, smartboard_control, inspect_board_state, get_current_view | Partial — command sent ≠ applied; must read back |
| Game / activity | MathGPL Game (`/game`) | slate_* tools | Partial |
| Assignment | Class assignments | assign_question (confirmation required) | Partial |
| Academia content | `/school/academia` | none | Not available |
| Tutorial recording / video export | — | none | Not available (needs new tools; ChatGPT voice gives no exportable narration) |
