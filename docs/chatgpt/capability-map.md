# MathGPL production steps available to ChatGPT (MCP)

Guide version: see `GUIDE_VERSION` in `src/lib/mcp/guide/operatingGuide.ts`.

| Step | Page in MathGPL | MCP tool(s) | Status |
| --- | --- | --- | --- |
| Lesson note + standards | Lesson Notes editor | get_operating_guide, get_lesson_standards, save_structured_lesson, read_lesson_note | Available, validated + read back |
| Question session + Solution | Lesson Notes (Example/Exercise/Classwork/Homework sessions) | save_structured_lesson / write_question | Available |
| Repair old notes | Lesson Notes | preview_lesson_repair → snapshot_lesson_note → repair_lesson_structure | Preview available; repair needs teacher approval |
| Highlighting (whole or part lines) | Floating Preparation page | set_solution_highlights (precise), highlight_solution, edit_highlights | Available, read back |
| Floating Numbers from ChatGPT tokens | Floating Numbers page | generate_solution_floating_numbers (no credits), validate_lesson_floating_numbers | Available, exact-reconstruction check |
| Operate Floating Numbers chips | Smartboard / Floating Numbers page | operate_floating_numbers (delete, move, merge, keep_together) | Available — saved then open boards refresh; confirm with get_current_view |
| Floating Numbers | Floating Numbers page (`/lesson-notes/:id/floating/:sub`) | generate_floating (uses MathGPL AI credits), read_floating_numbers | Partial |
| Smartboard test | Smartboard | smartboard_test, open_screen, smartboard_control, inspect_board_state, get_current_view | Partial — command sent ≠ applied; must read back |
| Game / activity | MathGPL Game (`/game`) | slate_* tools | Partial |
| Assignment | Class assignments | assign_question (confirmation required) | Partial |
| Academia content | `/school/academia` | none | Not available |
| Tutorial recording / video export | — | none | Not available (needs new tools; ChatGPT voice gives no exportable narration) |
