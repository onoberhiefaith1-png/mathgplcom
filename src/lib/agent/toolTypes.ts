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
        "kind",
        "string",
        false,
        "Block kind for every line: problem, solution, reasoning or text. Default text.",
      ),
    ],
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
    title: "List games",
    description: "List the teacher's 3D Slate games with id, title and topic.",
    readOnly: true,
    needsConfirmation: false,
    params: [],
  },
  {
    id: "link_game_to_class",
    domain: "games",
    title: "Assign a game to a class",
    description: "Add an existing game to a class playlist so the students can play it.",
    readOnly: false,
    needsConfirmation: false,
    params: [
      p("classId", "string", true, "Class id."),
      p("gameId", "string", true, "Game id from list_games."),
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
