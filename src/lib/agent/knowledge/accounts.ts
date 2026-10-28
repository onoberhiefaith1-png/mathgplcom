// Accounts, workspaces and the rotating building — how a person gets into
// MathGPL and where they land.

import type { KnowledgeNode } from "./types";

export const ACCOUNT_NODES: KnowledgeNode[] = [
  {
    id: "accounts",
    title: "Accounts and roles",
    purpose:
      "One identity per person, with a role that decides what they can do: teacher, student, parent, school and platform owner. It exists so a teacher, their school and their students can share the same platform without seeing each other's private work.",
    whoUses: ["teacher", "student", "parent", "school admin", "platform owner"],
    entryPath: "/auth",
    firstStep:
      "Choose the kind of account on the account chooser, then sign in or sign up on that role's own page.",
    inputs: ["email", "password", "full name on sign-up", "role"],
    actions: [
      "sign in or sign up per role",
      "sign in with Google",
      "recover a password",
      "see the person's MathGPL ID",
    ],
    onSave:
      "The person gets a profile, a role record and a MathGPL ID. A school or parent account also gets an organisation they own.",
    whereItAppears:
      "Straight after sign-in they land on the rotating building homepage, and the Account menu shows their name and role.",
    nextSteps: [
      "open the workspace for the role",
      "for a teacher: create the first class",
      "for a student: join a class with a code",
    ],
    connectedTo: ["workspaces", "building", "classes"],
    pitfalls: [
      "Every account lands on the rotating building homepage first — never on a dashboard.",
      "A role is never stored on the profile; capabilities come from the role record.",
      "One identity can belong to several workspaces; switching workspace never moves data.",
    ],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    purpose:
      "A workspace is whose work you are looking at: your own teaching workspace, a school's, or a family's. It exists so the same teacher can teach privately and for a school without mixing rosters or notes.",
    whoUses: ["teacher", "school admin", "parent"],
    entryPath: "/home",
    firstStep:
      "Open the Account menu and pick the workspace, or arrive through the building for the workspace you want.",
    inputs: ["the workspace to become active"],
    actions: [
      "switch the active workspace",
      "see which classes, notes and buildings belong to it",
      "invite or accept a school invitation",
    ],
    onSave: "The active workspace is remembered on the profile and every list re-scopes to it.",
    whereItAppears:
      "Class lists, lesson notes, buildings and the Community listing all follow the active workspace.",
    nextSteps: ["open the teaching hub", "create or open a class"],
    connectedTo: ["accounts", "classes", "building", "community"],
    pitfalls: [
      "Switching workspace never moves or copies anything — it changes what is shown.",
      "A class created in one workspace does not appear in another.",
    ],
  },
  {
    id: "building",
    title: "Rotating building homepage",
    purpose:
      "The 3D building every account lands on. Its rooms are doors into the platform, and the teacher can redesign it. It exists so students meet a place, not a dashboard.",
    whoUses: ["teacher", "student", "school admin"],
    entryPath: "/buildings",
    firstStep: "Open the buildings gallery and pick or replace the building for this account.",
    inputs: ["a building to use or fork", "which room slot to fill", "what each screen in a room shows"],
    actions: [
      "replace the whole building",
      "fill a numbered room slot",
      "place a screen on a room wall and point it at a page",
      "lock a room",
      "change the background layer separately from the building",
    ],
    onSave:
      "The building, its rooms, its screens and their links are saved for this account, including which page each screen opens.",
    whereItAppears:
      "Everyone who arrives at this account's homepage sees the same building, and a student who clicks a screen is taken to the page behind it.",
    nextSteps: ["point a room screen at a class, a lesson note or a game", "open the teaching hub"],
    connectedTo: ["accounts", "workspaces", "classes", "slate-game"],
    pitfalls: [
      "Background and building are two separate layers — changing one never changes the other.",
      "Rooms are numbered slots; a screen belongs to a room, not to the building as a whole.",
    ],
  },
];
