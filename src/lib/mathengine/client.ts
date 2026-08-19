// MathGPL Math Engine — the single client the application talks to.
//
// No UI component calls the generic AI path for mathematics any more: every
// mathematical request goes through one of the named operations here. The
// client re-computes the Engine's mathematical claims locally (verify.ts) and
// asks for a bounded regeneration when a gate fails, so unverified mathematics
// never reaches the lesson canvas.

import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/async/withTimeout";
import {
  EngineError,
  type EngineOperation,
  type EngineQuestion,
  type EngineRequest,
  type EngineResult,
} from "./types";
import { verificationProblems, verifyQuestion } from "./verify";

const ENGINE_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 3;

interface RawResponse {
  narration?: string;
  questions?: EngineQuestion[];
  analysis?: EngineResult["analysis"];
  scene?: unknown;
  error?: string;
}

async function callEngine(req: EngineRequest, problems: string[]): Promise<RawResponse> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("notebook-ai", {
      body: { mode: "mathengine", ...req, previousProblems: problems },
    }),
    ENGINE_TIMEOUT_MS,
    "The mathematics took longer than expected, so I stopped waiting. Try again.",
  );
  if (error) throw new EngineError(req.operation, error.message || "The Math Engine could not be reached.");
  const raw = (data ?? {}) as RawResponse;
  if (raw.error) throw new EngineError(req.operation, raw.error);
  return raw;
}

const OPERATIONS_RETURNING_QUESTIONS: EngineOperation[] = [
  "generateLessonSection", "generateExample", "generateClasswork", "generateAssignment",
  "generateSimilarQuestions", "solveQuestion",
];

/**
 * Run one Engine operation. Failed mathematical gates cause a silent
 * regeneration; when the Engine still cannot produce verified mathematics the
 * problems are surfaced so the teacher is asked instead of shown a guess.
 */
export async function runEngine(req: EngineRequest): Promise<EngineResult> {
  let problems: string[] = [];
  let attempts = 0;
  let last: RawResponse | null = null;

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    last = await callEngine(req, problems);
    const questions = Array.isArray(last.questions) ? last.questions : [];

    if (!OPERATIONS_RETURNING_QUESTIONS.includes(req.operation)) {
      return {
        operation: req.operation,
        narration: String(last.narration ?? "").trim(),
        questions,
        analysis: last.analysis ?? null,
        scene: last.scene,
        verification: { ok: true, checks: [] },
        attempts,
      };
    }

    if (!questions.length) {
      problems = ["No question was produced at all."];
      continue;
    }
    if (req.count && questions.length < req.count) {
      problems = [`${req.count} questions were required but only ${questions.length} came back.`];
      continue;
    }

    const perQuestion = questions.map((q) => verifyQuestion(q, { method: req.method }));
    const failed = perQuestion.flatMap((v, i) =>
      v.ok ? [] : verificationProblems(v).map((p) => `Question ${i + 1}: ${p}`));

    if (!failed.length) {
      return {
        operation: req.operation,
        narration: String(last.narration ?? "").trim(),
        questions,
        analysis: last.analysis ?? null,
        scene: last.scene,
        verification: {
          ok: true,
          checks: perQuestion.flatMap((v) => v.checks),
        },
        attempts,
      };
    }
    problems = failed;
  }

  throw new EngineError(
    req.operation,
    problems.length
      ? `I could not produce mathematics I'm confident in. ${problems[0]} Tell me how you'd like it framed and I'll work from that.`
      : "I could not produce mathematics I'm confident in for that request.",
    problems,
  );
}

/* ── named operations ─────────────────────────────────────────────── */

const op = (operation: EngineOperation) =>
  (req: Omit<EngineRequest, "operation">) => runEngine({ ...req, operation });

export const generateLessonSection = op("generateLessonSection");
export const generateExample = op("generateExample");
export const generateClasswork = op("generateClasswork");
export const generateAssignment = op("generateAssignment");
export const analyseQuestion = op("analyseQuestion");
export const generateSimilarQuestions = op("generateSimilarQuestions");
export const solveQuestion = op("solveQuestion");
export const verifySolution = op("verifySolution");
export const generateGeometry = op("generateGeometry");
export const verifyGeometry = op("verifyGeometry");
export const analyseUploadedMaterial = op("analyseUploadedMaterial");
export const validateMathematics = op("validateMathematics");

/** Board-ready lines for the canvas: question text then its solution steps. */
export function questionLines(q: EngineQuestion): string[] {
  return [q.text.trim(), ...(q.solutionSteps ?? []).map((s) => s.trim())].filter(Boolean);
}
