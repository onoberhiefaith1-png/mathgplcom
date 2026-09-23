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
import { checkSolution, retryInstruction } from "./solutionContract";

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

const SECTION_KINDS = [
  "introduction",
  "explanation",
  "example",
  "exercise",
  "classwork",
  "homework",
  "summary",
];
const BLOCK_KINDS = ["problem", "solution", "reasoning", "text"];

type SectionPlace = {
  sectionId: string;
  notebookId: string;
  sectionKind: string;
  subject: string;
  topic: string;
  subtopic: string;
};

/** Where a section sits, and what the lesson note around it is about. */
async function readSection(ctx: Ctx, sectionId: string): Promise<SectionPlace> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data: section, error } = await db
    .from("notebook_sections")
    .select("id, kind, notebook_id")
    .eq("id", sectionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!section) throw new Error("That session was not found. Check the sectionId.");
  const { data: nb } = await db
    .from("notebooks")
    .select("id, title, subject, subtopic")
    .eq("id", section.notebook_id)
    .maybeSingle();
  return {
    sectionId: String(section.id),
    notebookId: String(section.notebook_id),
    sectionKind: String(section.kind ?? "example"),
    subject: String(nb?.subject ?? "Mathematics"),
    topic: String(nb?.title ?? ""),
    subtopic: String(nb?.subtopic ?? ""),
  };
}

/** The lesson so far, so the generator never repeats itself. */
async function readLessonSoFar(ctx: Ctx, notebookId: string) {
  const db = ctx.supabase as unknown as AnyDb;
  const { data: sections } = await db
    .from("notebook_sections")
    .select("id, kind, title, order_index")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true });
  const rows = (sections ?? []) as { id: string; kind: string; title: string | null }[];
  const explanations: string[] = [];
  const examples: { label: string; problem: string }[] = [];
  let introduction = "";
  for (const s of rows) {
    const { data: blocks } = await db
      .from("notebook_blocks")
      .select("kind, content_ascii, order_index")
      .eq("section_id", s.id)
      .order("order_index", { ascending: true });
    const text = ((blocks ?? []) as { kind: string; content_ascii: string | null }[])
      .map((b) => ({ kind: b.kind, text: String(b.content_ascii ?? "").trim() }))
      .filter((b) => b.text);
    if (!text.length) continue;
    const joined = text.map((b) => b.text).join("\n");
    if (s.kind === "introduction") introduction ||= joined;
    else if (s.kind === "explanation") explanations.push(joined);
    else {
      const problem = text.filter((b) => b.kind === "problem").map((b) => b.text).join(" / ");
      if (problem) examples.push({ label: s.title || s.kind, problem });
    }
  }
  return { introduction, explanations, examples };
}

/** One call into the platform's own notebook generator. */
async function callNotebookAi(ctx: Ctx, body: Record<string, unknown>) {
  const db = ctx.supabase as unknown as AnyDb;
  const { data, error } = await db.functions.invoke("notebook-ai", { body });
  if (error) {
    // The generator answers refusals as structured 4xx bodies; surface them.
    const detail =
      (error as any)?.context?.body?.detail ??
      (error as any)?.context?.body?.error ??
      error.message ??
      "The lesson-note generator did not answer.";
    throw new Error(String(detail));
  }
  const bad = (data as any)?.error;
  if (bad) throw new Error(String((data as any)?.detail ?? bad));
  return data as any;
}

export const handsExecutors: Record<string, Executor> = {
  plan_lesson_note: async (ctx, args) => {
    const sectionKind = (str(args, "sectionKind") ?? "example").toLowerCase();
    const notebookId = str(args, "notebookId");
    const place = notebookId
      ? await (async () => {
          const db = ctx.supabase as unknown as AnyDb;
          const { data: nb } = await db
            .from("notebooks")
            .select("title, subject, subtopic")
            .eq("id", notebookId)
            .maybeSingle();
          return {
            topic: String(nb?.title ?? str(args, "topic") ?? ""),
            subtopic: String(nb?.subtopic ?? str(args, "subtopic") ?? ""),
          };
        })()
      : { topic: str(args, "topic") ?? "", subtopic: str(args, "subtopic") ?? "" };

    const blueprint = await callNotebookAi(ctx, {
      mode: "blueprint",
      sectionKind,
      topic: place.topic,
      subtopic: place.subtopic,
      level: str(args, "level"),
      difficulty: str(args, "difficulty"),
      material: { text: str(args, "instruction") ?? "" },
      materialSource: "teacher instruction",
      sessionContext: str(args, "sessionContext") ?? "",
    });
    return {
      data: blueprint,
      summary: `Planned the ${sectionKind} with the lesson-note generator's own analysis stage.`,
    };
  },

  generate_lesson_content: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const sectionId = need(args, "sectionId");
    const subsectionId = str(args, "subsectionId") ?? null;
    const blockKindArg = (str(args, "blockKind") ?? "text").toLowerCase();
    const blockKind = BLOCK_KINDS.includes(blockKindArg) ? blockKindArg : "text";
    const place = await readSection(ctx, sectionId);
    const sectionKindArg = (str(args, "sectionKind") ?? place.sectionKind).toLowerCase();
    const sectionKind = SECTION_KINDS.includes(sectionKindArg) ? sectionKindArg : place.sectionKind;

    if ((blockKind === "problem" || blockKind === "solution") && !subsectionId) {
      throw new Error(
        `A ${blockKind} belongs inside a question. Create the session with add_lesson_session first, then pass its subsectionId.`,
      );
    }

    // A solution is always generated with its own question — never without one.
    let activeQuestion = str(args, "activeQuestion") ?? "";
    if (blockKind === "solution") {
      if (!activeQuestion && subsectionId) {
        activeQuestion = (await readQuestion(ctx, subsectionId)).problem;
      }
      if (!activeQuestion) {
        throw new Error(
          "There is no question written above this solution yet. Write the question first, then generate its solution.",
        );
      }
    }

    const soFar = await readLessonSoFar(ctx, place.notebookId);
    const generate = (extra: string) =>
      callNotebookAi(ctx, {
        mode: "generate",
        sectionKind,
        blockKind,
        subject: place.subject,
        topic: place.topic,
        subtopic: place.subtopic,
        teacherPrompt: [str(args, "instruction") ?? "", extra].filter(Boolean).join("\n\n"),
        currentContent: str(args, "currentContent") ?? "",
        activeQuestion: activeQuestion || undefined,
        inheritedContext: blockKind === "solution" ? true : undefined,
        lessonContext: {
          level: str(args, "level"),
          objectives: str(args, "objectives"),
          introduction: soFar.introduction,
          explanations: soFar.explanations,
          examples: soFar.examples,
        },
      });

    let out = await generate("");
    let content = String(out?.content ?? "").trim();
    if (!content) throw new Error("The generator returned nothing, so nothing was written into the note.");
    let written = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    // A solution must read like a board: the question restated, then one
    // complete micro-step per line. A failing attempt is rewritten once and, if
    // it still fails, nothing at all is written into the note.
    if (blockKind === "solution") {
      let fault = checkSolution(activeQuestion, written);
      if (fault) {
        out = await generate(retryInstruction(fault));
        content = String(out?.content ?? "").trim();
        written = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
        fault = checkSolution(activeQuestion, written);
      }
      if (fault) {
        throw new Error(
          `The solution was not written the way a teacher writes on a board — ${fault.reason}. Nothing was saved into the note.`,
        );
      }
    }

    let tail = db.from("notebook_blocks").select("order_index").eq("section_id", sectionId);
    tail = subsectionId ? tail.eq("subsection_id", subsectionId) : tail.is("subsection_id", null);
    const { data: existing } = await tail.order("order_index", { ascending: false }).limit(1);
    let order = (((existing ?? []) as { order_index: number }[])[0]?.order_index ?? -1) + 1;
    const rows = written.map((text) => ({
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: blockKind,
      content_ascii: text,
      order_index: order++,
    }));
    const { error } = await db.from("notebook_blocks").insert(rows);
    if (error) throw new Error(error.message);

    return {
      data: {
        sectionId,
        subsectionId,
        blockKind,
        sectionKind,
        lines: written,
        warnings: out?.warnings ?? null,
        nextStep: blockKind === "solution" ? "review_lesson_section" : undefined,
      },
      summary: `Wrote the ${sectionKind} ${blockKind} with the lesson-note generator — ${written.length} line${written.length === 1 ? "" : "s"}.`,
    };
  },

  review_lesson_section: async (ctx, args) => {
    const subsectionId = need(args, "subsectionId");
    const q = await readQuestion(ctx, subsectionId);
    const verdict = await callNotebookAi(ctx, {
      mode: "review",
      heading: q.sectionKind,
      questionText: q.problem,
      existingSolution: q.solution,
      instruction: str(args, "instruction") ?? "",
      requestedMethod: str(args, "method") ?? "",
    });
    const ok = verdict?.ok !== false;
    return {
      data: { subsectionId, ok, issue: verdict?.issue ?? null },
      summary: ok
        ? "The question and its solution passed the lesson-note check."
        : `The check found a problem: ${verdict?.issue?.detail ?? verdict?.issue?.type ?? "see the issue"}.`,
    };
  },

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
      page: str(args, "page") ?? null,
      control: str(args, "control") ?? null,
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
