// MyGPL Lesson Note Co-Pilot — the action contract.
//
// The Co-Pilot never generates lesson content itself. It proposes ACTIONS, and
// every action maps 1:1 onto a function the Lesson Note already owns (section
// generation, solution generation, Geometry 2D, Geometry Map, Smart Table,
// slides, assets, inline AI edit). This file is the shared vocabulary between
// the panel, the backend and the editor bridge.

export type CoPilotMode = "plan" | "create";

/** One question-bearing block of the note, as the Co-Pilot sees it. */
export interface CoPilotEntry {
  /** Stable reference used by actions ("s1", "s2", …). */
  ref: string;
  heading: string;
  kind: string | null;
  /** Live document position of the heading when the snapshot was taken. */
  pos: number;
  questionText: string;
  solutionText: string;
  hasDiagram: boolean;
  diagramSummary: string;
  /** True when the caret sits inside this block. */
  focused: boolean;
}

export interface CoPilotSnapshot {
  subject: string;
  topic: string;
  activeSubtopic: string;
  sessionTitle: string;
  entries: CoPilotEntry[];
  focusedRef: string | null;
  hasAnyContent: boolean;
  /** Text the teacher has highlighted in the note, when any. */
  selectionText?: string;
  /** Live manifest of workspace tools + asset ids. */
  workspaceManifest?: string;
}

export type CoPilotActionName =
  | "insertSection"
  | "generateQuestion"
  | "regenerateQuestion"
  | "generateSolution"
  | "buildGeometryMap"
  | "openGeometry2D"
  | "openSmartTable"
  | "openSlideCanvas"
  | "openAssetLibrary"
  | "editBlock";

export interface CoPilotAction {
  name: CoPilotActionName;
  /** Teacher-facing step label shown while it runs. */
  label: string;
  /** Entry reference this action applies to, when it targets a block. */
  target?: string | null;
  /** Section kind for insertSection ("example", "exercise", …). */
  sectionKind?: string | null;
  /** Instruction handed to the existing generator / editor. */
  instruction?: string | null;
  /** Replaces or deletes existing content — always confirmed first. */
  destructive?: boolean;
}

export interface CoPilotProposal {
  summary: string;
  preserves: string[];
  steps: string[];
  actions: CoPilotAction[];
}

export interface CoPilotRunStep {
  label: string;
  state: "pending" | "running" | "done" | "failed";
  detail?: string;
}

export interface CoPilotMessage {
  id: string;
  role: "teacher" | "copilot";
  text: string;
  proposal?: CoPilotProposal;
  /** Set once the teacher approves: the live step checklist. */
  run?: CoPilotRunStep[];
  /** Proposal already answered — hides the Approve / Reject buttons. */
  settled?: "approved" | "rejected";
}

/** Everything the panel is allowed to do to the note. Implemented by the
 *  editor as thin wrappers over handlers that already exist. */
export interface CoPilotBridge {
  snapshot: () => CoPilotSnapshot | null;
  insertSection: (kind: string) => Promise<void>;
  /** Insert a section and return the ref of the section just created. */
  insertSectionRef?: (kind: string) => Promise<string | null>;
  /** Insert and activate a real lesson-note subtopic heading. */
  insertSubtopic?: (title: string) => Promise<void>;
  generateQuestion: (ref: string, instruction: string, replace: boolean) => Promise<void>;
  generateSolution: (ref: string, instruction: string) => Promise<void>;
  buildGeometryMap: (ref: string) => Promise<void>;
  openGeometry2D: (ref: string | null) => Promise<void>;
  openSmartTable: () => Promise<void>;
  openSlideCanvas: () => Promise<void>;
  openAssetLibrary: () => Promise<void>;
  editBlock: (ref: string, instruction: string) => Promise<void>;
}


export const ACTION_NAMES: CoPilotActionName[] = [
  "insertSection", "generateQuestion", "regenerateQuestion", "generateSolution",
  "buildGeometryMap", "openGeometry2D", "openSmartTable", "openSlideCanvas",
  "openAssetLibrary", "editBlock",
];

export const isKnownAction = (n: unknown): n is CoPilotActionName =>
  typeof n === "string" && (ACTION_NAMES as string[]).includes(n);

/** Anything that rewrites or replaces existing teacher content. */
export const isDestructive = (a: CoPilotAction): boolean =>
  a.destructive === true || a.name === "regenerateQuestion" || a.name === "editBlock";

const findEntry = (snap: CoPilotSnapshot | null, ref: string | null): CoPilotEntry | null =>
  (ref && snap?.entries.find((e) => e.ref === ref)) || null;

/** Does this action need a specific section of the note? */
const NEEDS_TARGET: CoPilotActionName[] = [
  "generateQuestion", "regenerateQuestion", "generateSolution", "buildGeometryMap", "editBlock",
];

/**
 * Refuse an action before it runs when the note's own state makes it wrong:
 * an unresolved target, a Geometry Map without a solution, a second solution,
 * or a second diagram on a question that already owns one.
 * Returns a teacher-facing reason, or null when the action is safe.
 */
export function validateAction(
  snap: CoPilotSnapshot | null,
  a: CoPilotAction,
): string | null {
  const ref = a.target ?? null;
  if (NEEDS_TARGET.includes(a.name)) {
    if (!ref) return "I could not tell which section of the note that applies to — tell me the heading and I'll do it.";
    if (snap && !findEntry(snap, ref)) {
      return "The section I was aiming at is no longer in the note — tell me the heading you mean.";
    }
  }
  const entry = findEntry(snap, ref);
  if (a.name === "buildGeometryMap") {
    if (entry && !entry.solutionText.trim()) {
      return "A Geometry Map is derived from the solution, and this question has none yet — I'll generate the solution first if you want.";
    }
  }
  if (a.name === "generateSolution" && entry && entry.solutionText.trim()) {
    return "That question already has a solution. I won't add a second one — say \"replace the solution\" if you want it rewritten.";
  }
  if (a.name === "openGeometry2D" && entry?.hasDiagram) {
    return "That question already owns a diagram, so I'll open the one it has rather than make a second one.";
  }
  return null;
}

/** Run one action through the bridge. Unknown names are refused here. */
export async function runCoPilotAction(bridge: CoPilotBridge, a: CoPilotAction): Promise<void> {
  const snap = bridge.snapshot();
  const ref = a.target ?? null;
  if (NEEDS_TARGET.includes(a.name) && !ref) {
    throw new Error("No section of the note was identified for this step.");
  }
  const problem = validateAction(snap, a);
  // A diagram that already exists is reused, not refused.
  if (problem && a.name !== "openGeometry2D") throw new Error(problem);
  switch (a.name) {
    case "insertSection":
      await bridge.insertSection(a.sectionKind || "example");
      return;
    case "generateQuestion":
      await bridge.generateQuestion(ref!, a.instruction ?? "", false);
      return;
    case "regenerateQuestion":
      await bridge.generateQuestion(ref!, a.instruction ?? "", true);
      return;
    case "generateSolution":
      await bridge.generateSolution(ref!, a.instruction ?? "");
      return;
    case "buildGeometryMap":
      await bridge.buildGeometryMap(ref!);
      return;
    case "openGeometry2D":
      await bridge.openGeometry2D(ref);
      return;
    case "openSmartTable":
      await bridge.openSmartTable();
      return;
    case "openSlideCanvas":
      await bridge.openSlideCanvas();
      return;
    case "openAssetLibrary":
      await bridge.openAssetLibrary();
      return;
    case "editBlock":
      await bridge.editBlock(ref!, a.instruction ?? "");
      return;
    default:
      throw new Error("Unsupported action.");
  }
}

