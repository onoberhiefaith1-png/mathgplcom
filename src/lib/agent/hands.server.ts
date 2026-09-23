// The assistant's hands on the lesson-note pipeline.
//
// Everything here runs the code the app itself runs — the highlight record the
// Floating Number pages read, the platform's own Floating Number generator, the
// real test board, the real assignment pipeline. No second engine, no second
// set of rules. Each executor reads its own result back before reporting.

import type { SupabaseClient } from "@supabase/supabase-js";

import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { mintLineUid } from "@/lib/lessonnotes/lineIdentity";
import {
  compileBucket,
  rearrangeIndices,
  type ContainerKind,
  type FloatingLine,
} from "@/lib/lessonnotes/floatingCompile";
import { withDb } from "@/lib/db/scope";
import { resolveQuestionRef, assignAssessmentQuestion } from "@/lib/assignments/pipeline";
import { getNotebookScoreLabel, type AssessmentKind } from "@/lib/assessments/createAssessment";

type AnyDb = { from: (table: string) => any; functions: { invoke: (fn: string, opts: any) => any } };
type Ctx = { supabase: SupabaseClient<never, "public", never>; userId: string };
type Args = Record<string, unknown>;

const str = (args: Args, key: string): string | undefined => {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
const need = (args: Args, key: string): string => {
  const v = str(args, key);
  if (!v) throw new Error(`Missing required argument "${key}".`);
  return v;
};

const CONTAINERS: ContainerKind[] = [
  "fraction",
  "bracket",
  "radical",
  "power",
  "log",
  "integral",
  "matrix",
  "differential",
  "abs",
  "vector",
];

const ASSESSMENT_KINDS: AssessmentKind[] = ["classwork", "homework", "assessment", "practice"];

type Question = {
  subsectionId: string;
  sectionId: string;
  notebookId: string;
  sectionKind: string;
  subject: string;
  subtopic: string;
  problem: string;
  solution: string;
  floatingLines: FloatingLine[];
  floatingHighlights: any[];
};

/** Everything one question is made of, read straight from the lesson note. */
async function readQuestion(ctx: Ctx, subsectionId: string): Promise<Question> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data: sub, error } = await db
    .from("notebook_subsections")
    .select("id, section_id, floating_lines, floating_highlights")
    .eq("id", subsectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) throw new Error("That question was not found. Check the session id.");

  const { data: section } = await db
    .from("notebook_sections")
    .select("id, kind, notebook_id")
    .eq("id", sub.section_id)
    .maybeSingle();
  if (!section) throw new Error("That question has no session above it.");

  const { data: notebook } = await db
    .from("notebooks")
    .select("id, subject, subtopic")
    .eq("id", section.notebook_id)
    .maybeSingle();

  const { data: blocks } = await db
    .from("notebook_blocks")
    .select("kind, content_ascii, order_index")
    .eq("subsection_id", subsectionId)
    .order("order_index", { ascending: true });

  const pick = (kind: string) =>
    ((blocks ?? []) as { kind: string; content_ascii: string | null }[])
      .filter((b) => b.kind === kind)
      .map((b) => String(b.content_ascii ?? ""))
      .join("\n")
      .trim();

  return {
    subsectionId,
    sectionId: String(section.id),
    notebookId: String(section.notebook_id),
    sectionKind: String(section.kind ?? "example"),
    subject: String(notebook?.subject ?? "Mathematics"),
    subtopic: String(notebook?.subtopic ?? ""),
    problem: pick("problem"),
    solution: pick("solution"),
    floatingLines: Array.isArray(sub.floating_lines) ? (sub.floating_lines as FloatingLine[]) : [],
    floatingHighlights: Array.isArray(sub.floating_highlights) ? (sub.floating_highlights as any[]) : [],
  };
}

type Executor = (
  ctx: Ctx,
  args: Args,
) => Promise<{ data: unknown; summary: string; navigateTo?: string }>;

export const handsExecutors: Record<string, Executor> = {
  highlight_solution: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const subsectionId = need(args, "subsectionId");
    const q = await readQuestion(ctx, subsectionId);
    if (!q.solution) {
      throw new Error(
        "This question has no written solution yet. Write the solution as micro-steps first, then highlight it.",
      );
    }
    const sourceLines = q.solution.split(/\r?\n/);
    const highlights = sourceLines
      .map((text, line) => ({ text: text.trim(), line }))
      .filter((r) => r.text.length > 0)
      .map((r, i) => ({
        uid: mintLineUid(),
        groupId: i + 1,
        tokens: tokenizeMath(r.text).map((_t, tok) => ({ line: r.line, tok })),
        payload: r.text,
        precedingNotebook: "",
      }));
    if (highlights.length === 0) throw new Error("The solution is empty, so there is nothing to highlight.");

    const { error } = await db
      .from("notebook_subsections")
      .update({ floating_highlights: highlights })
      .eq("id", subsectionId);
    if (error) throw new Error(error.message);

    const after = await readQuestion(ctx, subsectionId);
    return {
      data: {
        subsectionId,
        highlighted: after.floatingHighlights.length,
        lines: highlights.map((h) => h.payload),
        nextStep: "generate_floating_numbers",
      },
      summary: `Highlighted ${after.floatingHighlights.length} solution line${after.floatingHighlights.length === 1 ? "" : "s"} as the source of the Floating Numbers.`,
    };
  },

  generate_floating_numbers: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const subsectionId = need(args, "subsectionId");
    const orderArg = (str(args, "order") ?? "solution").toLowerCase();
    if (!["solution", "shuffled"].includes(orderArg)) {
      throw new Error('Argument "order" must be "solution" or "shuffled".');
    }
    const q = await readQuestion(ctx, subsectionId);
    if (!q.problem) {
      throw new Error("This session has no question written in it yet, so nothing can be generated.");
    }
    const fromHighlights = q.floatingHighlights.some((h) => !h?.notebookOnly);

    const body = fromHighlights
      ? {
          mode: "floating_highlights",
          subject: q.subject,
          subtopic: q.subtopic,
          sectionKind: q.sectionKind,
          problem: q.problem,
          highlights: q.floatingHighlights
            .filter((h) => !h?.notebookOnly)
            .map((h) => ({ uid: h.uid, groupId: h.groupId, payload: h.payload })),
        }
      : {
          mode: "floating",
          subject: q.subject,
          subtopic: q.subtopic,
          sectionKind: q.sectionKind,
          problem: q.problem,
          solution: q.solution,
        };

    const { data, error } = await db.functions.invoke("notebook-ai", { body });
    if (error) throw new Error(error.message ?? "The Floating Number generator did not answer.");
    const aiLines = (data as any)?.lines as
      | { uid?: string; equation?: string; fillers?: string[]; containers?: string[] }[]
      | undefined;
    if (!Array.isArray(aiLines) || aiLines.length === 0) {
      throw new Error("The generator returned no floating pieces. Check the solution and try again.");
    }

    const live = q.floatingHighlights.filter((h) => !h?.notebookOnly);
    const lines: FloatingLine[] = aiLines.map((a, i) => {
      const sourceUid = String(a.uid ?? live[i]?.uid ?? "");
      const payload = sourceUid ? live.find((h) => h.uid === sourceUid)?.payload : undefined;
      const fillers = (a.fillers ?? []).map((f) => String(f)).filter(Boolean);
      const containers = (a.containers ?? [])
        .map((c) => String(c).toLowerCase())
        .filter((c): c is ContainerKind => (CONTAINERS as string[]).includes(c));
      const identity = fillers.map((_f, n) => n);
      return {
        lineId: mintLineUid(),
        ...(sourceUid ? { sourceUid } : {}),
        questionId: subsectionId,
        equation: String(payload ?? a.equation ?? "").trim(),
        fillers,
        containers,
        arrangement: orderArg === "shuffled" ? rearrangeIndices(fillers.length) : identity,
        fillersSelected: fillers.map(() => false),
        containersSelected: containers.map(() => false),
      };
    });

    const { error: saveError } = await db
      .from("notebook_subsections")
      .update({
        floating_lines: lines,
        floating_bucket: lines.length ? compileBucket(lines) : null,
      })
      .eq("id", subsectionId);
    if (saveError) throw new Error(saveError.message);

    const after = await readQuestion(ctx, subsectionId);
    if (after.floatingLines.length === 0) {
      throw new Error("The Floating Numbers did not save. Nothing was changed.");
    }
    return {
      data: {
        subsectionId,
        savedLines: after.floatingLines.length,
        order: orderArg,
        chipsPerLine: after.floatingLines.map((l) => (l.fillers ?? []).length),
        testPath: `/lesson-notes/${q.notebookId}/floating/${subsectionId}/test`,
        nextStep: "smartboard_test",
      },
      summary: `Generated Floating Numbers for ${after.floatingLines.length} line${after.floatingLines.length === 1 ? "" : "s"}, ${orderArg === "shuffled" ? "shuffled" : "in solution order"}.`,
    };
  },

  read_floating_numbers: async (ctx, args) => {
    const subsectionId = need(args, "subsectionId");
    const q = await readQuestion(ctx, subsectionId);
    return {
      data: {
        subsectionId,
        notebookId: q.notebookId,
        sectionKind: q.sectionKind,
        problem: q.problem,
        highlighted: q.floatingHighlights.length,
        lines: q.floatingLines.map((l) => ({
          equation: l.equation,
          chips: l.fillers ?? [],
          containers: l.containers ?? [],
          marks: l.marks ?? null,
        })),
      },
      summary: `${q.floatingLines.length} Floating Number line${q.floatingLines.length === 1 ? "" : "s"} saved on this question.`,
    };
  },

  smartboard_test: async (ctx, args) => {
    const subsectionId = need(args, "subsectionId");
    const q = await readQuestion(ctx, subsectionId);
    if (q.floatingLines.length === 0) {
      throw new Error(
        "There are no Floating Numbers on this question yet, so there is nothing to test. Highlight the solution and generate them first.",
      );
    }
    const path = `/lesson-notes/${q.notebookId}/floating/${subsectionId}/test`;
    return {
      data: { subsectionId, notebookId: q.notebookId, lines: q.floatingLines.length, path },
      summary: `Opening the dry run of this question on the student board — nothing is saved and nobody is marked.`,
      navigateTo: path,
    };
  },

  assign_question: async (ctx, args) => {
    const subsectionId = need(args, "subsectionId");
    const classId = need(args, "classId");
    const kindArg = (str(args, "kind") ?? "classwork").toLowerCase() as AssessmentKind;
    const kind = ASSESSMENT_KINDS.includes(kindArg) ? kindArg : "classwork";
    const dueAt = str(args, "dueAt") ?? null;

    const q = await readQuestion(ctx, subsectionId);
    if (q.floatingLines.length === 0) {
      throw new Error(
        "This question has no Floating Numbers yet, so the class would receive nothing. Generate them first.",
      );
    }
    const title = str(args, "title") ?? q.problem.split(/\r?\n/)[0]?.slice(0, 80) ?? "Assignment";

    const assessmentId = await withDb(ctx.supabase, async () => {
      const ref = await resolveQuestionRef(subsectionId);
      const scoreLabel = await getNotebookScoreLabel(q.notebookId);
      return assignAssessmentQuestion({
        classId,
        notebookId: q.notebookId,
        ref,
        kind,
        title,
        scoreLabel,
        dueAt,
      });
    });

    const db = ctx.supabase as unknown as AnyDb;
    const { data: check } = await db
      .from("assessments")
      .select("id, class_id, total_marks, unassigned_at")
      .eq("id", assessmentId)
      .maybeSingle();
    if (!check || check.unassigned_at) {
      throw new Error("The assignment did not save. The class has not received anything.");
    }

    return {
      data: {
        assessmentId,
        classId,
        kind,
        title,
        dueAt,
        totalMarks: check.total_marks ?? null,
      },
      summary: `Assigned "${title}" to the class as ${kind}. The students can see it now.`,
      navigateTo: `/class/${classId}`,
    };
  },

  propose_knowledge: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const list = (key: string): string[] => {
      const v = args[key];
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    };
    const row = {
      author_id: ctx.userId,
      feature: need(args, "feature"),
      scope: str(args, "scope") ?? null,
      roles: list("roles"),
      preconditions: list("preconditions"),
      steps: list("steps"),
      expected_result: str(args, "expectedResult") ?? null,
      verification: str(args, "verification") ?? null,
      failures: list("failures"),
      evidence: str(args, "evidence") ?? null,
      status: (str(args, "status") ?? "proposed") === "observed" ? "observed" : "proposed",
    };
    if (row.steps.length === 0) {
      throw new Error("Write the steps you actually observed before proposing this entry.");
    }
    const { data, error } = await db
      .from("aura_knowledge")
      .insert(row)
      .select("id, feature, status")
      .single();
    if (error) throw new Error(error.message);
    return {
      data,
      summary: `Written down what I learned about ${row.feature} as ${row.status} — it waits for the administrator to approve it.`,
    };
  },

  recall_knowledge: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const feature = str(args, "feature");
    let query = db
      .from("aura_knowledge")
      .select(
        "id, feature, scope, roles, preconditions, steps, expected_result, verification, failures, evidence, status, updated_at",
      )
      .in("status", ["approved", "observed"])
      .order("updated_at", { ascending: false })
      .limit(40);
    if (feature) query = query.ilike("feature", `%${feature}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    return {
      data: rows,
      summary: `${rows.length} learned entr${rows.length === 1 ? "y" : "ies"}${feature ? ` about ${feature}` : ""}.`,
    };
  },
};

/** The administrator-approved entries, written for the system prompt. */
export async function learnedKnowledgePrompt(ctx: Ctx): Promise<string | null> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data } = await db
    .from("aura_knowledge")
    .select("feature, scope, roles, preconditions, steps, expected_result, verification, failures, status")
    .eq("status", "approved")
    .order("updated_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return null;
  const block = rows
    .map((r) => {
      const list = (label: string, items: string[] | null) =>
        items && items.length ? `  ${label}: ${items.join(" | ")}` : "";
      return [
        `## ${r.feature}${r.scope ? ` — ${r.scope}` : ""}`,
        list("Who", r.roles),
        list("Needs first", r.preconditions),
        list("Steps", r.steps),
        r.expected_result ? `  Expect: ${r.expected_result}` : "",
        r.verification ? `  Verified by: ${r.verification}` : "",
        list("Known failures", r.failures),
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  return [
    `WHAT THE ADMINISTRATOR HAS TAUGHT AND APPROVED`,
    `These entries outrank anything you infer yourself. Follow them exactly.`,
    block,
  ].join("\n");
}
