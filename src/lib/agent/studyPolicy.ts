// What Aura is allowed to do while she is studying on her own.
//
// Client-safe: the same fence is described here for the panel and enforced in
// `study.server.ts`, so there is one list, not two.

/** Every practice notebook she makes carries this in its title. */
export const PRACTICE_PREFIX = "Practice —";

export function isPracticeTitle(title: string | null | undefined): boolean {
  return typeof title === "string" && title.trim().startsWith(PRACTICE_PREFIX);
}

export function practiceTitle(subject: string): string {
  const clean = subject.trim().replace(/\s+/g, " ");
  return `${PRACTICE_PREFIX} ${clean || "study run"}`;
}

/**
 * The only actions a study run can take. Reading is open; writing happens only
 * inside her own practice notebooks. Nothing here can reach a student: no
 * assigning, no publishing, no sharing, no deleting, no class changes.
 */
export const STUDY_TOOL_IDS: string[] = [
  "workspace_snapshot",
  "explain_workflow",
  "recall_knowledge",
  "propose_knowledge",
  "web_search",
  "read_web_page",
  "study_tutorial",
  "list_classes",
  "list_lesson_notes",
  "create_lesson_note",
  "append_lesson_lines",
  "write_question",
  "add_lesson_session",
  "read_lesson_note",
  "inspect_lesson_note",
  "edit_lesson_text",
  "insert_lesson_lines",
  "move_lesson_lines",
  "promote_to_session",
  "reorder_lesson",
  "highlight_solution",
  "generate_floating_numbers",
  "read_floating_numbers",
  "smartboard_test",
  "inspect_board_state",
  "edit_highlights",
  "select_session",
  "navigate",
];

/** Tools that change something, so they must land on a practice notebook. */
export const STUDY_WRITE_TOOL_IDS: string[] = [
  "append_lesson_lines",
  "write_question",
  "add_lesson_session",
  "edit_lesson_text",
  "insert_lesson_lines",
  "move_lesson_lines",
  "promote_to_session",
  "reorder_lesson",
  "highlight_solution",
  "generate_floating_numbers",
  "edit_highlights",
];

export function isStudyTool(toolId: string): boolean {
  return STUDY_TOOL_IDS.includes(toolId);
}

export function isStudyWrite(toolId: string): boolean {
  return STUDY_WRITE_TOOL_IDS.includes(toolId);
}
