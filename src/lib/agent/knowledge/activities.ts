// Assessments, Adventures, the 3D Slate Game, reports, community, settings.

import type { KnowledgeNode } from "./types";

export const ACTIVITY_NODES: KnowledgeNode[] = [
  {
    id: "assessments",
    title: "Assessments",
    purpose:
      "A student's attempt at set questions, marked and timed. This is MathGPL's real name for what other systems call a quiz or test; inside a course, the same content is handed out as an Exercise Card.",
    whoUses: ["teacher", "student", "parent", "school admin"],
    entryPath: "/teaching-hub/classes/$classId/assessments/$assessmentId/student/$studentId",
    firstStep:
      "Hand out work from a lesson note as an assignment; a student's attempt becomes the assessment you open.",
    inputs: ["the class", "the lesson note and its section", "the questions", "total marks", "whether the timer is on"],
    actions: [
      "open a student's attempt",
      "see their working on the board exactly as they wrote it",
      "mark against the answer key",
      "see the time taken per attempt",
      "record the achievement",
    ],
    onSave:
      "Marks, progress and timing are recorded for that student and question, and the achievement colour is kept.",
    whereItAppears:
      "In the class report, in the student's own progress, and in a parent's or school's view of that student.",
    nextSteps: ["open the class report", "assign a targeted follow-up", "build a game from the questions they missed"],
    connectedTo: ["assignments", "lesson-notes", "courses", "reports", "smartboard"],
    pitfalls: [
      "'Quiz' is not a MathGPL word: say Assessment, or Exercise Card inside a course.",
      "Every question shown in an assessment comes from a lesson note — never from newly invented mathematics.",
      "A student's working is shown on the same board the teacher uses, so it is read, not retyped.",
    ],
  },
  {
    id: "adventures",
    title: "Adventures",
    purpose:
      "A journey a class travels through: scenes and checkpoints, questions from a lesson note placed on a progress bar, video moments, rewards and team groups racing each other. It exists to turn a syllabus into something students want to finish.",
    whoUses: ["teacher", "student"],
    entryPath: "/adventure/games",
    firstStep: "Open Adventures and create the Adventure, giving it a name and its topic.",
    inputs: [
      "name, topic and subtopic",
      "the scenes and what happens in each",
      "checkpoints on the timeline",
      "a video, and which part of it to use",
      "the lesson-note questions placed on the progress bar",
      "rewards",
      "the class and its groups",
    ],
    actions: [
      "create the Adventure",
      "add scenes and lay them out",
      "place checkpoints on the timeline",
      "use an existing video or upload one, then choose the section of it that plays",
      "set what happens at a checkpoint and the visual that marks it",
      "put lesson-note questions on the progress bar",
      "configure rewards and narration",
      "assign it to a class and build groups",
      "watch the dashboard while a class plays",
    ],
    onSave:
      "The Adventure, its scenes, its checkpoint questions and its video timing are saved, and the class link makes it playable.",
    whereItAppears:
      "In the teacher's Adventure list and class dashboard, and in the students' class view, where groups race on the Time bar and the Learning bar.",
    nextSteps: ["assign it to a class", "create the groups", "watch the group standings"],
    connectedTo: ["classes", "lesson-notes", "assignments", "reports", "slate-game"],
    pitfalls: [
      "Adventure questions come from lesson notes — the Adventure never becomes a second question source.",
      "A video is configured by choosing the portion of its timeline that plays at a checkpoint; ask whether to use an existing video or upload a new one before anything else.",
      "There are two progress bars, a fixed Time bar and a Learning bar, and group qualification depends on them.",
    ],
  },
  {
    id: "slate-game",
    title: "3D Slate Game",
    purpose:
      "A physical 3D room where a student solves a question by writing on real writing surfaces, with timers, lives, vaults and rewards. It exists so practice feels like a place rather than a worksheet.",
    whoUses: ["teacher", "student"],
    entryPath: "/game/slate/$gameId",
    firstStep:
      "Open the game editor for the class's game and set the question, then the writing surfaces below it.",
    inputs: ["the room and surfaces", "the question", "the writing lines", "timer, lives and reward settings", "the class it is assigned to"],
    actions: [
      "choose the room, surface and background",
      "place the question on the read-only top surface",
      "add playable writing lines",
      "position and size the text, then Save to fix it",
      "restore text to its saved configuration",
      "set the Hourglass, Lives and Vault rewards",
      "assign the game to a class and watch results",
    ],
    onSave:
      "The room, the surfaces, the text configuration and the reward settings are saved as the teacher's design and are what every student then sees.",
    whereItAppears:
      "In the class's game playlist for students, and in the teacher's game list; results come back per student.",
    nextSteps: ["assign the game to a class", "play it once as the teacher", "check the results"],
    connectedTo: ["classes", "lesson-notes", "assignments", "reports", "adventures"],
    pitfalls: [
      "The top surface is the question and is read-only; solving starts on the first writing line.",
      "Position and size text first and then Save — saving is what fixes the master configuration.",
      "Play must match Edit, and Floating Numbers own the mathematics and the question timing.",
      "Resetting a run never touches the teacher's design.",
    ],
  },
  {
    id: "reports",
    title: "Progress and reports",
    purpose:
      "What the class and each student have actually achieved: marks, speed, topic breakdown and trends over time. It exists so the next lesson is chosen from evidence.",
    whoUses: ["teacher", "parent", "school admin"],
    entryPath: "/teaching-hub/classes/$classId/report",
    firstStep: "Open the class's Report and start with the class overview.",
    inputs: ["the class", "optionally a single student", "optionally a topic"],
    actions: [
      "read the class overview",
      "open one student's report",
      "see the topic breakdown",
      "see speed performance",
      "follow the trend over time",
    ],
    onSave: "Nothing is created here — reports read what assessments, games and Adventures recorded.",
    whereItAppears: "For the teacher on the class report, for a parent on their child, and for a school on its students.",
    nextSteps: ["assign a targeted follow-up on the weak step", "build a game or Adventure on that topic"],
    connectedTo: ["assessments", "assignments", "roster", "slate-game", "adventures"],
    pitfalls: [
      "Reports are read-only: never describe changing a mark from here.",
      "A weak result points back to the lesson-note line the student stumbled on.",
    ],
  },
  {
    id: "community",
    title: "MathGPL Community",
    purpose:
      "A read-only window on other teachers' shared work: lesson notes, courses and Adventures that can be copied into your own workspace, and classes that can be requested.",
    whoUses: ["teacher", "school admin"],
    entryPath: "/community",
    firstStep: "Open Community and find the lesson note, course or Adventure you want.",
    inputs: ["what to publish, or what to copy"],
    actions: ["browse shared work", "copy something into your workspace", "publish your own", "request access to a shared class"],
    onSave: "A copy lands in your workspace as your own; publishing makes yours visible to others.",
    whereItAppears: "In your lesson-note, course or Adventure lists after copying; in Community after publishing.",
    nextSteps: ["edit the copy for your class", "attach it to a class"],
    connectedTo: ["lesson-notes", "courses", "adventures", "workspaces"],
    pitfalls: [
      "Community is a mirror: editing happens on your copy, never on the original.",
      "Copying never moves the other teacher's work.",
    ],
  },
  {
    id: "settings",
    title: "Settings",
    purpose:
      "Where the teacher's own preferences live: teaching hub settings, the archive of put-away work, background sound, and per-session settings for a Live room.",
    whoUses: ["teacher", "school admin"],
    entryPath: "/teaching-hub/settings",
    firstStep: "Open Settings from the teaching hub.",
    inputs: ["the preference being changed"],
    actions: ["change teaching preferences", "open the archive", "set background sound", "change a Live session's settings"],
    onSave: "The preference is saved for this account and applies the next time the surface is opened.",
    whereItAppears: "Wherever that preference takes effect — the board, the hub or a Live room.",
    nextSteps: ["go back to the class or lesson being worked on"],
    connectedTo: ["workspaces", "live", "smartboard"],
    pitfalls: [
      "Archiving a lesson note is destructive enough to need the teacher's yes first.",
      "Background sound in a game and reward sounds are separate settings.",
    ],
  },
];
