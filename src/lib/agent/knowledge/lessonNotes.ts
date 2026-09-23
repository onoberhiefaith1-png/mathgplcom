// Lesson notes, what "session" really means, Floating Numbers, the Smartboard
// and MathGPL Live — the heart of teaching.

import type { KnowledgeNode } from "./types";

export const LESSON_NODES: KnowledgeNode[] = [
  {
    id: "lesson-notes",
    title: "Lesson notes",
    purpose:
      "A lesson note is the teacher's written lesson: a notebook made of sections, each section holding the lines a teacher would write on a board. It is the source of everything else — the Smartboard, Exercise Cards, assignments, games and Adventures all read from it.",
    whoUses: ["teacher", "student", "school admin"],
    entryPath: "/lesson-notes",
    firstStep:
      "Open Lesson notes and create a notebook, giving it a title, subject and subtopic.",
    inputs: ["title", "subject", "subtopic", "the class it is written for (optional)", "the session label (optional)"],
    actions: [
      "create a notebook",
      "add sections",
      "write content lines into a section",
      "generate a cover",
      "attach the note to a class",
      "present it on the Smartboard",
      "export it",
    ],
    onSave:
      "The notebook, its sections and every content line are saved, and the note appears in the teacher's lesson-note list.",
    whereItAppears:
      "In the teacher's lesson-note list; once attached to a class, in that class's lesson notes for its students.",
    nextSteps: [
      "add the sections the lesson needs",
      "write the worked solution as micro-steps",
      "prepare Floating Numbers from a solution",
      "attach the note to a class",
      "present it on the Smartboard",
    ],
    connectedTo: ["lesson-sections", "floating-numbers", "smartboard", "classes", "courses", "assignments", "slate-game"],
    pitfalls: [
      "Mathematics follows the classroom whiteboard standard: one micro-step per line, stacked fractions, no calculator or code syntax.",
      "The teacher's question is immutable — the first line of a solution restates it word for word.",
      "A lesson note is not a slide deck: presenting it is a mode, not a separate document.",
    ],
  },
  {
    id: "lesson-sections",
    title: "Sections and sessions inside a lesson note",
    purpose:
      "A lesson note is divided into sections: Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary — and a custom section that is simply labelled 'Session'. Sections are how a lesson is broken into the parts a teacher teaches in order.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$id",
    firstStep:
      "Inside the open notebook, use the Section menu to insert the section the lesson needs next.",
    inputs: ["the section kind", "the content lines", "for question sections, the question and its solution"],
    actions: [
      "insert a section",
      "write questions and solutions in it",
      "move an object or frame within it",
      "let the solution area be generated as micro-steps",
      "highlight parts of a solution for Floating Numbers",
    ],
    onSave:
      "The section and its lines are saved inside the notebook, keeping their order and their solution pairing.",
    whereItAppears:
      "On the page of the lesson note, and in the order the Smartboard presents when teaching.",
    nextSteps: ["write the next section", "prepare Floating Numbers", "present on the Smartboard"],
    connectedTo: ["lesson-notes", "floating-numbers", "smartboard", "assessments"],
    pitfalls: [
      "'Session' means three different things in MathGPL: a section on a lesson-note page (a custom section is literally labelled Session), a plain text session label on the notebook itself, and a scheduled MathGPL Live teaching room. Work out which one the teacher means — never invent a fourth.",
      "Sections that carry questions (Example, Exercise, Classwork, Homework, Assessment) always come with a solution area, and the solution is written for the teacher too.",
      "Never restructure an existing note into an invented outline; insert the sections the teacher asks for.",
    ],
  },
  {
    id: "floating-numbers",
    title: "Floating Numbers",
    purpose:
      "Floating Numbers are the movable pieces of a solution. They are made by highlighting parts of a worked solution inside a lesson note, which compiles those parts into chips that can be rearranged, dropped into fractions, brackets or matrices, and moved on the board while teaching.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$notebookId/floating/$subsectionId",
    firstStep:
      "Open an Example, Exercise or Classwork solution in the lesson note and start Floating Number preparation for it.",
    inputs: ["a written solution to highlight", "which fragments become chips", "the order the chips sit in", "which containers a chip belongs inside"],
    actions: [
      "highlight solution fragments",
      "compile them into chips",
      "set the order of the chips on a line",
      "put a chip inside a structure such as a fraction, bracket or matrix",
      "undo back to an earlier arrangement",
      "save and reopen the prepared lines",
    ],
    onSave:
      "The prepared lines and the compiled chip set are saved on that part of the lesson note, then read back to confirm they stored correctly.",
    whereItAppears:
      "In the Smartboard's Floating Number panel during a live lesson, and wherever the same solution is presented — a student moves the same chips the teacher prepared.",
    nextSteps: ["present the lesson on the Smartboard and move the chips while explaining", "assign the questions"],
    connectedTo: ["lesson-notes", "lesson-sections", "smartboard", "assignments", "slate-game"],
    pitfalls: [
      "Floating Numbers are never objects dropped onto a blank page — they always come from highlighting an existing solution.",
      "They belong to the solution they came from, so they reappear the same way when the lesson is reopened.",
      "Floating Numbers own the mathematics: never re-derive a step outside them.",
    ],
  },
  {
    id: "smartboard",
    title: "Smartboard",
    purpose:
      "The board the teacher actually teaches on: the lesson note's mathematics as a live writing surface with a sensor, structural placeholders, Floating Numbers and emoji. It exists so the lesson is taught, not just displayed.",
    whoUses: ["teacher", "student"],
    entryPath: "/teaching-hub/classes/$classId/smartboard",
    firstStep:
      "Open the class's Smartboard, or open the lesson note and present it, then pick the section to teach.",
    inputs: ["the lesson note or class whose board this is", "the question or line being worked on"],
    actions: [
      "write mathematics with true stacked fractions, roots, exponents and placeholders",
      "move the sensor inside brackets, fractions, exponents and roots",
      "move Floating Numbers while explaining",
      "reveal the next micro-step",
      "mirror the board to students",
      "publish a solved question as a Smart Card",
    ],
    onSave:
      "The board's live state is kept for the class, so reopening it continues the same lesson rather than starting over.",
    whereItAppears:
      "On the teacher's board, on students' screens while the board is shared, and in the same view used for Exercise Cards and assessments.",
    nextSteps: ["teach the next micro-step", "hand the questions out as an assignment", "build a game from the questions"],
    connectedTo: ["lesson-notes", "floating-numbers", "live", "assessments", "courses", "slate-game"],
    pitfalls: [
      "The Smartboard presents the lesson note — it is not a second place to invent mathematics.",
      "Structure is never flattened into slashes, carets or underscores; fractions are stacked objects with placeholders.",
      "What the student sees must match what the teacher sees.",
    ],
  },
  {
    id: "live",
    title: "MathGPL Live sessions",
    purpose:
      "A scheduled online teaching room with its own code, tied to a class and optionally to a lesson note. This — not a lesson-note section — is what 'session' means when a teacher is talking about teaching online at a time.",
    whoUses: ["teacher", "student"],
    entryPath: "/live/sessions",
    firstStep: "Open Live sessions and create a session, choosing the class and the time.",
    inputs: ["the class", "the schedule", "the lesson note to teach (optional)", "whether free entry is allowed"],
    actions: [
      "create or schedule a session",
      "share the session code",
      "go live",
      "teach on the session's board",
      "let students join as audience",
    ],
    onSave: "The session is created with a session code and a schedule, and can be opened live when the time comes.",
    whereItAppears:
      "In the teacher's session list and on the students' side once they have the code; the session's board is the Smartboard for that room.",
    nextSteps: ["open the session board", "teach the lesson note", "publish a Smart Card from a solved question"],
    connectedTo: ["classes", "lesson-notes", "smartboard", "assessments"],
    pitfalls: [
      "A Live session is a room with a code and a time — not a section inside a lesson note.",
      "Going live never rewrites the lesson note being taught.",
    ],
  },
];
