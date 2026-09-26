// The lesson-note page itself: what a finished note looks like, the tools along
// the top of it, the assets the `@` picker inserts, and what emojis are for.
//
// Client-safe strings only.

import type { KnowledgeNode } from "./types";

/**
 * The model note. This is what a finished lesson note looks like on the page —
 * nothing else. No line numbers, no internal words, no labels a teacher would
 * never write. Aura copies this shape every time.
 */
export const MODEL_LESSON_NOTE = `WHAT A FINISHED LESSON NOTE LOOKS LIKE ON THE PAGE
This is the model. Copy this shape exactly. Nothing else appears on the page.

  Introduction
  A quadratic equation is a polynomial equation of degree 2. Its standard form is
  ax² + bx + c = 0, where a ≠ 0.
  In this lesson we solve quadratic equations by factorisation.

  Explanation
  If two brackets multiply to give zero, one of them must be zero.
  So we write the equation as a product of two brackets, then set each bracket to zero.

  Example 1
  Solve x² + 5x + 6 = 0

  Solution            [Floating Number]  [Assign]
  x² + 5x + 6 = 0
  x² + 2x + 3x + 6 = 0
  x(x + 2) + 3(x + 2) = 0
  (x + 2)(x + 3) = 0
  x + 2 = 0  or  x + 3 = 0
  x = −2  or  x = −3

  Example 2
  Solve 2x² + 5x − 3 = 0

  Solution            [Floating Number]  [Assign]
  2x² + 5x − 3 = 0
  2x² + 6x − x − 3 = 0
  2x(x + 3) − 1(x + 3) = 0
  (x + 3)(2x − 1) = 0
  x + 3 = 0  or  2x − 1 = 0
  x = −3  or  x = 1/2

  Classwork 1
  Solve x² − 7x + 12 = 0

  Solution            [Floating Number]  [Assign]
  ... the micro-steps, the same way ...

HOW THE SOLUTION HEADING READS
- "Solution" is the bold word. It is the heading of the solution.
- Beside it, small and quiet, sit two links: "Floating Number" and "Assign".
  They are not headings, not sections, and never text you type into the note.
  Floating Number opens the highlighting page and then the generating page.
  Assign hands the question, its solution and its chips to a class.
- Under the heading come the micro-step lines and nothing else.

NEVER PUT THESE ON THE PAGE
- "Problem:", "Question:", "Step 1:", "Line 1:", numbered lines.
- A "Solution:" label stamped above every line — one Solution heading per question.
- Internal words: chips, bucket, tokens, shuffled bucket, verified, session id,
  QUESTION_LOCK, micro-step, subsection.
- A repeated section kind in the heading: the heading is "Example 1", never
  "Example: Example 1".
- Commentary between the steps. The mathematics speaks for itself.
- The word "Assignment" as a session heading. Work a class takes home is headed
  "Homework"; work that is marked is headed "Assessment".`;

export const EDITOR_NODES: KnowledgeNode[] = [
  {
    id: "lesson-note-page",
    title: "What a finished lesson note looks like",
    purpose:
      "A lesson note reads like a teacher's own exercise book: Introduction, Explanation, then each worked question as its own session — the heading (Example 1), the question under it, then the bold word Solution with the clean steps beneath. Beside that Solution heading sit two small links, Floating Number and Assign. Nothing else belongs on the page.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$id",
    firstStep: "Write the Introduction and the Explanation as plain prose, then add the first Example session.",
    inputs: ["the topic", "the questions", "the worked steps"],
    actions: [
      "write Introduction and Explanation prose",
      "add each Example, Exercise, Classwork, Homework or Assessment as its own session — those are the only session names; never head a session 'Assignment'",
      "write the question inside the session",
      "write the solution beneath it, one micro-step per line",
      "open Floating Number from the Solution heading",
      "open Assign from the Solution heading",
    ],
    onSave: "The note reads on the page exactly as it will be taught and exactly as a student would copy it.",
    whereItAppears: "On the lesson-note page, and session by session on the Smartboard.",
    nextSteps: ["highlight the solution", "generate the Floating Numbers", "try it on the board", "assign it"],
    connectedTo: ["lesson-notes", "lesson-sections", "floating-preparation", "assign-question", "smartboard"],
    pitfalls: [
      "Solution is the bold heading; Floating Number and Assign are the two small links beside it. Never write them as headings or as body text.",
      "Never print 'Problem:', 'Question:', 'Step 1:' or line numbers on the page.",
      "One Solution heading per question — never a 'Solution:' label on every line.",
      "Never write internal words on the page: chips, bucket, tokens, verified, session id, subsection.",
      "The heading is 'Example 1'. Never 'Example: Example 1'.",
      "No commentary between the steps: heading, question, Solution, clean lines.",
    ],
  },
  {
    id: "lesson-note-toolbar",
    title: "The tools along the top of the lesson-note page",
    purpose:
      "The ribbon above the page holds everything a teacher reaches for while writing: structure, mathematics, pictures, tables, graphs, and the ways out of the note (export, scan, present).",
    whoUses: ["teacher"],
    entryPath: "/lesson-notes/$id",
    firstStep: "Open the note and read the ribbon left to right; each control does one thing.",
    inputs: ["an open lesson note"],
    actions: [
      "Undo / Redo — step back or forward",
      "Note Extend / Note Shrink — make the page taller or shorter",
      "Asset Library — saved objects to drop in",
      "Section — insert Introduction, Explanation, Example, Exercise, Classwork, Homework, Summary",
      "＋ Add Session — a session with your own title; ＋ Add Subtopic — a new subtopic inside the note",
      "Diagram — 2D draws geometry on the page; 3D opens the solid-shapes workspace",
      "Smart Table — a table whose cells calculate; Maths Table — logs, antilogs, sines and the rest",
      "Graph — a graph object on the page; Calc — the calculator; Conversion — unit conversion",
      "Σ insert maths — fractions, roots, powers and placeholders as real stacked objects",
      "AI — write or extend part of the note",
      "Symbols — the symbol panel; Matrix — matrices; Slides — the slide panel",
      "Emoji — the emoji panel",
      "paper size and paper style, and zoom",
      "Export — Word or PDF; Scan from phone; Present on Smartboard",
    ],
    onSave: "Whatever is inserted becomes part of the note and is saved with it.",
    whereItAppears: "On the page, and on the Smartboard when the note is presented.",
    nextSteps: ["insert the section the lesson needs next", "insert a diagram where the question needs one"],
    connectedTo: ["lesson-note-page", "lesson-note-assets", "lesson-notes", "smartboard"],
    pitfalls: [
      "Maths is written with the Σ structures, never as slashes, carets or LaTeX.",
      "Diagram 2D and Diagram 3D are two different modes of the same button; say which one you mean.",
      "Present on Smartboard shows the note; it is not a second place to invent mathematics.",
      "Export produces a Word or PDF copy — it changes nothing in the note.",
    ],
  },
  {
    id: "lesson-note-assets",
    title: "Diagrams, tables, graphs and the @ picker",
    purpose:
      "Typing @ in the note opens the asset picker: every insertable object by name, searchable. It covers symbols, elastic maths structures, diagrams, graphs, tables, manipulatives, measurement instruments and real-world objects — so a question that needs a picture gets a real object, never a description of one.",
    whoUses: ["teacher"],
    entryPath: "/lesson-notes/$id",
    firstStep: "Type @ where the object belongs, then the name of what you want.",
    inputs: ["where in the note it goes", "which object"],
    actions: [
      "structures: fraction, sqrt, nthroot, power, subscript",
      "shapes: triangle, rectangle, square, circle, parallelogram, trapezium, rhombus, polygon, pentagon, hexagon",
      "graphs and charts: coordinategraph, linechart, barchart, histogram, piechart, scatter, numberline",
      "measurement: ruler, protractor, compass",
      "tables, Venn diagram, manipulatives and real-world objects",
      "search by name when unsure — the picker matches loosely",
    ],
    onSave: "The object is inserted into the note as a real editable object and saved with it.",
    whereItAppears: "On the page and on the Smartboard, with all its settings in the right-hand panel.",
    nextSteps: ["set the object up in the right-hand Properties panel", "write the question that uses it"],
    connectedTo: ["lesson-note-toolbar", "lesson-note-page", "smartboard"],
    pitfalls: [
      "Every setting for an inserted object lives in the right-hand Properties panel — there are no floating popovers.",
      "A geometry figure never shows measured values it was not given.",
      "Insert the object where the question needs it; do not describe a diagram in words instead.",
    ],
  },
  {
    id: "lesson-note-emojis",
    title: "Emojis in a lesson note",
    purpose:
      "Emojis are a teacher's margin marks: a small ⚠ beside a caution, a 💡 beside a rule worth remembering, a friendly face for a younger class. They carry tone, not mathematics.",
    whoUses: ["teacher", "student"],
    entryPath: "/lesson-notes/$id",
    firstStep: "Open the Emoji panel from the ribbon and place one beside the line it belongs to.",
    inputs: ["the line it marks", "which emoji"],
    actions: ["mark a caution", "mark a rule to remember", "warm up an introduction for a young class"],
    onSave: "The emoji is saved as part of that line of the note.",
    whereItAppears: "On the page and on the Smartboard, exactly where it was placed.",
    nextSteps: ["carry on writing the lesson"],
    connectedTo: ["lesson-note-toolbar", "lesson-note-page", "smartboard"],
    pitfalls: [
      "Never put an emoji inside a solution line: that line is read as mathematics.",
      "Sparingly — one where it means something, never sprinkled through the note.",
      "An emoji never replaces a step, a word of explanation or a unit.",
    ],
  },
];
