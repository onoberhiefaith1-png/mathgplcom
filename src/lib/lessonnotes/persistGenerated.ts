// When the document editor generates an example/classwork/homework section
// via AI, we also persist the result to the legacy notebook_sections +
// notebook_subsections tables so the existing Smartboard / FloatingDisplayStrip
// pipeline keeps working unchanged. We do NOT redesign floating-number
// generation — we simply forward the solution text to the existing
// notebook-ai `floating` mode and store its output where the smartboard reads.

import { supabase } from "@/integrations/supabase/client";
import type { SectionKind } from "@/lib/lessonnotes/sectionKinds";

const MAP_TO_DB_KIND: Record<SectionKind, string> = {
  introduction: "introduction",
  explanation: "explanation",
  example: "example",
  exercise: "exercise",
  classwork: "classwork",
  homework: "homework",
  assessment: "exercise",
  summary: "summary",
  objectives: "explanation",
  solution: "example",
};

/**
 * For example/classwork/homework: create a fresh subsection holding the
 * problem + solution + floating lines so the smartboard can read it.
 */
export async function persistGeneratedExample(opts: {
  notebookId: string;
  kind: SectionKind;
  problem: string;
  solution: string;
  subject?: string;
  subtopic?: string;
}) {
  const dbKind = MAP_TO_DB_KIND[opts.kind];
  // Find or create section of this kind.
  const { data: existing } = await supabase
    .from("notebook_sections")
    .select("id, order_index")
    .eq("notebook_id", opts.notebookId)
    .eq("kind", dbKind as any)
    .order("order_index", { ascending: false })
    .limit(1);
  let sectionId = existing?.[0]?.id as string | undefined;
  if (!sectionId) {
    const { data: secCount } = await supabase
      .from("notebook_sections")
      .select("id", { count: "exact", head: true })
      .eq("notebook_id", opts.notebookId);
    const orderIndex = (secCount as any)?.length ?? 0;
    const { data: newSec, error } = await supabase
      .from("notebook_sections")
      .insert({ notebook_id: opts.notebookId, kind: dbKind as any, order_index: orderIndex })
      .select()
      .single();
    if (error || !newSec) return null;
    sectionId = newSec.id;
  }

  // Count existing subsections to set order_index.
  const { data: subs } = await supabase
    .from("notebook_subsections")
    .select("id")
    .eq("section_id", sectionId);
  const subOrder = subs?.length ?? 0;

  // Get floating lines from existing edge function. Skip entirely when we
  // don't have a parent question to anchor inheritance — the floating edge
  // will now refuse without ACTIVE_QUESTION.
  let floatingLines: any[] = [];
  if (opts.problem && opts.problem.trim()) {
    try {
      const { data, error } = await supabase.functions.invoke("notebook-ai", {
        body: {
          mode: "floating",
          problem: opts.problem,
          solution: opts.solution,
          subject: opts.subject ?? "Mathematics",
          subtopic: opts.subtopic ?? "",
          sectionKind: dbKind,
        },
      });
      if (!error) floatingLines = (data as any)?.lines ?? [];
    } catch {
      // floating numbers are non-blocking; if it fails the section still saves
    }
  } else {
    console.warn("[persistGeneratedExample] no parent question — skipping floating generation");
  }

  const { data: sub } = await supabase
    .from("notebook_subsections")
    .insert({
      section_id: sectionId,
      order_index: subOrder,
      floating_lines: floatingLines as any,
    })
    .select()
    .single();
  if (!sub) return null;

  await supabase.from("notebook_blocks").insert([
    { section_id: sectionId, subsection_id: sub.id, kind: "problem" as any, order_index: 0, content_ascii: opts.problem },
    { section_id: sectionId, subsection_id: sub.id, kind: "solution" as any, order_index: 1, content_ascii: opts.solution },
    { section_id: sectionId, subsection_id: sub.id, kind: "reasoning" as any, order_index: 2, content_ascii: "" },
  ]);
  return { subsectionId: sub.id as string, sectionId: sectionId! };
}
