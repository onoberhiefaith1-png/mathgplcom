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

/** Run one action through the bridge. Unknown names are refused here. */
export async function runCoPilotAction(bridge: CoPilotBridge, a: CoPilotAction): Promise<void> {
  const ref = a.target ?? bridge.snapshot()?.focusedRef ?? null;
  switch (a.name) {
    case "insertSection":
      await bridge.insertSection(a.sectionKind || "example");
      return;
    case "generateQuestion":
      if (!ref) throw new Error("No section was identified for this step.");
      await bridge.generateQuestion(ref, a.instruction ?? "", false);
      return;
    case "regenerateQuestion":
      if (!ref) throw new Error("No section was identified for this step.");
      await bridge.generateQuestion(ref, a.instruction ?? "", true);
      return;
    case "generateSolution":
      if (!ref) throw new Error("No question was identified for this step.");
      await bridge.generateSolution(ref, a.instruction ?? "");
      return;
    case "buildGeometryMap":
      if (!ref) throw new Error("No question was identified for this step.");
      await bridge.buildGeometryMap(ref);
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
      if (!ref) throw new Error("No block was identified for this step.");
      await bridge.editBlock(ref, a.instruction ?? "");
      return;
    default:
      throw new Error("Unsupported action.");
  }
}
