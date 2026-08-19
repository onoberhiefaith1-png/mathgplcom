// MathGPL Math Engine — the service contract.
//
// The Engine is the ONLY producer of teacher-facing mathematics. The Co-Pilot
// (application assistant) and the editor never generate mathematics themselves;
// they call one of the named operations below and receive STRUCTURED output
// that can be checked in code before anything reaches the lesson canvas.

export type EngineOperation =
  | "generateLessonSection"
  | "generateExample"
  | "generateClasswork"
  | "generateAssignment"
  | "analyseQuestion"
  | "generateSimilarQuestions"
  | "solveQuestion"
  | "verifySolution"
  | "generateGeometry"
  | "verifyGeometry"
  | "analyseUploadedMaterial"
  | "validateMathematics";

export type CurriculumLevel = "KS3" | "GCSE" | "IGCSE" | "A-level" | "";

/** Difficulty is a REASONING demand, never a digit-size setting. */
export type ReasoningDemand = "single-step" | "multi-step" | "method-choice" | "reverse" | "";

export interface EngineRequest {
  operation: EngineOperation;
  /** Free-form teacher instruction. */
  instruction?: string;
  /** Verbatim question the operation works on (solve / analyse / verify). */
  question?: string;
  solution?: string;
  /** Section being prepared: introduction | explanation | example | … */
  sectionKind?: string;
  topic?: string;
  subtopic?: string;
  level?: CurriculumLevel;
  demand?: ReasoningDemand;
  /** How many questions the operation must return. */
  count?: number;
  /** Method the questions MUST actually require (e.g. "factorisation"). */
  method?: string;
  /** Digest of the lesson session so generation continues it. */
  sessionContext?: string;
  /** Teacher material: typed notes, photos, documents. */
  material?: {
    text?: string;
    images?: string[];
    files?: Array<{ name: string; mime: string; dataUrl: string }>;
  };
  /** Existing geometry scene summary, when a diagram already exists. */
  diagramSummary?: string;
}

/** One question the Engine produced, with everything needed to check it. */
export interface EngineQuestion {
  /** Teacher-facing question text, board-ready. */
  text: string;
  givens: Array<{ symbol: string; value: string; unit?: string }>;
  target: string;
  method: string;
  /** The reasoning demand this question actually carries. */
  demand: ReasoningDemand;
  /** Machine-checkable claim about the mathematics — see verify.ts. */
  claim?: EngineClaim | null;
  /** Step-by-step classroom solution, one micro-step per line. */
  solutionSteps: string[];
  finalAnswer: string;
  diagramRequired: boolean;
  diagramDescription?: string;
  labels?: string[];
}

/**
 * A deterministic claim the Engine makes about a question, so code — not prose
 * — decides whether it is true.
 */
export type EngineClaim =
  | { kind: "factorisable_quadratic"; a: number; b: number; c: number }
  | { kind: "linear_root"; a: number; b: number; root: string }
  | { kind: "quadratic_roots"; a: number; b: number; c: number; roots: string[] }
  | { kind: "arithmetic"; expression: string; value: string }
  | { kind: "none" };

export interface EngineVerification {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

export interface EngineResult {
  operation: EngineOperation;
  /** Short engine-voice narration for the panel (never developer phrasing). */
  narration: string;
  questions: EngineQuestion[];
  /** Structured analysis for analyse* operations. */
  analysis?: {
    level: string;
    method: string;
    style: string;
    progression: string;
    misconceptions: string[];
    brief: string;
  } | null;
  /** Geometry scene in the project's existing 2D scene format. */
  scene?: unknown;
  verification: EngineVerification;
  /** How many regeneration rounds the Engine needed. */
  attempts: number;
}

export class EngineError extends Error {
  operation: EngineOperation;
  problems: string[];
  constructor(operation: EngineOperation, message: string, problems: string[] = []) {
    super(message);
    this.name = "EngineError";
    this.operation = operation;
    this.problems = problems;
  }
}

/** Teacher-facing stage wording. No developer phrasing. */
export const ENGINE_STAGE_LABEL: Record<string, string> = {
  analysing: "Analysing the topic",
  method: "Checking the method",
  building: "Building the example",
  verifying: "Verifying the solution",
  geometry: "Checking the diagram",
  placing: "Adding to the lesson",
};
