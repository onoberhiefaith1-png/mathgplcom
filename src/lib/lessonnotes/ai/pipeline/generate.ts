// The pipeline runner.
//
//   material → blueprint → question → (diagram) → (solution) → validation
//
// Each stage is announced through `onStage` so the UI can say exactly what is
// happening, and each stage returns into ONE GenerationObject so a later stage
// can never reach for something that was never created.

import {
  StageError,
  newGenerationId,
  type GenerationObject,
  type Material,
  type QuestionBlueprint,
  type StageId,
  type TeacherContext,
  type ValidationVerdict,
} from "./types";
import { blueprintDirective, requestBlueprint } from "./blueprint";
import { describeTeacherContext, hasMaterial } from "./material";
import { verifyGeneration } from "./validate";

export interface PipelineHooks {
  onStage?: (stage: StageId) => void;
}

export interface PipelineInput extends PipelineHooks {
  material: Material;
  context: TeacherContext;
  sectionKind: string;
  fallbackTopic?: string;
  fallbackSubtopic?: string;
  /** Generates the question body from the blueprint directive. */
  generateQuestion: (args: { directive: string; blueprint: QuestionBlueprint }) => Promise<string>;
  /** Optional: build the diagram for a blueprint that requires one. */
  generateDiagram?: (args: { blueprint: QuestionBlueprint; question: string }) => Promise<unknown | null>;
  /** Optional: solve the generated question. */
  generateSolution?: (args: { blueprint: QuestionBlueprint; question: string }) => Promise<string>;
  /** Skip validation gates (used for non-question sections). */
  skipValidation?: boolean;
}

/** Blueprint the material without generating anything yet. */
export async function runBlueprintStage(input: {
  material: Material;
  context: TeacherContext;
  sectionKind: string;
  fallbackTopic?: string;
  fallbackSubtopic?: string;
  onStage?: (stage: StageId) => void;
}): Promise<QuestionBlueprint> {
  input.onStage?.(hasMaterial(input.material) ? "INPUT_RECEIVED" : "ANALYSING");
  input.onStage?.("ANALYSING");
  const bp = await requestBlueprint({
    material: input.material,
    context: input.context,
    sectionKind: input.sectionKind,
    fallbackTopic: input.fallbackTopic,
    fallbackSubtopic: input.fallbackSubtopic,
  });
  input.onStage?.("BLUEPRINT_READY");
  return bp;
}

export async function runQuestionPipeline(input: PipelineInput): Promise<GenerationObject> {
  const obj: GenerationObject = {
    generationId: newGenerationId(),
    blueprint: await runBlueprintStage(input),
    questionText: "",
    verdicts: [],
    stage: "BLUEPRINT_READY",
  };

  // ── question ────────────────────────────────────────────────────────────
  input.onStage?.("GENERATING_QUESTION");
  obj.stage = "GENERATING_QUESTION";
  const directive = [blueprintDirective(obj.blueprint), describeTeacherContext(input.context)]
    .filter(Boolean)
    .join("\n\n");
  const questionText = (await input.generateQuestion({ directive, blueprint: obj.blueprint })).trim();
  if (!questionText) {
    throw new StageError("GENERATING_QUESTION", "The question body came back empty.");
  }
  obj.questionText = questionText;

  // ── diagram (only when the blueprint says so) ───────────────────────────
  if (obj.blueprint.diagramRequired && input.generateDiagram) {
    input.onStage?.("GENERATING_DIAGRAM");
    obj.stage = "GENERATING_DIAGRAM";
    try {
      obj.diagramScene =
        (await input.generateDiagram({ blueprint: obj.blueprint, question: obj.questionText })) ?? undefined;
    } catch (e) {
      throw new StageError(
        "GENERATING_DIAGRAM",
        String((e as any)?.message ?? "The diagram could not be built for this question."),
      );
    }
  }

  // ── solution ───────────────────────────────────────────────────────────
  if (input.generateSolution) {
    input.onStage?.("GENERATING_SOLUTION");
    obj.stage = "GENERATING_SOLUTION";
    obj.solutionText = (
      await input.generateSolution({ blueprint: obj.blueprint, question: obj.questionText })
    ).trim();
  }

  // ── validation gates ───────────────────────────────────────────────────
  if (!input.skipValidation) {
    input.onStage?.("VALIDATING");
    obj.stage = "VALIDATING";
    const gates: Array<ValidationVerdict["gate"]> = obj.diagramScene ? ["maths", "consistency"] : ["maths"];
    for (const gate of gates) {
      obj.verdicts.push(
        await verifyGeneration({
          gate,
          blueprint: obj.blueprint,
          question: obj.questionText,
          solution: obj.solutionText,
          diagramSummary: obj.diagramScene ? summariseScene(obj.diagramScene) : "",
        }),
      );
    }
  }

  input.onStage?.("READY");
  obj.stage = "READY";
  return obj;
}

/** Compact, text-only description of a geometry scene for the consistency gate. */
export function summariseScene(scene: unknown): string {
  try {
    const s = scene as any;
    const points = (s?.points ?? []).map((p: any) => p?.label ?? p?.id).filter(Boolean);
    const segs = (s?.segments ?? []).map((g: any) => `${g?.from}-${g?.to}`).filter(Boolean);
    const labels = (s?.annotations ?? s?.labels ?? []).map((a: any) => a?.text ?? a?.label).filter(Boolean);
    return [
      points.length ? `points: ${points.join(", ")}` : "",
      segs.length ? `segments: ${segs.join(", ")}` : "",
      labels.length ? `labels: ${labels.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  } catch {
    return "";
  }
}
