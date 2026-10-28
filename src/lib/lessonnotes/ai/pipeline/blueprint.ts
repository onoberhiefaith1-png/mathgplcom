// Stage 2/3 — extract the mathematics, then structure it as a blueprint.
//
// The blueprint exists as structured data BEFORE any question is generated:
// values, units, unknown, required methods, diagram requirement and answer
// format. Generation then works from the blueprint, never from a vague prompt.

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_BLUEPRINT,
  StageError,
  type Material,
  type QuestionBlueprint,
  type TeacherContext,
} from "./types";
import { describeMaterialSource, describeTeacherContext } from "./material";

const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(msg)), ms)),
  ]);

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter((x) => x.trim()) : [];

export function normalizeBlueprint(raw: any, fallback: Partial<QuestionBlueprint> = {}): QuestionBlueprint {
  const given = Array.isArray(raw?.given)
    ? raw.given
        .map((g: any) =>
          typeof g === "string"
            ? { symbol: g, value: "" }
            : { symbol: String(g?.symbol ?? ""), value: String(g?.value ?? ""), unit: g?.unit ? String(g.unit) : undefined },
        )
        .filter((g: any) => g.symbol || g.value)
    : [];
  return {
    ...EMPTY_BLUEPRINT,
    ...fallback,
    source: String(raw?.source ?? fallback.source ?? ""),
    topic: String(raw?.topic ?? fallback.topic ?? ""),
    subtopic: String(raw?.subtopic ?? fallback.subtopic ?? ""),
    level: String(raw?.level ?? fallback.level ?? ""),
    difficulty: String(raw?.difficulty ?? fallback.difficulty ?? ""),
    objective: String(raw?.objective ?? ""),
    objects: asStringArray(raw?.objects),
    given,
    unknown: String(raw?.unknown ?? ""),
    methods: asStringArray(raw?.methods),
    diagramRequired: Boolean(raw?.diagramRequired),
    diagramDescription: String(raw?.diagramDescription ?? ""),
    labels: asStringArray(raw?.labels),
    answerFormat: String(raw?.answerFormat ?? ""),
    sourceQuestion: String(raw?.sourceQuestion ?? ""),
    notes: raw?.notes ? String(raw.notes) : undefined,
  };
}

/** Ask the backend to analyse the material and return a structured blueprint. */
export async function requestBlueprint(opts: {
  material: Material;
  context: TeacherContext;
  sectionKind: string;
  /** Topic/subtopic already known from the lesson note (weaker than the strip). */
  fallbackTopic?: string;
  fallbackSubtopic?: string;
  /** Authoritative digest of the lesson session as it stands now. */
  sessionContext?: string;
}): Promise<QuestionBlueprint> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("notebook-ai", {
      body: {
        mode: "blueprint",
        sectionKind: opts.sectionKind,
        material: {
          text: opts.material.text,
          images: opts.material.images,
          files: opts.material.files,
        },
        materialSource: describeMaterialSource(opts.material),
        contextDirective: describeTeacherContext(opts.context),
        sessionContext: opts.sessionContext ?? "",
        topic: opts.context.topic.trim() || opts.fallbackTopic || "",
        subtopic: opts.context.subtopic.trim() || opts.fallbackSubtopic || "",
        level: opts.context.level,
        difficulty: opts.context.difficulty,
        diagramRequired: opts.context.diagramRequired,
        reuse: opts.context.reuse,
      },
    }),
    60_000,
    "Reading the material took too long. Please try again.",
  ).catch((e) => {
    throw new StageError("ANALYSING", String((e as any)?.message ?? e));
  });

  if (error) {
    throw new StageError(
      "ANALYSING",
      "The mathematical blueprint could not be created from the supplied material.",
    );
  }
  const raw = (data as any)?.blueprint;
  if (!raw) {
    throw new StageError(
      "ANALYSING",
      "The mathematical blueprint could not be created from the supplied material.",
    );
  }
  return normalizeBlueprint(raw, {
    source: describeMaterialSource(opts.material),
    topic: opts.context.topic.trim() || opts.fallbackTopic || "",
    subtopic: opts.context.subtopic.trim() || opts.fallbackSubtopic || "",
    level: opts.context.level,
    difficulty: opts.context.difficulty,
  });
}

/** Turn the blueprint into the generation directive the question stage uses. */
export function blueprintDirective(bp: QuestionBlueprint): string {
  const lines: string[] = [];
  if (bp.topic) lines.push(`Topic: ${bp.topic}`);
  if (bp.subtopic) lines.push(`Subtopic: ${bp.subtopic}`);
  if (bp.level) lines.push(`Level: ${bp.level}`);
  if (bp.difficulty) lines.push(`Difficulty: ${bp.difficulty}`);
  if (bp.objective) lines.push(`Mathematical objective: ${bp.objective}`);
  if (bp.objects.length) lines.push(`Mathematical objects: ${bp.objects.join(", ")}`);
  if (bp.given.length) {
    lines.push(
      `Given values: ${bp.given
        .map((g) => [g.symbol, g.value].filter(Boolean).join(" = ") + (g.unit ? ` ${g.unit}` : ""))
        .join("; ")}`,
    );
  }
  if (bp.unknown) lines.push(`Required unknown: ${bp.unknown}`);
  if (bp.methods.length) lines.push(`Required mathematics: ${bp.methods.join(", ")}`);
  if (bp.diagramRequired) {
    lines.push(`Diagram: required — ${bp.diagramDescription || "matching the question exactly"}`);
  }
  if (bp.labels.length) lines.push(`Diagram labels that must appear: ${bp.labels.join(", ")}`);
  if (bp.answerFormat) lines.push(`Answer format: ${bp.answerFormat}`);
  if (bp.sourceQuestion) {
    lines.push(
      `Source question supplied by the teacher (preserve its mathematical structure; ` +
        `only change values/context/labels if asked for a similar question):\n"""${bp.sourceQuestion}"""`,
    );
  }
  if (!lines.length) return "";
  return (
    "QUESTION BLUEPRINT (already agreed — generate exactly this, do not drift):\n" +
    lines.map((l) => `• ${l}`).join("\n")
  );
}
