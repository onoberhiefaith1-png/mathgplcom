// Lesson notes, what "session" really means, Floating Numbers (both stages),
// trying a question out on the Smartboard, handing it to students, and MathGPL
// Live — the heart of teaching.

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
      "add sections from the '+ Section' menu on the ribbon",
      "add a titled session with '＋ Add Session'",
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
      "add the sessions the lesson needs (Example, Exercise, Classwork, Homework)",
      "write the question, then the worked solution as micro-steps",
      "prepare Floating Numbers from that solution",
      "try the question on the Smartboard",
      "assign it to a class",
    ],
    connectedTo: [
      "lesson-sections",
      "floating-preparation",
      "floating-numbers",
      "floating-test",
      "assign-question",
      "smartboard",
      "classes",
      "courses",
      "assignments",
      "slate-game",
    ],
    pitfalls: [
      "The authoring order is fixed: note → session → question → solution as micro-steps → highlight → Generate → try on the Smartboard → assign. Never skip the session.",
      "Mathematics follows the classroom whiteboard standard: one micro-step per line, stacked fractions, no calculator or code syntax.",
      "The teacher's question is immutable — the first line of a solution restates it word for word.",
      "A lesson note is not a slide deck: presenting it is a mode, not a separate document.",
    ],
  },
  {
    id: "lesson-sections",
    title: "Sections and sessions inside a lesson note",
    purpose:
      "A lesson note is divided into sections: Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary, plus a teacher's own titled Session. Every section that carries a question is a session: a numbered heading with its own Solution area beneath it, held together by one stable id. That id is what the Smartboard walks, one session at a time, so 'Next' moves cleanly from question to question and the teacher's board and the student's board are always on the same one. A question typed loosely into ordinary prose has no session, so the board cannot see it at all.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$id",
    firstStep:
      "Inside the open notebook, use the '+ Section' menu on the ribbon to insert the section the lesson needs next — or '＋ Add Session' to give the session your own title.",
    inputs: [
      "the section kind",
      "for a titled session, its title",
      "the question, written inside that session",
      "the solution, written beneath it as micro-steps",
    ],
    actions: [
      "insert a section from '+ Section'",
      "add your own titled session with '＋ Add Session'",
      "add a second one with '+ Add another' on an Example, Exercise, Classwork or Homework",
      "write the question in the session and the solution in its Solution area",
      "let the solution area be generated as micro-steps",
      "highlight parts of a solution to begin Floating Numbers",
    ],
    onSave:
      "The section and its lines are saved inside the notebook, keeping their order, their number and their solution pairing, under the stable id the Smartboard later reads.",
    whereItAppears:
      "On the page of the lesson note, and as the sequence of questions the Smartboard steps through when teaching.",
    nextSteps: [
      "write the solution as micro-steps",
      "prepare Floating Numbers from that solution",
      "add the next session",
    ],
    connectedTo: ["lesson-notes", "floating-preparation", "floating-numbers", "smartboard", "assessments"],
    pitfalls: [
      "Every question must live in its own session. Never write 'Example:' as a plain line of text — insert the Example section so the board can carry it.",
      "'Session' means three different things in MathGPL: a section on a lesson-note page, a plain text session label on the notebook itself, and a scheduled MathGPL Live teaching room. Work out which one the teacher means; never invent a fourth.",
      "Example, Exercise, Classwork, Homework and Assessment always come with a Solution area, and the solution is written out for the teacher too.",
      "Never restructure an existing note into an invented outline; insert the sections the teacher asks for.",
    ],
  },
  {
    id: "floating-preparation",
    title: "Preparing Floating Numbers — highlighting the solution",
    purpose:
      "The first of the two Floating Number stages. The page shows only the written solution, and the teacher drags across it to highlight the parts that should become movable pieces. Each highlight becomes one line; the prose left untouched between them becomes the notebook rows around it. This is why Floating Numbers can never be invented — they are cut out of a solution that is already written.",
    whoUses: ["teacher"],
    entryPath: "/lesson-notes/$notebookId/floating-prep/$subsectionId",
    firstStep:
      "Open the session's Solution in the lesson note and use its Floating chip, which opens this page with that solution's text.",
    inputs: ["a solution already written as micro-steps", "which spans of it become movable pieces"],
    actions: [
      "drag across a span to make a highlight",
      "add as many highlights as the lesson needs, in reading order",
      "undo or redo a highlight",
      "save the highlights",
      "continue to the generation page",
    ],
    onSave:
      "The highlights are saved on that session, along with the notebook rows worked out from the prose around them.",
    whereItAppears:
      "On the Floating Numbers page for the same session, where each highlight becomes a line waiting to be generated.",
    nextSteps: ["open the Floating Numbers page and press Generate", "add a missing highlight first if a step was skipped"],
    connectedTo: ["lesson-notes", "lesson-sections", "floating-numbers", "smartboard"],
    pitfalls: [
      "Nothing can be highlighted until the solution is written — write the micro-steps first.",
      "Highlight whole mathematical steps, not stray words, or the generated line will not hold together.",
      "Highlighting belongs to the session it came from; it is not a separate document.",
    ],
  },
  {
    id: "floating-numbers",
    title: "Floating Numbers — generating the movable pieces",
    purpose:
      "The second stage. Generate turns each highlight into an equation line with its own chips and container shells — fraction, bracket, radical, power, log, integral, matrix, absolute value, vector — so the mathematics can be taken apart and rebuilt on the board while the teacher explains. Lines the teacher has edited by hand are protected and never overwritten.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$notebookId/floating/$subsectionId",
    firstStep:
      "Open the Floating Numbers page for the session and press Generate to turn the highlights into chips.",
    inputs: [
      "the saved highlights from the preparation stage",
      "how the chips should start out: in solution order, or shuffled so students rebuild the line",
      "which container each chip sits inside, if the step needs one",
    ],
    actions: [
      "press Generate to build the lines and their chips",
      "press Shuffle to re-order the chips so they do not start in solution order",
      "drag chips by hand to set the order yourself",
      "edit a line's mathematics directly — your edit is kept",
      "turn on GAME to add timers and a Vault",
      "Save, or Archive to keep an earlier generated set, or Reset to start again",
      "press Test on Smartboard to try it",
    ],
    onSave:
      "The generated lines and the compiled chip set are saved on that session, then read back to confirm they stored correctly.",
    whereItAppears:
      "In the Smartboard's Floating Number panel during a lesson, and wherever the same session is presented — a student moves the very chips the teacher prepared.",
    nextSteps: [
      "press Test on Smartboard and check it behaves",
      "assign the question to a class",
      "prepare the next session's Floating Numbers",
    ],
    connectedTo: [
      "lesson-notes",
      "lesson-sections",
      "floating-preparation",
      "floating-test",
      "assign-question",
      "smartboard",
      "assignments",
      "slate-game",
    ],
    pitfalls: [
      "There is no 'tight' or 'scattered' spacing setting. What the teacher controls is how mixed-up the chips start — solution order or Shuffle — plus manual chip order and which container a chip sits in. Ask it in those words before generating; never offer a setting that does not exist.",
      "Floating Numbers are never objects dropped onto a blank page — they always come from highlighted solution text.",
      "They belong to the session they came from, so they reappear the same way when the lesson is reopened.",
      "Floating Numbers own the mathematics: never re-derive a step outside them.",
    ],
  },
  {
    id: "floating-test",
    title: "Test on Smartboard — the teacher's dry run",
    purpose:
      "Test on Smartboard opens the one question the teacher is preparing on the real student board, scoped to itself. Nothing else is loaded, nothing is saved and no result is recorded — it exists so the teacher sees exactly what a student will see before anybody is given the work.",
    whoUses: ["teacher"],
    entryPath: "/lesson-notes/$notebookId/floating/$subsectionId/test",
    firstStep:
      "On the Floating Numbers page, press Test on Smartboard once the lines are generated and saved.",
    inputs: ["a session whose Floating Numbers have been generated"],
    actions: [
      "read the question line as the student will see it",
      "check every chip is present and can be moved",
      "check fractions, roots and powers are stacked rather than flattened",
      "move the sensor into a fraction, a bracket and an exponent",
      "leave the board and adjust the lines, then test again",
    ],
    onSave: "Nothing is saved and nothing is recorded — it is a sitting the teacher walks away from.",
    whereItAppears:
      "Only on the teacher's own screen, on the same board engine the students use, so what is seen here is what they will get.",
    nextSteps: [
      "fix anything that looked wrong on the Floating Numbers page and test again",
      "assign the question to a class once it behaves",
    ],
    connectedTo: ["floating-numbers", "lesson-notes", "smartboard", "assign-question"],
    pitfalls: [
      "Testing saves nothing and marks nobody — never tell a teacher their students have been given work because a test was opened.",
      "Always offer the test before assigning; a question that has not been tried once is a question nobody has checked.",
      "Save the generated lines first, or the test opens without the latest edits.",
    ],
  },
  {
    id: "assign-question",
    title: "Assigning a question to students",
    purpose:
      "The Assign button on a session's Solution heading hands that question to real students. Unlike the Smartboard test, this is the real thing: it is saved, the class sees it, and the work comes back to be marked.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$id",
    firstStep:
      "On the session's Solution heading, press Assign, then choose the kind of work and tick the classes.",
    inputs: [
      "the session being handed out",
      "the kind of work: Classwork, Homework, Assessment or Practice",
      "the classes it goes to",
      "whether students solve on the board or inside a game",
    ],
    actions: [
      "choose the kind of work",
      "tick the classes that receive it",
      "send it to a game or an Adventure instead of the board",
      "untick a class to take it back, confirming when asked",
    ],
    onSave:
      "The question is handed to every ticked class and recorded, so the students see it and their answers come back to the teacher.",
    whereItAppears:
      "In each ticked class's work for its students, and in that class's report once answers arrive.",
    nextSteps: ["watch the class report as answers come in", "prepare the next session"],
    connectedTo: ["lesson-notes", "lesson-sections", "floating-numbers", "floating-test", "assignments", "assessments", "classes", "reports"],
    pitfalls: [
      "Assigning is real and visible to students — confirm the classes with the teacher before ticking any.",
      "Taking work back from a class asks for confirmation first; never remove it on your own judgement.",
      "Assign after the question has been tried on the Smartboard, not before.",
    ],
  },
  {
    id: "smartboard",
    title: "Smartboard",
    purpose:
      "The board the teacher actually teaches on: the lesson note's mathematics as a live writing surface with a sensor, structural placeholders, Floating Numbers and emoji. It steps through the note session by session, which is why every question needs its own session.",
    whoUses: ["teacher", "student"],
    entryPath: "/teaching-hub/classes/$classId/smartboard",
    firstStep:
      "Open the class's Smartboard, or open the lesson note and present it, then pick the session to teach.",
    inputs: ["the lesson note or class whose board this is", "the session and the line being worked on"],
    actions: [
      "write mathematics with true stacked fractions, roots, exponents and placeholders",
      "move the sensor inside brackets, fractions, exponents and roots",
      "move Floating Numbers while explaining",
      "reveal the next micro-step",
      "step to the next session",
      "mirror the board to students",
      "publish a solved question as a Smart Card",
    ],
    onSave:
      "The board's live state is kept for the class, so reopening it continues the same lesson rather than starting over.",
    whereItAppears:
      "On the teacher's board, on students' screens while the board is shared, and in the same view used for Exercise Cards and assessments.",
    nextSteps: ["teach the next micro-step", "hand the question out with Assign", "build a game from the questions"],
    connectedTo: [
      "lesson-notes",
      "lesson-sections",
      "floating-numbers",
      "floating-test",
      "assign-question",
      "live",
      "assessments",
      "courses",
      "slate-game",
    ],
    pitfalls: [
      "The Smartboard presents the lesson note — it is not a second place to invent mathematics.",
      "The board moves session by session; a question with no session cannot be reached with Next.",
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
