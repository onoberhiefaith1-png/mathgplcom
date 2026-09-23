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
    return `- ${t.id} (${t.domain}${t.readOnly ? ", read-only" : ""}): ${t.description}${
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
