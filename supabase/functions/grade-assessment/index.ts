// grade-assessment — server-authoritative line grading for the Assessment
// Workspace. The correct answer (answer key) is NEVER sent to the client; the
// student only submits an arrangement of the chips that were provided to them.
//
// Grading is a CONSTRAINED relationship check (not a CAS):
//   • Split the teacher line and the student line on "=".
//   • Compare each side as a multiset of signed term-chips.
//   • Accept side-swaps + additive reorderings (A+B=C ≡ C=B+A, 2x=10 ≡ 10=2x).
//   • Reject anything that moves a term across "=" (A+C=B).
// Because students can only rearrange the supplied chips, this is sufficient.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  assessmentId: z.string().uuid(),
  questionId: z.string().min(1),
  lineId: z.string().min(1),
  arrangement: z.array(z.string()).min(1).max(64),
});

/** Normalise a chip so "+A", " A " and unicode-minus variants compare equal. */
function normChip(raw: string): string {
  let s = String(raw ?? "")
    .replace(/\u2212/g, "-") // unicode minus → hyphen
    .replace(/\u00d7/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/\s+/g, "")
    .trim();
  if (s.startsWith("+")) s = s.slice(1);
  return s;
}

const isEquals = (s: string) => normChip(s) === "=";

/** Split a token list into {left,right} around the first "=" chip. */
function sides(tokens: string[]): { left: string[]; right: string[] } {
  const idx = tokens.findIndex(isEquals);
  if (idx < 0) return { left: tokens.map(normChip).filter(Boolean), right: [] };
  return {
    left: tokens.slice(0, idx).map(normChip).filter(Boolean),
    right: tokens.slice(idx + 1).map(normChip).filter(Boolean),
  };
}

/** Order-independent multiset equality. */
function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/** Constrained relationship equivalence between two chip arrangements. */
function relationshipMatches(teacher: string[], student: string[]): boolean {
  const t = sides(teacher);
  const s = sides(student);
  const direct = sameMultiset(t.left, s.left) && sameMultiset(t.right, s.right);
  const swapped = sameMultiset(t.left, s.right) && sameMultiset(t.right, s.left);
  return direct || swapped;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return json({ error: "missing_authorization" }, 401);
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { assessmentId, questionId, lineId, arrangement } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller from their JWT.
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return json({ error: "invalid_token" }, 401);
    }
    const uid = userData.user.id;

    // Privileged client: reads the hidden key + writes progress.
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: assessment, error: aErr } = await admin
      .from("assessments")
      .select("id, class_id, owner_id, questions, total_marks")
      .eq("id", assessmentId)
      .maybeSingle();
    if (aErr || !assessment) {
      return json({ error: "assessment_not_found" }, 404);
    }

    // Membership firewall: caller must be a member of (or own) the class.
    const isOwner = assessment.owner_id === uid;
    if (!isOwner) {
      const { data: member } = await admin
        .from("class_members")
        .select("user_id")
        .eq("class_id", assessment.class_id)
        .eq("user_id", uid)
        .maybeSingle();
      if (!member) {
        return json({ error: "not_a_member" }, 403);
      }
    }

    // Locate the line's marks in the public question payload.
    const questions = (assessment.questions ?? []) as Array<{
      id: string;
      lines: Array<{ lineId: string; marks?: number }>;
    }>;
    const question = questions.find((q) => q.id === questionId);
    const qLine = question?.lines?.find((l) => l.lineId === lineId);
    if (!question || !qLine) {
      return json({ error: "line_not_found" }, 404);
    }
    const lineMarks = Math.max(0, Number(qLine.marks ?? 0));

    // Read the HIDDEN correct arrangement for this line.
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
    if (!correct) {
      return json({ error: "key_not_found" }, 404);
    }

    const isCorrect = relationshipMatches(correct.tokens ?? [], arrangement);

    // Load (or seed) this student's progress row, then update authoritatively.
    const { data: existing } = await admin
      .from("assessment_progress")
      .select("id, solved_lines, score")
      .eq("assessment_id", assessmentId)
      .eq("student_id", uid)
      .maybeSingle();

    const solved: Record<string, number> = {
      ...(existing?.solved_lines as Record<string, number> | undefined),
    };
    const slot = `${questionId}:${lineId}`;
    if (isCorrect) {
      solved[slot] = lineMarks;
    }
    const score = Object.values(solved).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalMarks = Number(assessment.total_marks ?? 0);
    const status = totalMarks > 0 && score >= totalMarks ? "completed" : "in_progress";

    if (existing?.id) {
      await admin
        .from("assessment_progress")
        .update({ solved_lines: solved, score, status })
        .eq("id", existing.id);
    } else {
      await admin.from("assessment_progress").insert({
        assessment_id: assessmentId,
        student_id: uid,
        solved_lines: solved,
        score,
        status,
      });
    }

    return json({
      correct: isCorrect,
      marks: isCorrect ? lineMarks : 0,
      score,
      totalMarks,
      solvedLines: solved,
      status,
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
