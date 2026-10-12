import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const attachment = z.object({
  path: z.string().min(1).max(500),
  name: z.string().max(300),
  mime: z.string().max(120),
  size: z.number().nonnegative(),
});
export const EXAMPLE_KINDS = [
  "lesson_note",
  "highlighting",
  "floating_numbers",
  "smartboard",
  "game",
  "activity",
  "assignment",
  "academia",
  "other",
] as const;

async function guard(context: { supabase: unknown; userId: string }) {
  const { assertAdmin } = await import("./training.server");
  await assertAdmin(context.supabase, context.userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return context.supabase as any;
}

export const trainingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context);
    const [m, e, r, v] = await Promise.all([
      db
        .from("assistant_training_messages")
        .select("*")
        .order("created_at")
        .limit(300),
      db
        .from("assistant_training_examples")
        .select(
          "id, kind, source_id, title, verdict, explanation, attachments, approved, created_at, snapshot",
        )
        .order("created_at", { ascending: false }),
      db
        .from("assistant_training_reports")
        .select("*")
        .order("created_at", { ascending: false }),
      db
        .from("assistant_guidance_versions")
        .select("*")
        .order("version", { ascending: false }),
    ]);
    const examples = (e.data ?? []).map((x: Record<string, unknown>) => ({
      ...x,
      hasSnapshot: !!x.snapshot,
      snapshot: undefined,
    }));
    return {
      json: JSON.stringify({
        messages: m.data ?? [],
        examples,
        reports: r.data ?? [],
        versions: v.data ?? [],
      }),
    };
  });

export const sendTrainingMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        body: z.string().trim().min(1).max(20_000),
        attachments: z.array(attachment).max(10).default([]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await guard(context);
    const { data: history } = await db
      .from("assistant_training_messages")
      .select("role, body")
      .order("created_at", { ascending: false })
      .limit(30);
    await db.from("assistant_training_messages").insert({
      author_id: context.userId,
      role: "admin",
      body: data.body,
      attachments: data.attachments,
    });
    const { data: ex } = await db
      .from("assistant_training_examples")
      .select("title, kind, verdict, explanation")
      .limit(40);
    const lib = (ex ?? [])
      .map(
        (x: Record<string, string>) =>
          `- ${x.title} [${x.kind}, ${x.verdict}]: ${x.explanation}`,
      )
      .join("\n");
    const { replyToAdmin } = await import("./training.server");
    const reply = await replyToAdmin((history ?? []).reverse(), data, lib);
    await db.from("assistant_training_messages").insert({
      author_id: context.userId,
      role: "assistant",
      body: reply.text || "(no reply)",
      usage: reply.usage,
    });
    return { ok: true };
  });

export const addTrainingExample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(EXAMPLE_KINDS),
        sourceId: z.string().uuid().optional(),
        title: z.string().trim().max(200).optional(),
        verdict: z.enum(["correct", "incorrect", "partial"]),
        explanation: z.string().max(20_000),
        attachments: z.array(attachment).max(10).default([]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await guard(context);
    let snapshot: unknown = null;
    let title = data.title ?? "";
    if (
      data.sourceId &&
      [
        "lesson_note",
        "highlighting",
        "floating_numbers",
        "smartboard",
      ].includes(data.kind)
    ) {
      const { snapshotNotebook } = await import("./training.server");
      const snap = await snapshotNotebook(data.sourceId);
      snapshot = snap;
      if (!title) title = snap.title ?? "Lesson note";
    }
    const { error } = await db.from("assistant_training_examples").insert({
      created_by: context.userId,
      kind: data.kind,
      source_id: data.sourceId ?? null,
      title: title || "Untitled example",
      verdict: data.verdict,
      explanation: data.explanation,
      attachments: data.attachments,
      snapshot,
    });
    if (error) throw new Error(error.message);
    return { ok: true, captured: !!snapshot };
  });

export const updateTrainingExample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        verdict: z.enum(["correct", "incorrect", "partial"]).optional(),
        explanation: z.string().max(20_000).optional(),
        approved: z.boolean().optional(),
        remove: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await guard(context);
    if (data.remove) {
      await db.from("assistant_training_examples").delete().eq("id", data.id);
      return { ok: true };
    }
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    for (const k of ["verdict", "explanation", "approved"] as const)
      if (data[k] !== undefined) patch[k] = data[k];
    const { error } = await db
      .from("assistant_training_examples")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createStudyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        exampleIds: z.array(z.string().uuid()).min(1).max(8),
        title: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await guard(context);
    const { data: ex } = await db
      .from("assistant_training_examples")
      .select("*")
      .in("id", data.exampleIds);
    if (!ex?.length) throw new Error("Choose at least one reference example.");
    const { writeStudyReport } = await import("./training.server");
    const r = await writeStudyReport(ex);
    const { error } = await db.from("assistant_training_reports").insert({
      created_by: context.userId,
      title:
        data.title || `Study report — ${new Date().toISOString().slice(0, 10)}`,
      example_ids: data.exampleIds,
      body: r.text,
      usage: r.usage,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStudyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        corrections: z.string().max(40_000).optional(),
        status: z.enum(["draft", "corrected", "approved"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await guard(context);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (data.corrections !== undefined) patch.corrections = data.corrections;
    if (data.status) patch.status = data.status;
    const { error } = await db
      .from("assistant_training_reports")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveGuidanceVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        mandatory: z.string().max(40_000),
        recommended: z.string().max(40_000),
        techniques: z.string().max(40_000),
        changeNote: z.string().trim().min(1).max(2_000),
        reportId: z.string().uuid().optional(),
        exampleIds: z.array(z.string().uuid()).max(40).default([]),
        approve: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = await guard(context);
    const { data: last } = await db
      .from("assistant_guidance_versions")
      .select("version")
      .order("version", { ascending: false })
      .limit(1);
    const version = ((last?.[0]?.version as number) ?? 0) + 1;
    if (data.approve) {
      const { data: ex } = await db
        .from("assistant_training_examples")
        .select("id, approved")
        .in(
          "id",
          data.exampleIds.length
            ? data.exampleIds
            : ["00000000-0000-0000-0000-000000000000"],
        );
      if ((ex ?? []).some((x: { approved: boolean }) => !x.approved))
        throw new Error(
          "Approve every linked example before approving guidance.",
        );
      await db
        .from("assistant_guidance_versions")
        .update({ status: "superseded" })
        .eq("status", "approved");
    }
    const { error } = await db.from("assistant_guidance_versions").insert({
      version,
      mandatory: data.mandatory,
      recommended: data.recommended,
      techniques: data.techniques,
      change_note: data.changeNote,
      report_id: data.reportId ?? null,
      example_ids: data.exampleIds,
      status: data.approve ? "approved" : "draft",
      approved_at: data.approve ? new Date().toISOString() : null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, version };
  });
