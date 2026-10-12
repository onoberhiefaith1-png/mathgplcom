// Administrator training system for connected assistants (server-only).
// Admin identity is checked first through the caller's own client; the admin
// client is used only to snapshot a reference the administrator designated.
import { generateText, type ModelMessage } from "ai";
import { apiKey, provider } from "@/lib/agent/brain.server";
import { turnCost } from "@/lib/agent/spend";
import { OPERATING_GUIDE } from "@/lib/mcp/guide/operatingGuide";
import { lessonStandardsText } from "@/lib/mcp/guide/operatingGuide";
import { describeAttachments, type TrainingAttachment } from "./attachments";

export const TRAINING_MODEL = "google/gemini-2.5-flash";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function assertAdmin(supabase: Client, userId: string) {
  const { data } = await supabase.rpc("is_platform_admin", {
    _user_id: userId,
  });
  if (data !== true) throw new Error("Platform administrators only.");
}

const cut = (s: unknown, n: number) => {
  const t = typeof s === "string" ? s : JSON.stringify(s ?? null);
  return t.length > n ? `${t.slice(0, n)}…[truncated]` : t;
};

/** Faithful, bounded copy of one lesson note's real stored stages. */
export async function snapshotNotebook(notebookId: string) {
  const { supabaseAdmin: db } =
    await import("@/integrations/supabase/client.server");
  const { data: nb } = await db
    .from("notebooks")
    .select("id, title")
    .eq("id", notebookId)
    .maybeSingle();
  if (!nb) throw new Error("Lesson note not found.");
  const { data: sections } = await db
    .from("notebook_sections")
    .select("*")
    .eq("notebook_id", notebookId)
    .order("order_index");
  const sectionIds = (sections ?? []).map((s: { id: string }) => s.id);
  const [{ data: subs }, { data: blocks }] = await Promise.all([
    db
      .from("notebook_subsections")
      .select(
        "id, section_id, order_index, floating_highlights, floating_lines, floating_bucket",
      )
      .in(
        "section_id",
        sectionIds.length
          ? sectionIds
          : ["00000000-0000-0000-0000-000000000000"],
      )
      .order("order_index"),
    db
      .from("notebook_blocks")
      .select("section_id, subsection_id, kind, order_index, content_ascii")
      .in(
        "section_id",
        sectionIds.length
          ? sectionIds
          : ["00000000-0000-0000-0000-000000000000"],
      )
      .order("order_index")
      .limit(400),
  ]);
  return {
    notebookId: nb.id,
    title: nb.title,
    sections: (sections ?? [])
      .slice(0, 40)
      .map((s: Record<string, unknown>) => ({
        title: s.title ?? null,
        kind: s.kind ?? s.section_type ?? null,
        blocks: (blocks ?? [])
          .filter(
            (b: { section_id: string; subsection_id: string | null }) =>
              b.section_id === s.id && !b.subsection_id,
          )
          .map((b: { kind: string; content_ascii: string }) => ({
            kind: b.kind,
            text: cut(b.content_ascii, 600),
          })),
        sessions: (subs ?? [])
          .filter((x: { section_id: string }) => x.section_id === s.id)
          .slice(0, 20)
          .map((x: Record<string, unknown>) => ({
            blocks: (blocks ?? [])
              .filter(
                (b: { subsection_id: string | null }) =>
                  b.subsection_id === x.id,
              )
              .map((b: { kind: string; content_ascii: string }) => ({
                kind: b.kind,
                text: cut(b.content_ascii, 600),
              })),
            highlights: cut(x.floating_highlights, 2500),
            floatingLines: cut(x.floating_lines, 3000),
            floatingBucket: cut(x.floating_bucket, 1500),
          })),
      })),
  };
}

async function imageParts(attachments: TrainingAttachment[]) {
  const { supabaseAdmin: db } =
    await import("@/integrations/supabase/client.server");
  const parts: { type: "image"; image: URL }[] = [];
  for (const a of attachments
    .filter((x) => x.mime.startsWith("image/"))
    .slice(0, 6)) {
    const { data } = await db.storage
      .from("assistant-training")
      .createSignedUrl(a.path, 600);
    if (data?.signedUrl)
      parts.push({ type: "image", image: new URL(data.signedUrl) });
  }
  return parts;
}

const TRAINER_SYSTEM = `You are the MathGPL assistant-training analyst, talking one-to-one with the platform administrator.
Your job: understand how MathGPL features should work, explain your interpretation back, and flag conflicts or missing information.
Terminology: "alighting" = the Highlighting / Floating Preparation page; "posting numbers" = Floating Numbers.
Separate three kinds of guidance: MANDATORY platform requirements, RECOMMENDED teaching practice, and EXAMPLE techniques. Never turn an example's incidental choice (e.g. it has three examples) into a rule.
Be honest about evidence: you can see text, the stored lesson-note data given to you, and images. You CANNOT watch videos or read documents unless their text is provided — say so plainly when only a file name is available.
Nothing you say becomes guidance until the administrator approves it. Be concise and concrete.

CURRENT OPERATING GUIDE GIVEN TO CONNECTED ASSISTANTS:
${OPERATING_GUIDE}`;

function usageOf(r: {
  usage?: { inputTokens?: number; outputTokens?: number };
}) {
  const u = turnCost(
    TRAINING_MODEL,
    r.usage?.inputTokens ?? 0,
    r.usage?.outputTokens ?? 0,
  );
  return {
    model: TRAINING_MODEL,
    inputTokens: u.input,
    outputTokens: u.output,
    estimatedPence: Number(u.pence.toFixed(3)),
  };
}

export async function replyToAdmin(
  history: { role: "admin" | "assistant"; body: string }[],
  latest: { body: string; attachments: TrainingAttachment[] },
  approvedExamples: string,
) {
  const lovable = provider(apiKey());
  const messages: ModelMessage[] = history.slice(-30).map((m) => ({
    role: m.role === "admin" ? "user" : "assistant",
    content: m.body,
  })) as ModelMessage[];
  const images = await imageParts(latest.attachments);
  messages.push({
    role: "user",
    content: [
      {
        type: "text",
        text: `${latest.body}\n\n${describeAttachments(latest.attachments)}`,
      },
      ...images,
    ],
  } as ModelMessage);
  const r = await generateText({
    model: lovable.chat(TRAINING_MODEL),
    system: `${TRAINER_SYSTEM}\n\nREFERENCE LIBRARY (administrator-designated):\n${approvedExamples || "(none yet)"}`,
    messages,
  });
  return { text: r.text, usage: usageOf(r) };
}

const REPORT_INSTRUCTIONS = `Write a STUDY REPORT for the administrator from the reference examples below. Use these headings exactly:
1. What was studied (list each example and which stages had data: lesson note, session solution, highlights, Floating Numbers lines/bucket).
2. Rules inferred per example — label each rule MANDATORY, RECOMMENDED or TECHNIQUE, with the evidence (quote the stored data).
3. Highlighting: what was highlighted, what was excluded, and why (only where the data shows it; say "no highlight data" otherwise).
4. Floating Numbers: how highlighted content became tokens/lines/structures, and why they are arranged that way.
5. From stored content to the final board or activity: how each stage relates to the previous one.
6. Examples that look incomplete or unsuitable as a standard, and why.
7. Uncertainties and questions for the administrator.
Do not invent data not shown. Treat the administrator's explanation of each example as the strongest evidence.`;

export async function writeStudyReport(examples: Record<string, unknown>[]) {
  const lovable = provider(apiKey());
  const body = examples
    .map(
      (e, i) =>
        `### Example ${i + 1}: ${e.title} [${e.kind}, admin verdict: ${e.verdict}]\nAdmin explanation: ${e.explanation || "(none)"}\n${describeAttachments((e.attachments as TrainingAttachment[]) ?? [])}\nStored data:\n${cut(e.snapshot, 14000)}`,
    )
    .join("\n\n");
  const r = await generateText({
    model: lovable.chat(TRAINING_MODEL),
    system: `${TRAINER_SYSTEM}\n\nLESSON STANDARDS:\n${cut(lessonStandardsText(), 12000)}`,
    prompt: `${REPORT_INSTRUCTIONS}\n\n${body}`,
  });
  return { text: r.text, usage: usageOf(r) };
}
