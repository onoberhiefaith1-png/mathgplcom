// AI Question Generation Pipeline — shared types.
//
// The generator is NOT a chatbot. It works in named stages:
//   material → blueprint → question → diagram → solution → validation
// Every stage is explicit so a failure can be reported by name instead of a
// bare "AI failed", and so no stage assumes the previous one produced an
// object.

export type StageId =
  | "EMPTY"
  | "INPUT_RECEIVED"
  | "ANALYSING"
  | "BLUEPRINT_READY"
  | "GENERATING_QUESTION"
  | "GENERATING_DIAGRAM"
  | "GENERATING_SOLUTION"
  | "VALIDATING"
  | "READY"
  | "ERROR";

/** Teacher-facing progress wording for each stage. */
export const STAGE_LABEL: Record<StageId, string> = {
  EMPTY: "",
  INPUT_RECEIVED: "Reading your material…",
  ANALYSING: "Understanding material…",
  BLUEPRINT_READY: "Material understood",
  GENERATING_QUESTION: "Building question…",
  GENERATING_DIAGRAM: "Creating diagram…",
  GENERATING_SOLUTION: "Solving…",
  VALIDATING: "Checking…",
  READY: "Ready",
  ERROR: "Stopped",
};

/** Named failure: carries the stage that failed so the UI can say which. */
export class StageError extends Error {
  stage: StageId;
  constructor(stage: StageId, message: string) {
    super(message);
    this.name = "StageError";
    this.stage = stage;
  }
}

export const STAGE_FAILURE_TITLE: Partial<Record<StageId, string>> = {
  ANALYSING: "Could not read the material",
  GENERATING_QUESTION: "Question generation failed",
  GENERATING_DIAGRAM: "Diagram generation failed",
  GENERATING_SOLUTION: "Solution generation failed",
  VALIDATING: "Validation failed",
};

/** A non-image document the teacher attached (PDF / Word / other). */
export interface MaterialFile {
  name: string;
  mime: string;
  /** data:<mime>;base64,… */
  dataUrl: string;
}

/** Everything the teacher supplied, from any input source. */
export interface Material {
  /** Typed instruction + any voice transcription (voice is not a separate route). */
  text: string;
  /** base64 data URLs of photos / screenshots. */
  images: string[];
  files: MaterialFile[];
}

export type ReuseMode = "reproduce" | "modify" | "similar";
export type Difficulty = "easy" | "medium" | "hard" | "very_hard";

/** The Add Context strip. Blank fields simply mean "no constraint". */
export interface TeacherContext {
  topic: string;
  subtopic: string;
  level: string;
  difficulty: Difficulty | "";
  count: number;
  diagramRequired: boolean | null;
  reuse: ReuseMode | "";
  /** Free-form extra instruction typed in the context strip. */
  notes: string;
}

export const EMPTY_TEACHER_CONTEXT: TeacherContext = {
  topic: "",
  subtopic: "",
  level: "",
  difficulty: "",
  count: 1,
  diagramRequired: null,
  reuse: "",
  notes: "",
};

export const hasTeacherContext = (c: TeacherContext | undefined | null): boolean =>
  !!c &&
  Boolean(
    c.topic.trim() || c.subtopic.trim() || c.level.trim() || c.difficulty ||
    c.reuse || c.notes.trim() || c.diagramRequired !== null || c.count > 1,
  );

/** Structured understanding of the request, produced BEFORE generation. */
export interface QuestionBlueprint {
  source: string;
  topic: string;
  subtopic: string;
  level: string;
  difficulty: string;
  objective: string;
  objects: string[];
  given: Array<{ symbol: string; value: string; unit?: string }>;
  unknown: string;
  methods: string[];
  diagramRequired: boolean;
  diagramDescription: string;
  labels: string[];
  answerFormat: string;
  /** Verbatim source question when the teacher supplied one. */
  sourceQuestion: string;
  notes?: string;
}

export const EMPTY_BLUEPRINT: QuestionBlueprint = {
  source: "",
  topic: "",
  subtopic: "",
  level: "",
  difficulty: "",
  objective: "",
  objects: [],
  given: [],
  unknown: "",
  methods: [],
  diagramRequired: false,
  diagramDescription: "",
  labels: [],
  answerFormat: "",
  sourceQuestion: "",
};

/** Verdict from a validation gate. */
export interface ValidationVerdict {
  ok: boolean;
  /** Which gate spoke: maths | diagram | consistency. */
  gate: "maths" | "diagram" | "consistency";
  problems: string[];
}

/**
 * Question + diagram + solution are ONE object, bound by a single generation
 * id (and, in the document, by the owner question id) so a later stage can
 * never look for something that was never created.
 */
export interface GenerationObject {
  generationId: string;
  questionId?: string;
  blueprint: QuestionBlueprint;
  questionText: string;
  diagramScene?: unknown;
  solutionText?: string;
  verdicts: ValidationVerdict[];
  stage: StageId;
}

export const newGenerationId = (): string =>
  `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
