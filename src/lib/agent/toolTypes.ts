// Phase 1 — Platform Tool Execution Bridge.
//
// This module is client-safe: it describes WHAT the teaching agent is allowed
// to do on the platform. The executors live in `tools.server.ts`; the agent
// brain (Phase 2) reads `AGENT_TOOL_MANIFEST` to build its tool list.

export type AgentToolParam = {
  name: string;
  type: "string" | "number" | "boolean" | "string[]" | "number[]";
  required: boolean;
  description: string;
};

export type AgentToolSpec = {
  /** Stable id the agent calls. Never rename once shipped. */
  id: string;
  domain: "workspace" | "classes" | "lessonNotes" | "games" | "navigation" | "teaching";

  title: string;
  description: string;
  /** Read-only tools may run without confirmation. */
  readOnly: boolean;
  /** Destructive/irreversible tools always need teacher confirmation. */
  needsConfirmation: boolean;
  params: AgentToolParam[];
};

const p = (
  name: string,
  type: AgentToolParam["type"],
  required: boolean,
  description: string,
): AgentToolParam => ({ name, type, required, description });

export const AGENT_TOOL_MANIFEST: AgentToolSpec[] = [
  {
    id: "workspace_snapshot",
    domain: "workspace",
    title: "Workspace snapshot",
    description:
      "Read the teacher's current situation: profile name, active workspace, classes with schedules, recent lesson notes and games. Call this first in a new conversation.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "list_classes",
    domain: "classes",
    title: "List classes",
    description: "List the teacher's classes with id, name, class code and student count.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "create_class",
    domain: "classes",
    title: "Create a class",
    description:
      "Create a new class owned by the teacher and return its id, class code and join code.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("name", "string", true, "Class name, e.g. 'Grade 9 Mathematics'."),
      p("school", "string", false, "School or institution name."),
      p("description", "string", false, "Short description of the class."),
    ],
  },
  {
    id: "list_class_students",
    domain: "classes",
    title: "List students in a class",
    description: "List the students who have joined a class, with display names.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("classId", "string", true, "Class id from list_classes.")],
  },
  {
    id: "list_lesson_notes",
    domain: "lessonNotes",
    title: "List lesson notes",
    description: "List the teacher's lesson notebooks, newest first.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("limit", "number", false, "Maximum notebooks to return (default 20).")],
  },
  {
    id: "create_lesson_note",
    domain: "lessonNotes",
    title: "Create a lesson note",
    description:
      "Create an empty lesson notebook with a title, subject and subtopic, plus a first section. Returns notebookId and sectionId.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("title", "string", true, "Lesson title, e.g. 'Quadratic Equations'."),
      p("subject", "string", false, "Subject, e.g. 'Mathematics'."),
      p("subtopic", "string", false, "Subtopic or curriculum reference."),
      p("className", "string", false, "Class name printed on the note."),
      p(
        "sectionKind",
        "string",
        false,
        "First section kind: introduction, explanation, example, exercise, classwork, homework or summary. Default explanation.",
      ),
    ],
  },
  {
    id: "plan_lesson_note",
    domain: "lessonNotes",
    title: "Plan a lesson section the Co-Pilot's way",
    description:
      "Ask the lesson-note generator's own analysis stage what the mathematics of a section must be: the objective, the method it has to require, the given values, whether a diagram is genuinely needed and what form the answer takes. Use this before writing a whole note, then tell the teacher the plan in one or two sentences.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("notebookId", "string", false, "Lesson note the section belongs to, so the topic is read from it."),
      p("sectionKind", "string", false, "introduction, explanation, example, exercise, classwork, homework or summary."),
      p("topic", "string", false, "Topic, if there is no notebook yet."),
      p("subtopic", "string", false, "Subtopic, if there is no notebook yet."),
      p("level", "string", false, "Curriculum level or year group."),
      p("difficulty", "string", false, "Intended reasoning demand."),
      p("instruction", "string", false, "What the teacher asked for, in their own words."),
      p("sessionContext", "string", false, "What is already on the page, so the plan continues it."),
    ],
  },
  {
    id: "generate_lesson_content",
    domain: "lessonNotes",
    title: "Write lesson-note content with the trained generator",
    description:
      "Write an introduction, explanation, example question, worked solution, exercise, classwork, homework or summary using the SAME trained lesson-note generator the Co-Pilot uses, and save it into the note. Prefer this over writing the wording yourself. A solution must be generated inside its own question (pass its subsectionId); if the question is missing, the generator refuses and nothing is written. If a solution comes back incomplete, nothing is saved — say so and generate it again.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("sectionId", "string", true, "Section id from create_lesson_note, add_lesson_session or read_lesson_note."),
      p("blockKind", "string", false, "problem, solution, reasoning or text. Default text."),
      p("subsectionId", "string", false, "Question id. Required for problem and solution content."),
      p("sectionKind", "string", false, "Overrides the section's own kind if needed."),
      p("instruction", "string", false, "What the teacher asked for, in their own words."),
      p("activeQuestion", "string", false, "The question a solution belongs to. Read from the note when omitted."),
      p("currentContent", "string", false, "Content already in this block, when improving it."),
      p("level", "string", false, "Curriculum level or year group."),
      p("objectives", "string", false, "Learning objectives of the lesson."),
    ],
  },
  {
    id: "review_lesson_section",
    domain: "lessonNotes",
    title: "Check a question and its solution",
    description:
      "Run the lesson-note generator's own review pass over a question and its solution. Use it after generating a solution: if it reports a problem, fix that before telling the teacher the section is finished.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("subsectionId", "string", true, "Question id."),
      p("instruction", "string", false, "What the section was meant to achieve."),
      p("method", "string", false, "The method the question was supposed to require."),
    ],
  },
  {
    id: "append_lesson_lines",
    domain: "lessonNotes",
    title: "Write lines into a lesson note",
    description:
      "Append content lines to a lesson-note section. Each line is one pedagogical micro-step, written in the classroom whiteboard style (never skip a transition).",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("sectionId", "string", true, "Section id from create_lesson_note or read_lesson_note."),
      p("lines", "string[]", true, "Lines to append, in order."),
      p(
        "subsectionId",
        "string",
        false,
        "The question these lines belong to. Required for problem and solution lines, so the Smartboard and Floating Numbers can read them.",
      ),
      p(
        "kind",
        "string",
        false,
        "Block kind for every line: problem, solution, reasoning or text. Default text.",
      ),
    ],
  },
  {
    id: "edit_lesson_line",
    domain: "lessonNotes",
    title: "Rewrite one line of a lesson note",
    description:
      "Replace the text of one existing line. Use this to correct a step rather than writing a second version of it.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("blockId", "string", true, "Line id from read_lesson_note or inspect_lesson_structure."),
      p("text", "string", true, "The line as it should now read."),
    ],
  },
  {
    id: "insert_lesson_lines",
    domain: "lessonNotes",
    title: "Insert lines in the middle of a lesson note",
    description:
      "Write one or more lines into the middle of a session or a question, pushing the lines below it down. Use this when a micro-step was skipped.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("lines", "string[]", true, "Lines to insert, in order."),
      p("afterBlockId", "string", false, "Insert directly after this line."),
      p("sectionId", "string", false, "Session to insert into, when there is no afterBlockId."),
      p("subsectionId", "string", false, "Question to insert into, when there is no afterBlockId."),
      p("atPosition", "number", false, "Position to insert at, counting from 0. Default the top."),
      p("kind", "string", false, "problem, solution, reasoning or text. Default text."),
    ],
  },
  {
    id: "move_lesson_line",
    domain: "lessonNotes",
    title: "Move a line up or down",
    description:
      "Move one line to another position within the same session or question, and read the new order back.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("blockId", "string", true, "Line id."),
      p("toPosition", "number", true, "New position, counting from 1."),
    ],
  },
  {
    id: "preview_lesson_removal",
    domain: "lessonNotes",
    title: "Show exactly what a removal would delete",
    description:
      "Before deleting anything, list the exact lines that would go, any Floating Numbers that would go with them, and any game that is using that question. Read this to the teacher first — deleting cannot be undone.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("blockIds", "string[]", false, "Specific lines."),
      p("subsectionId", "string", false, "A whole question."),
      p("sectionId", "string", false, "A whole session."),
    ],
  },
  {
    id: "remove_lesson_lines",
    domain: "lessonNotes",
    title: "Delete lines from a lesson note",
    description:
      "Delete lines for good. Always call preview_lesson_removal first, read it out, and wait for a clear yes; then call this with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [p("blockIds", "string[]", true, "Lines to delete.")],
  },
  {
    id: "inspect_lesson_structure",
    domain: "lessonNotes",
    title: "Check a lesson note is built properly",
    description:
      "Walk a whole lesson note and report its sessions, the questions inside each, their Floating Numbers, any lines left loose outside a question, and any question typed as plain prose instead of being given its own session. Use this before teaching, generating Floating Numbers, or attaching a question to a game.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("notebookId", "string", true, "Lesson-note id.")],
  },
  {
    id: "repair_lesson_structure",
    domain: "lessonNotes",
    title: "Straighten a session whose question is loose",
    description:
      "Give a question session a proper question if it has none, and move its loose question and solution lines inside it. Lines are moved, never copied, so no duplicate appears.",
    readOnly: false,
    needsConfirmation: false,
    params: [p("sectionId", "string", true, "Session id from inspect_lesson_structure.")],
  },

  {
    id: "add_lesson_session",
    domain: "lessonNotes",
    title: "Add a session to a lesson note",
    description:
      "Add a new session to a lesson note: an Example, Exercise, Classwork or Homework heading with its own solution area, which is the unit the Smartboard steps through. Every question must be written inside a session created this way — never as a plain line of text. Returns sectionId (write the question and solution into it) and subsectionId (the session the Floating Number pages use).",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("notebookId", "string", true, "Notebook id from create_lesson_note or list_lesson_notes."),
      p(
        "kind",
        "string",
        true,
        "Session kind: example, exercise, classwork or homework. Also accepts introduction, explanation or summary for a plain section.",
      ),
      p("title", "string", false, "Optional title for the session, e.g. 'Example 2'."),
    ],
  },
  {
    id: "read_lesson_note",
    domain: "lessonNotes",
    title: "Read a lesson note",
    description:
      "Read a notebook's sections and their content lines so the agent can check its own work before reporting back.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("notebookId", "string", true, "Notebook id.")],
  },
  {
    id: "link_lesson_note_to_class",
    domain: "lessonNotes",
    title: "Share a lesson note with a class",
    description: "Attach an existing lesson note to a class so its students can open it.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("classId", "string", true, "Class id."),
      p("notebookId", "string", true, "Notebook id."),
    ],
  },
  {
    id: "list_games",
    domain: "games",
    title: "List the 3D Slate games",
    description:
      "List the teacher's real 3D Slate games — the ones the Game editor opens and classes play — with their id, name, topic and how many writing surfaces they have.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "list_teaching_hub_games",
    domain: "games",
    title: "List the older teaching-hub games",
    description:
      "List the separate, older teaching-hub game records (not the 3D Slate games). Only use this when the teacher is asking about that older list.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "link_game_to_class",
    domain: "games",
    title: "Add an older teaching-hub game to a class playlist",
    description:
      "Add one of the older teaching-hub games to a class playlist. This is NOT how a 3D Slate game reaches a class — use slate_publish_game for that.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("classId", "string", true, "Class id."),
      p("gameId", "string", true, "Game id from list_teaching_hub_games."),
    ],
  },
  {
    id: "agent_capabilities",
    domain: "workspace",
    title: "List what you can actually do",
    description:
      "List your own abilities, grouped by area, marking which ones write, which need the teacher's confirmation, and which parts of the platform you can only guide rather than operate. Use this whenever anyone asks what you can do, or before promising a piece of work.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "slate_list_rooms",
    domain: "games",
    title: "List the rooms a game can be built in",
    description:
      "List the real 3D rooms a Slate game can live in. Never offer a room that is not on this list.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "slate_list_rewards",
    domain: "games",
    title: "List the real rewards and how each is earned",
    description:
      "List the game's actual reward types and their earning rules, including which three are derived from the question itself and can never be placed by hand. A picture is never a reward.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "slate_read_game",
    domain: "games",
    title: "Read a Slate game back",
    description:
      "Read one Slate game's saved settings, its levels in saved order with their marks, and the classes playing it. Always do this after writing, before telling the teacher anything.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id from list_games."),
      p("classId", "string", false, "Read the levels of one Class + Game instance. Omit for the teacher's own pool."),
    ],
  },
  {
    id: "slate_create_game",
    domain: "games",
    title: "Create a Slate game draft",
    description:
      "Create a new 3D Slate game draft in the teacher's workspace. A draft is invisible to students until it is published to a class. Calling this twice with the same name and topic returns the same game instead of making a second.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("name", "string", true, "Game name, e.g. 'Indices Quest'."),
      p("topic", "string", false, "Topic, e.g. 'Indices'."),
      p("subtopic", "string", false, "Subtopic."),
      p("roomId", "string", false, "Room id from slate_list_rooms. Default the first room."),
      p("lines", "number", false, "How many writing surfaces to start with, 1 to 24. Default 6."),
    ],
  },
  {
    id: "slate_update_game",
    domain: "games",
    title: "Change a Slate game's settings",
    description:
      "Change a draft's name, topic, subtopic, room, number of writing surfaces or reward pattern length. Refuses to throw away a surface that already has work or rewards on it.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("name", "string", false, "New name."),
      p("topic", "string", false, "New topic."),
      p("subtopic", "string", false, "New subtopic."),
      p("roomId", "string", false, "Room id from slate_list_rooms."),
      p("lines", "number", false, "New number of writing surfaces, 1 to 24."),
      p("patternLength", "number", false, "How many lines the repeating reward pattern covers."),
      p("expectedSavedAt", "string", false, "The savedAt you last read, so a change made elsewhere is not overwritten."),
    ],
  },
  {
    id: "slate_configure_rewards",
    domain: "games",
    title: "Configure a game's reward settings",
    description:
      "Set the game's reward visibility, opacity, glow and size, the Life multiplier, and the four conversion factors. These are the only reward settings the game has — never invent another.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("visible", "boolean", false, "Are rewards shown on the slate?"),
      p("opacity", "number", false, "0 to 1."),
      p("glow", "number", false, "0 to 1."),
      p("scale", "number", false, "0.2 to 3."),
      p("lifeMultiplier", "number", false, "What one Life gives back, as a multiple of a question's time."),
      p("hourglassToTime", "number", false, "0.1 to 10."),
      p("lifeToTime", "number", false, "0.1 to 10."),
      p("vaultToLife", "number", false, "0.1 to 10."),
      p("completionToLife", "number", false, "0.1 to 10."),
    ],
  },
  {
    id: "slate_place_reward",
    domain: "games",
    title: "Place a reward on a game line",
    description:
      "Place one placeable reward on a solving line. Line 0 is the question and never carries a reward; solving begins at line 1. Completion, Hourglass and Vault come from the question itself and are refused here.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("type", "string", true, "Reward type from slate_list_rewards, e.g. 'retry-heart'."),
      p("line", "number", false, "Solving line, starting at 1. Default 1."),
      p("x", "number", false, "Across the surface, 8 to 92 percent. Default 70."),
      p("y", "number", false, "Down the surface, 8 to 92 percent. Default 50."),
    ],
  },
  {
    id: "slate_attach_question",
    domain: "games",
    title: "Attach a lesson-note question as a game level",
    description:
      "Attach one lesson-note question to a game as the next Level. The game only ever references the question, so the mathematics, marks and timing stay in the lesson note. Give the classId to build that class's own ordered set of levels. Existing levels are never moved or hidden.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("subsectionId", "string", true, "Question (session) id, which must already have Floating Numbers."),
      p("classId", "string", false, "The class this playable set belongs to. Omit for the teacher's own pool."),
    ],
  },
  {
    id: "slate_list_game_questions",
    domain: "games",
    title: "List a game's levels",
    description: "List a game's levels in their saved order, with their question text and marks.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("classId", "string", false, "Class id for one Class + Game instance."),
    ],
  },
  {
    id: "slate_reorder_game_questions",
    domain: "games",
    title: "Reorder a game's levels",
    description:
      "Write a new level order. The list must contain every level of that game exactly once.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("questionRowIds", "string[]", true, "Every level's questionRowId, in the new order."),
      p("classId", "string", false, "Class id for one Class + Game instance."),
    ],
  },
  {
    id: "slate_remove_game_question",
    domain: "games",
    title: "Remove a level from a game",
    description:
      "Take one level off a game. The lesson-note question itself is untouched. Destructive: ask the teacher first, then call again with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("gameId", "string", true, "Game id."),
      p("questionRowId", "string", true, "The level's questionRowId from slate_list_game_questions."),
      p("classId", "string", false, "Class id for one Class + Game instance."),
    ],
  },
  {
    id: "slate_test_game",
    domain: "games",
    title: "Inspect and test a game draft",
    description:
      "Check a draft properly: that levels are attached and in order, that each has Floating Numbers, that marks exist, that there are enough writing surfaces, and what rewards are placed. Returns each check's result. Nothing is recorded against any student, and opening the preview is not itself a pass — say which checks still need the teacher's eyes.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("gameId", "string", true, "Game id."),
      p("classId", "string", false, "Class id to inspect one Class + Game instance."),
    ],
  },
  {
    id: "slate_publish_game",
    domain: "games",
    title: "Publish a Slate game to a class",
    description:
      "Give the game to a real class, so its students can play it. Before calling, show the teacher the game, the class and what the class will receive, and wait for a clear yes. Then call again with confirmed set to true. Refuses when that class has no levels attached.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("gameId", "string", true, "Game id."),
      p("classId", "string", true, "Class id from list_classes."),
      p("passPercentage", "number", false, "Pass mark, 0 to 100. Default 70."),
      p("title", "string", false, "Title the class sees. Defaults to the game's name."),
    ],
  },

  {
    id: "archive_lesson_note",
    domain: "lessonNotes",
    title: "Archive a lesson note",
    description:
      "Move a lesson note out of the teacher's active notes. Destructive: always ask the teacher first, then call again with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [p("notebookId", "string", true, "Notebook id from list_lesson_notes.")],
  },
  {
    id: "remove_student_from_class",
    domain: "classes",
    title: "Remove a student from a class",
    description:
      "Take a student off a class roster. Destructive: always ask the teacher first, then call again with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("classId", "string", true, "Class id."),
      p("studentId", "string", true, "Student user id from list_class_students."),
    ],
  },
  {
    id: "teach_lesson",
    domain: "teaching",
    title: "Teach out loud on the board",
    description:
      "Teach a solution aloud, one micro-step at a time, while the board follows her: each sentence is spoken in order and the board's active line moves to the line that sentence is about. Use this whenever the teacher asks you to TEACH, explain on the board, or present a solution live. Say one micro-step per sentence, exactly as it would be written on a whiteboard, and never skip a transition.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("say", "string[]", true, "One short spoken sentence per micro-step, in teaching order."),
      p(
        "lines",
        "number[]",
        false,
        "1-based board line for each sentence, same order and length as 'say'. Use 0 or omit for an aside that belongs to no line.",
      ),
      p("title", "string", false, "Short name of what is being taught."),
    ],
  },
  {
    id: "explain_workflow",
    domain: "workspace",
    title: "Look up how a MathGPL workflow really works",
    description:
      "Read the real, step-by-step workflow of a part of MathGPL: where it starts, what it needs, what saving creates, where the result appears, what comes next, and what must never be got wrong. Use this before guiding a teacher through anything you have no tool for, so the steps you give are the app's real steps and never invented. Workflow ids: accounts, workspaces, building, classes, roster, courses, assignments, lesson-notes, lesson-sections, floating-preparation, floating-numbers, floating-test, assign-question, smartboard, live, assessments, adventures, slate-game, reports, community, settings.",

    readOnly: true,
    needsConfirmation: false,
    params: [
      p("workflow", "string", true, "One workflow id from the list above."),
    ],
  },
  {
    id: "highlight_solution",
    domain: "lessonNotes",
    title: "Highlight a written solution",
    description:
      "Mark every written micro-step of a question's solution as the source of its Floating Numbers. This is stage one: Floating Numbers can only come from a highlighted solution, never from a blank page. Run it after the solution is written, before generating.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("subsectionId", "string", true, "Session (question) id from add_lesson_session or read_lesson_note."),
    ],
  },
  {
    id: "generate_floating_numbers",
    domain: "lessonNotes",
    title: "Generate the Floating Numbers",
    description:
      "Stage two: turn each highlighted solution line into its chips, with their fraction, bracket, root, power and matrix shells, and save them where the Smartboard reads them. Ask the teacher first whether the chips should start in solution order or shuffled — that is the one real choice. There is no tight or scattered spacing setting.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("subsectionId", "string", true, "Session (question) id."),
      p(
        "order",
        "string",
        false,
        "'solution' to start the chips in solution order, or 'shuffled' so students rebuild the line. Default solution.",
      ),
    ],
  },
  {
    id: "read_floating_numbers",
    domain: "lessonNotes",
    title: "Read the Floating Numbers back",
    description:
      "Read the question, its highlights and its saved Floating Number lines, so you can check your own work before telling the teacher anything.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("subsectionId", "string", true, "Session (question) id.")],
  },
  {
    id: "smartboard_test",
    domain: "lessonNotes",
    title: "Test the question on the Smartboard",
    description:
      "Open the dry run of one question on the real student board. Nothing is saved and nobody is marked. Always offer this before assigning.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("subsectionId", "string", true, "Session (question) id.")],
  },
  {
    id: "assign_question",
    domain: "classes",
    title: "Assign the question to a class",
    description:
      "Put the question in front of a class for real, through the platform's own assignment pipeline. The students see it immediately, so ask the teacher first and only then call again with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("subsectionId", "string", true, "Session (question) id."),
      p("classId", "string", true, "Class id from list_classes."),
      p("kind", "string", false, "classwork, homework, assessment or practice. Default classwork."),
      p("title", "string", false, "Title the class sees. Defaults to the question's first line."),
      p("dueAt", "string", false, "Deadline as an ISO timestamp, or omit for no deadline."),
    ],
  },
  {
    id: "propose_knowledge",
    domain: "workspace",
    title: "Write down what you just learned",
    description:
      "Record a workflow you observed or were taught, for the administrator to approve. Write only what you actually saw, keeping observed behaviour separate from intended behaviour — a bug is never a rule. Nothing recorded here is trusted until the administrator approves it.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("feature", "string", true, "The feature or area, in the app's real words."),
      p("scope", "string", false, "What this entry covers, and what it does not."),
      p("roles", "string[]", false, "Who may do this."),
      p("preconditions", "string[]", false, "What must already exist first."),
      p("steps", "string[]", true, "The steps, in order, as observed."),
      p("expectedResult", "string", false, "What should happen when the steps are followed."),
      p("verification", "string", false, "How the result was checked."),
      p("failures", "string[]", false, "Known failures and how to recover."),
      p("evidence", "string", false, "What you actually observed, and when."),
      p(
        "status",
        "string",
        false,
        "'observed' for behaviour you saw yourself, 'proposed' for a workflow you were told. Default proposed.",
      ),
    ],
  },
  {
    id: "recall_knowledge",
    domain: "workspace",
    title: "Recall what you have been taught",
    description:
      "Read the approved and observed entries the administrator has settled, optionally filtered by feature. Use this before guiding anyone through a workflow you were taught rather than one written into the platform map.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("feature", "string", false, "Filter by feature name.")],
  },
  {
    id: "list_attachments",
    domain: "workspace",
    title: "List the files given to you",
    description:
      "List the photos and PDFs the teacher has handed you through the plus button, newest first, with their ids and names.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "read_attachment",
    domain: "workspace",
    title: "Read a file the teacher gave you",
    description:
      "Actually look at one photo or PDF the teacher uploaded and report what is written in it. Use this before turning a file into lesson-note work; never guess a file's contents. Word documents cannot be read — ask for a PDF.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("attachmentId", "string", false, "The file id from list_attachments. Omit to read the newest file."),
      p("name", "string", false, "The file name the teacher used, if no id is known."),
      p(
        "instruction",
        "string",
        false,
        "What to look for, e.g. 'copy out question 4 only'. Defaults to writing out every question and its topics.",
      ),
    ],
  },

  {
    id: "write_question",
    domain: "lessonNotes",
    title: "Write a question with its solution",
    description:
      "Write one complete worked question: creates the session (Example, Exercise, Classwork, Homework or Assessment), writes the question line as the question and the worked steps as its solution beneath it — all belonging to that one session — then reads them back. This is the only correct way to add a worked example; never write 'Example 1: … solved' as a plain line. Two worked examples mean two calls. Returns subsectionId, ready for highlight_solution and generate_floating_numbers.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("notebookId", "string", true, "Notebook id from create_lesson_note or list_lesson_notes."),
      p("question", "string", true, "The question exactly as the teacher gave it — never reworded."),
      p(
        "solution",
        "string[]",
        true,
        "The worked solution, one micro-step per line, in order. The first line restates the question verbatim.",
      ),
      p("kind", "string", false, "Session kind: example, exercise, classwork, homework or assessment. Default example."),
      p("title", "string", false, "Optional session title, e.g. 'Example 2'."),
    ],
  },
  {
    id: "inspect_lesson_note",
    domain: "lessonNotes",
    title: "Inspect a lesson note's structure",
    description:
      "Read a whole lesson note as a structure: every section, every session inside it with its id, every line with its id, kind and order, and what each session is still missing (no question, no solution, not highlighted, no Floating Numbers, or chips that no longer match the solution). It also warns about questions written outside a session, which the Smartboard cannot step through. Call this before repairing anything.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("notebookId", "string", true, "Notebook id from list_lesson_notes.")],
  },
  {
    id: "edit_lesson_text",
    domain: "lessonNotes",
    title: "Change existing text",
    description:
      "Change text that is already written: one line (blockId + text), a session heading (sectionId + title), or the lesson note's title (notebookId + title). Never change a teacher's question wording unless they asked for that exact change.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("blockId", "string", false, "Line id from inspect_lesson_note."),
      p("sectionId", "string", false, "Section or session id, to rename its heading."),
      p("notebookId", "string", false, "Notebook id, to rename the lesson note."),
      p("text", "string", false, "The new text for a line."),
      p("title", "string", false, "The new heading or note title."),
    ],
  },
  {
    id: "move_lesson_lines",
    domain: "lessonNotes",
    title: "Move existing lines",
    description:
      "Move lines that already exist into another session or section, keeping their text exactly as written. Use this instead of writing a corrected copy and leaving the original behind.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("blockIds", "string[]", true, "Line ids to move, in the order they should land."),
      p("toSectionId", "string", false, "Destination section id."),
      p("toSubsectionId", "string", false, "Destination session id."),
      p("at", "number", false, "0-based position in the destination. Omit for the end."),
    ],
  },
  {
    id: "promote_to_session",
    domain: "lessonNotes",
    title: "Move a question into its own session",
    description:
      "Repair a question that was written as ordinary text: create a proper Example, Exercise, Classwork or Homework session and move the question line and its solution lines into it, word for word. This is how a question written inside an Introduction becomes teachable on the Smartboard. Highlight and generate afterwards.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("kind", "string", false, "example, exercise, classwork or homework. Default example."),
      p("title", "string", false, "Heading for the new session, e.g. 'Example 2'."),
      p("questionBlockIds", "string[]", true, "Line ids that form the question."),
      p("solutionBlockIds", "string[]", false, "Line ids that form its solution, in order."),
    ],
  },
  {
    id: "reorder_lesson",
    domain: "lessonNotes",
    title: "Reorder lines, sessions or sections",
    description:
      "Put things in the right order: scope 'blocks' for lines inside one session, 'sessions' for the sessions in a section, or 'sections' for the sections of the note. List every id in that group exactly once, in the new order.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("scope", "string", true, "blocks, sessions or sections."),
      p("orderedIds", "string[]", true, "All ids in the group, in the new order."),
      p("notebookId", "string", false, "Required when scope is sections."),
      p("sectionId", "string", false, "Required when scope is sessions."),
    ],
  },
  {
    id: "preview_removal",
    domain: "lessonNotes",
    title: "Show exactly what would be removed",
    description:
      "Read out the exact lines that would disappear before anything is removed. Always call this first and show the teacher the words, then ask for their yes.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("blockIds", "string[]", false, "Line ids."),
      p("subsectionId", "string", false, "Session id."),
      p("sectionId", "string", false, "Section id."),
    ],
  },
  {
    id: "delete_lesson_content",
    domain: "lessonNotes",
    title: "Remove duplicated lines, a session or a section",
    description:
      "Remove leftover lines, an empty session, or a section from a lesson note. Destructive: show the teacher the exact words with preview_removal, get a clear yes, then call this again with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("blockIds", "string[]", false, "Line ids to remove."),
      p("subsectionId", "string", false, "Session id to remove, with its lines."),
      p("sectionId", "string", false, "Section id to remove, with everything in it."),
    ],
  },
  {
    id: "snapshot_lesson_note",
    domain: "lessonNotes",
    title: "Save a restore point",
    description:
      "Store the whole note exactly as it is now, so it can be put back if a repair goes wrong. Always do this before moving, reordering or removing anything.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("notebookId", "string", true, "Notebook id."),
      p("label", "string", false, "Short name for the restore point, e.g. 'Before fixing the Introduction'."),
    ],
  },
  {
    id: "list_restore_points",
    domain: "lessonNotes",
    title: "List the restore points",
    description: "List the restore points saved for a lesson note, newest first.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("notebookId", "string", true, "Notebook id.")],
  },
  {
    id: "restore_lesson_note",
    domain: "lessonNotes",
    title: "Put the lesson note back",
    description:
      "Restore a lesson note to a saved restore point, replacing its current sections, sessions and lines. Destructive: ask the teacher first, then call again with confirmed set to true.",
    readOnly: false,
    needsConfirmation: true,
    params: [
      p("notebookId", "string", true, "Notebook id."),
      p("restorePointId", "string", false, "Restore point id. Omit for the newest one."),
    ],
  },
  {
    id: "inspect_board_state",
    domain: "lessonNotes",
    title: "Inspect the board for one question",
    description:
      "Read what the board actually holds for one question: its question and solution lines, how much is highlighted, how many chip lines are saved, whether those chips still match the written solution, and the class board's saved state if a classId is given. Opening a test is not the same as verifying it — read this before saying a test works.",
    readOnly: true,
    needsConfirmation: false,
    params: [
      p("subsectionId", "string", true, "Session (question) id."),
      p("classId", "string", false, "Class id, to also read that class's saved board state."),
    ],
  },
  {
    id: "edit_highlights",
    domain: "lessonNotes",
    title: "Change which solution lines feed the chips",
    description:
      "Rebuild the highlighting from chosen solution lines only, keeping the mathematics structure of each line intact. The Floating Numbers must then be generated again — say so, never pretend the old chips still match.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("subsectionId", "string", true, "Session (question) id."),
      p("lines", "number[]", false, "1-based solution line numbers to highlight. Omit for all of them."),
    ],
  },
  {
    id: "select_session",
    domain: "lessonNotes",
    title: "Open one session on the board",
    description:
      "Open a single session's board page, so the teacher can see that question's Floating Numbers. To step through a solution aloud, use teach_lesson — that moves the board's active line as you speak.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("subsectionId", "string", true, "Session (question) id.")],
  },
  {

    id: "navigate",
    domain: "navigation",
    title: "Open a page",
    description:
      "Move the teacher's screen to a page in the app so they can see the result of the work.",
    readOnly: true,
    needsConfirmation: false,
    params: [p("path", "string", true, "In-app path starting with '/', e.g. '/teaching-hub/classes'.")],
  },

];

export const AGENT_TOOL_IDS = AGENT_TOOL_MANIFEST.map((t) => t.id);

export function findAgentTool(id: string): AgentToolSpec | undefined {
  return AGENT_TOOL_MANIFEST.find((t) => t.id === id);
}

/** Compact manifest text for the agent's system prompt. */
export function agentManifestPrompt(): string {
  return AGENT_TOOL_MANIFEST.map((t) => {
    const args = t.params
      .map((a) => `${a.name}${a.required ? "" : "?"}: ${a.type} — ${a.description}`)
      .join("; ");
    return `- ${t.id} (${t.domain}${t.readOnly ? ", read-only" : ""}${
      t.needsConfirmation ? ", needs the teacher's confirmation" : ""
    }): ${t.description}${
      args ? ` Args: ${args}` : " No arguments."
    }`;
  }).join("\n");
}

export type AgentJson =
  | string
  | number
  | boolean
  | null
  | AgentJson[]
  | { [key: string]: AgentJson };

export type AgentToolResult =
  | { ok: true; toolId: string; data: AgentJson; summary: string; navigateTo?: string }
  | { ok: false; toolId: string; error: string };
