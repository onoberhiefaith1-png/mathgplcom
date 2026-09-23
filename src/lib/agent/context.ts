// Where the teacher is standing right now.
//
// Aura used to be blind to this: she had to ask the database what existed and
// still had no idea which page, class, lesson or board was open in front of the
// person talking to her. This module turns the current address — plus whatever
// the open screen chooses to tell us — into a short, plain description that
// travels with every turn, and picks the workflows worth spelling out.

import { knowledgeDetailPrompt, knowledgeIndexPrompt, NAMING_TRUTHS } from "./knowledge";
import { knowledgeForPath } from "./knowledge/select";

export type AuraPlatformContext = {
  /** The address bar, without the query string. */
  path?: string | null;
  role?: string | null;
  workspaceName?: string | null;
  classId?: string | null;
  className?: string | null;
  notebookId?: string | null;
  notebookTitle?: string | null;
  /** The section of the lesson note open on screen, in the teacher's words. */
  sectionLabel?: string | null;
  subsectionId?: string | null;
  adventureId?: string | null;
  sceneId?: string | null;
  assessmentId?: string | null;
  assignmentId?: string | null;
  slateGameId?: string | null;
  sessionId?: string | null;
  studentId?: string | null;
  studentName?: string | null;
  /** The line being worked on, on a board or a game surface. */
  questionLine?: number | null;
  /** Floating Numbers currently picked up, in the order shown. */
  selectedChips?: string[] | null;
  /** Anything the open screen wants Aura to know, one short line each. */
  notes?: string[] | null;
};

const ID = "([^/?#]+)";

const PATTERNS: { key: keyof AuraPlatformContext; re: RegExp }[] = [
  { key: "classId", re: new RegExp(`/classes?/${ID}`) },
  { key: "notebookId", re: new RegExp(`/lesson-notes?/${ID}`) },
  { key: "subsectionId", re: new RegExp(`/floating/${ID}`) },
  { key: "slateGameId", re: new RegExp(`/game/(?:slate|play)/${ID}`) },
  { key: "adventureId", re: new RegExp(`/adventure/(?:games?|edit|play)/${ID}`) },
  { key: "sceneId", re: new RegExp(`/scenes?/${ID}`) },
  { key: "assessmentId", re: new RegExp(`/assessments?/${ID}`) },
  { key: "assignmentId", re: new RegExp(`/assignments?/${ID}`) },
  { key: "sessionId", re: new RegExp(`/(?:live|sessions?)/${ID}`) },
  { key: "studentId", re: new RegExp(`/students?/${ID}`) },
];

/** Ids we can read straight off the address, so no screen has to report them. */
export function contextFromPath(path: string | null | undefined): AuraPlatformContext {
  const clean = (path ?? "").split(/[?#]/)[0] ?? "";
  const out: AuraPlatformContext = { path: clean };
  for (const { key, re } of PATTERNS) {
    const found = re.exec(clean)?.[1];
    // A trailing word such as "create" or "new" is a page, not an id.
    if (found && !/^(create|new|edit|index)$/i.test(found)) {
      (out as Record<string, unknown>)[key] = found;
    }
  }
  return out;
}

export function mergeContext(
  ...parts: (AuraPlatformContext | null | undefined)[]
): AuraPlatformContext {
  const out: AuraPlatformContext = {};
  for (const part of parts) {
    if (!part) continue;
    for (const [k, v] of Object.entries(part)) {
      if (v === null || v === undefined || v === "") continue;
      if (Array.isArray(v) && v.length === 0) continue;
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

const LABELS: { key: keyof AuraPlatformContext; label: string }[] = [
  { key: "role", label: "Their role" },
  { key: "workspaceName", label: "Active workspace" },
  { key: "className", label: "Class open" },
  { key: "classId", label: "Class id" },
  { key: "notebookTitle", label: "Lesson note open" },
  { key: "notebookId", label: "Lesson note id" },
  { key: "sectionLabel", label: "Section open" },
  { key: "subsectionId", label: "Solution being prepared" },
  { key: "sessionId", label: "Live session" },
  { key: "adventureId", label: "Adventure open" },
  { key: "sceneId", label: "Adventure scene" },
  { key: "assessmentId", label: "Assessment open" },
  { key: "assignmentId", label: "Assignment open" },
  { key: "slateGameId", label: "3D game open" },
  { key: "studentName", label: "Student open" },
  { key: "studentId", label: "Student id" },
  { key: "questionLine", label: "Line being worked on" },
];

/** The "where we are" block, or null when we genuinely know nothing. */
export function contextPrompt(context?: AuraPlatformContext | null): string | null {
  if (!context) return null;
  const lines: string[] = [];
  if (context.path) lines.push(`- Page open: ${context.path}`);
  for (const { key, label } of LABELS) {
    const value = context[key];
    if (value === null || value === undefined || value === "") continue;
    lines.push(`- ${label}: ${String(value)}`);
  }
  if (context.selectedChips?.length) {
    lines.push(`- Floating Numbers picked up: ${context.selectedChips.join(", ")}`);
  }
  for (const note of context.notes ?? []) {
    if (note) lines.push(`- ${note}`);
  }
  if (lines.length === 0) return null;

  return [
    `WHERE THE TEACHER IS RIGHT NOW`,
    ...lines,
    `Use this before asking anything. If they say "this class", "this lesson", "this
question" or "here", they mean what is listed above — do not ask them which one.
Never claim to have done something on a page you have no tool for: say plainly
what you can do, and walk them through the rest step by step from the workflow
below.`,
  ].join("\n");
}

/**
 * The operational map, sized for this turn: every workflow as a one-line index
 * so she never denies a feature exists, and the ones belonging to the open
 * screen written out in full.
 */
export function knowledgePrompt(context?: AuraPlatformContext | null): string {
  const ids = knowledgeForPath(context?.path);
  return [
    `HOW MATHGPL WORKS — EVERY WORKFLOW`,
    knowledgeIndexPrompt(),
    ``,
    NAMING_TRUTHS,
    ``,
    `THE WORKFLOWS FOR THE SCREEN THEY ARE ON`,
    knowledgeDetailPrompt(ids),
    ``,
    `ALWAYS BE ONE STEP AHEAD
- You know what comes after every step, so say it: when something is saved, name
  the next thing worth doing and offer to do it.
- Do the routine mapped steps yourself without asking. Ask only when a real
  choice changes the outcome — which class, which topic, existing video or a new
  one.
- Never invent a workflow, a page or a name. If the real step is on a screen you
  cannot operate, name the screen and the first thing to do there.`,
  ].join("\n");
}
