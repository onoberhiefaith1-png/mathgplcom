// Classes, rosters, courses and assignments — the teacher's people and the
// work handed to them.

import type { KnowledgeNode } from "./types";

export const CLASS_NODES: KnowledgeNode[] = [
  {
    id: "classes",
    title: "Classes",
    purpose:
      "A class is a named group of students with its own code, schedule and content. Everything a teacher hands out — lesson notes, courses, assignments, games, Adventures — is given to a class.",
    whoUses: ["teacher", "school admin"],
    entryPath: "/teaching-hub/classes/create",
    firstStep: "Open Create class in the teaching hub and type the class name.",
    inputs: ["class name", "school or venue (optional)", "description (optional)", "schedule (optional)"],
    actions: [
      "create a class",
      "open the class dashboard",
      "copy the join link or the join code",
      "set the schedule and venue",
      "attach lesson notes, courses, assignments, games and Adventures",
    ],
    onSave:
      "The class is created with a class code, and a short join code with an invite link of the form /join/<code>.",
    whereItAppears:
      "In the teacher's class list and on the class dashboard; students see it once they join with the code.",
    nextSteps: ["invite students with the join link", "attach a lesson note", "assign a game or an Adventure"],
    connectedTo: ["roster", "lesson-notes", "courses", "assignments", "smartboard", "reports"],
    pitfalls: [
      "A class code and a join code are two different things: the join code is what a student types.",
      "A class belongs to the workspace that was active when it was created.",
    ],
  },
  {
    id: "roster",
    title: "Students and the roster",
    purpose:
      "The list of students in a class. Students normally add themselves with the join code; a school can also create student accounts directly. It exists so work, marks and reports have someone to belong to.",
    whoUses: ["teacher", "student", "school admin"],
    entryPath: "/teaching-hub/classes/$classId/students",
    firstStep: "Open the class, copy the join link, and send it to the students.",
    inputs: ["the join code or link", "or a student's name and email when a school creates the account"],
    actions: [
      "share the join link or code",
      "approve a join request",
      "see who has joined",
      "remove a student (asks first)",
      "put students into groups for Adventure races",
    ],
    onSave: "The student becomes a member of the class and inherits everything attached to it.",
    whereItAppears:
      "On the class roster for the teacher, and in the student's own class list; their results start appearing in the class report.",
    nextSteps: ["assign work", "open the class report", "create Adventure groups"],
    connectedTo: ["classes", "assignments", "assessments", "reports", "adventures"],
    pitfalls: [
      "Removing a student is destructive — always ask first and only then confirm.",
      "A student joining is not the same as a join request being approved: some classes require approval.",
    ],
  },
  {
    id: "courses",
    title: "Courses and Exercise Cards",
    purpose:
      "A course is a structured set of sections and blocks a class works through. The block type teachers and students actually see is called an Exercise Card, and its questions come from lesson notes.",
    whoUses: ["teacher", "student"],
    entryPath: "/course-builder",
    firstStep: "Open the course builder and create the course, then add a section.",
    inputs: ["course title", "section titles", "blocks inside each section", "for an Exercise Card: which lesson-note questions it uses"],
    actions: [
      "create a course and its sections",
      "add blocks, including Exercise Cards",
      "point an Exercise Card at lesson-note questions",
      "assign the course to a class",
      "watch a class work through it",
    ],
    onSave:
      "The course, its sections and blocks are saved, and each Exercise Card remembers which lesson-note questions it shows.",
    whereItAppears:
      "Under the class's Courses area for the teacher, and in the student's class view; the Exercise Card opens on the same board the Smartboard uses.",
    nextSteps: ["assign the course to a class", "open an Exercise Card to see its questions"],
    connectedTo: ["classes", "lesson-notes", "assessments", "smartboard"],
    pitfalls: [
      "An Exercise Card is a course block, not a quiz — the word 'quiz' does not exist in MathGPL.",
      "Exercise Card questions are references to lesson-note questions, not copies to be retyped.",
    ],
  },
  {
    id: "assignments",
    title: "Assignments",
    purpose:
      "An assignment hands a specific piece of work to a class: chosen questions from a lesson note, in a chosen mode, optionally tied to an Adventure. It exists so work has a deadline and a place to be tracked.",
    whoUses: ["teacher", "student", "parent"],
    entryPath: "/teaching-hub/classes/$classId/assignments",
    firstStep: "Open the class's Assignments area and start a new assignment from a lesson note.",
    inputs: ["the class", "the lesson note", "which questions", "the mode", "a deadline where used"],
    actions: [
      "create an assignment from a lesson note's questions",
      "choose the mode",
      "link it to an Adventure",
      "open the assignment dashboard",
      "follow who has submitted",
    ],
    onSave:
      "The assignment is created for the class and remembers exactly which questions it contains.",
    whereItAppears:
      "On the class's assignment list and dashboard for the teacher, in the student's class view, and in a parent's child view.",
    nextSteps: ["watch the dashboard", "open a student's attempt", "open the class report"],
    connectedTo: ["classes", "lesson-notes", "assessments", "adventures", "reports"],
    pitfalls: [
      "An assignment carries question references from a lesson note — it never contains freshly invented questions.",
      "A student's attempt at an assignment becomes an assessment record; the two are not the same object.",
    ],
  },
];
