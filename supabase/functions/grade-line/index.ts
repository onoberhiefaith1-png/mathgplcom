// grade-line — per-line mathematical equivalence grader.
//
// Compares the student's single line (as ASCII) against the teacher's stored
// aligned line for the same (questionId, lineId). The answer key never leaves
// the server. Grading uses the shared equivalence engine (symbolic → numeric →
// LLM) and NEVER inspects chip order, floating-number provenance, or drag
// history.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { equivalent } from "../_shared/mathEquivalence.ts";
import { diagnoseLine } from "../_shared/lineDiagnosis.ts";

const BodySchema = z.object({
  assessmentId: z.string().uuid(),
  questionId: z.string().min(1),
  lineId: z.string().min(1),
  studentAscii: z.string().min(1).max(4000),
  // Silent auto-check vs manual check (affects floating-set enforcement).
  mode: z.enum(["manual", "auto"]).optional().default("manual"),
  // When provided in auto mode, student ascii atoms must be a subset of these.
  allowedFloatingTokens: z.array(z.string()).optional(),
  // Dry-run: run equivalence + set checks but do not write progress.
  // Used by the teacher Reasoning Panel.
  persist: z.boolean().optional().default(true),
});


function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "missing_authorization" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { assessmentId, questionId, lineId, studentAscii, mode, allowedFloatingTokens, persist } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
    const uid = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: assessment, error: aErr } = await admin
      .from("assessments")
      .select("id, class_id, owner_id, questions, total_marks")
      .eq("id", assessmentId)
      .maybeSingle();
    if (aErr || !assessment) return json({ error: "assessment_not_found" }, 404);

    if (assessment.owner_id !== uid) {
      const { data: member } = await admin
        .from("class_members")
        .select("user_id")
        .eq("class_id", assessment.class_id)
        .eq("user_id", uid)
        .maybeSingle();
      if (!member) return json({ error: "not_a_member" }, 403);
    }

    const questions = (assessment.questions ?? []) as Array<{
      id: string;
      lines: Array<{ lineId: string; marks?: number }>;
    }>;
    const question = questions.find((q) => q.id === questionId);
    const qLine = question?.lines?.find((l) => l.lineId === lineId);
    if (!question || !qLine) return json({ error: "line_not_found" }, 404);
    const lineMarks = Math.max(0, Number(qLine.marks ?? 0));

    const { data: key } = await admin
      .from("assessment_answer_keys")
      .select("lines")
      .eq("assessment_id", assessmentId)
      .maybeSingle();
    const keyLines = (key?.lines ?? []) as Array<{
      questionId: string;
      lineId: string;
      tokens: string[];
    }>;
    const correct = keyLines.find(
      (k) => k.questionId === questionId && k.lineId === lineId,
    );
    if (!correct) return json({ error: "key_not_found" }, 404);
    const teacherAscii = (correct.tokens ?? []).join(" ").trim();

    // Floating-set enforcement. Student atoms (numbers + variable identifiers)
    // must be a subset of the line's available chips. Applied in BOTH modes:
    // a student can never invent a token that wasn't floated to them.
    let inFloatingSet = true;
    if (Array.isArray(allowedFloatingTokens) && allowedFloatingTokens.length > 0) {
      const atomize = (s: string): string[] =>
        (s.match(/[A-Za-z]+|\d+(?:\.\d+)?/g) ?? []).map((t) => t.toLowerCase());
      const allowed = new Set(allowedFloatingTokens.flatMap(atomize));
      const used = atomize(studentAscii);
      inFloatingSet = used.every((a) => allowed.has(a));
    }


    const verdict = inFloatingSet ? await equivalent(teacherAscii, studentAscii) : "not_in_floating_set";
    const isCorrect = inFloatingSet && verdict === "equal";

    // Specific, teacher-style diagnosis (1–3 words) for the Check Line popup.
    // Never contains the answer key.
    let diagnosis;
    try {
      diagnosis = diagnoseLine(teacherAscii, studentAscii, verdict);
    } catch {
      diagnosis = isCorrect
        ? { code: "equivalent", label: "Equivalent", detail: "The line is mathematically equivalent to the expected step." }
        : { code: "not_equivalent", label: "Not equivalent", detail: "The line could not be shown to be equivalent to the expected step." };
    }
    if (isCorrect && diagnosis.code !== "equivalent") {
      diagnosis = { code: "equivalent", label: "Equivalent", detail: "The line is mathematically equivalent to the expected step, even if the route differs." };
    }

    const { data: existing } = await admin
      .from("assessment_progress")
      .select("id, solved_lines, score")
      .eq("assessment_id", assessmentId)
      .eq("student_id", uid)
      .maybeSingle();

    const solved: Record<string, number> = {
      ...((existing?.solved_lines as Record<string, number> | undefined) ?? {}),
    };
    const slot = `${questionId}:${lineId}`;
    if (isCorrect) solved[slot] = lineMarks;

    const score = Object.values(solved).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalMarks = Number(assessment.total_marks ?? 0);
    const status = totalMarks > 0 && score >= totalMarks ? "completed" : "in_progress";

    // Dry-run: skip persistence, return the verdict + would-be marks.
    if (!persist) {
      return json({
        correct: isCorrect,
        verdict,
        diagnosis,
        marks: isCorrect ? lineMarks : 0,
        score: Number(existing?.score ?? 0),
        totalMarks,
        solvedLines: (existing?.solved_lines as Record<string, number>) ?? {},
        status: "dry_run",
        teacherAscii,
        dryRun: true,
      });
    }

    let savedProgress: { solved_lines: Record<string, number>; score: number; status: string } | null = null;
    if (existing?.id) {
      const { data: saved, error: saveErr } = await admin
        .from("assessment_progress")
        .update({ solved_lines: solved, score, status })
        .eq("id", existing.id)
        .select("solved_lines, score, status")
        .single();
      if (saveErr || !saved) return json({ error: "progress_save_failed" }, 500);
      savedProgress = saved as { solved_lines: Record<string, number>; score: number; status: string };
    } else {
      const { data: saved, error: saveErr } = await admin
        .from("assessment_progress")
        .insert({
          assessment_id: assessmentId,
          student_id: uid,
          solved_lines: solved,
          score,
          status,
        })
        .select("solved_lines, score, status")
        .single();
      if (saveErr || !saved) return json({ error: "progress_save_failed" }, 500);
      savedProgress = saved as { solved_lines: Record<string, number>; score: number; status: string };
    }

    return json({
      correct: isCorrect,
      verdict,
      marks: isCorrect ? lineMarks : 0,
      score: savedProgress.score,
      totalMarks,
      solvedLines: savedProgress.solved_lines,
      status: savedProgress.status,
      progress: savedProgress,
    });

  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
