// One preparation path for AI Edit, Co-Pilot and manual Solution generation.
// It updates the subsection already owned by the question; it never creates a
// second lesson section or duplicates the visible Solution.

import { supabase } from "@/integrations/supabase/client";
import { cleanNoteLines } from "@/lib/agent/noteHygiene";
import { syncDocumentToNotebook } from "@/lib/lessonnotes/syncDocumentToNotebook";

type PreparedRow = {
  id: string;
  section_id: string;
  floating_lines: unknown;
  floating_bucket: unknown;
};

const hasLines = (value: unknown) => Array.isArray(value) && value.length > 0;

export async function prepareNotebookSolutions(opts: {
  notebookId: string;
  documentJson: unknown;
  subject?: string;
  subtopic?: string;
  forceDocKeys?: string[];
}): Promise<{ prepared: string[]; failed: string[] }> {
  await syncDocumentToNotebook(opts.notebookId, opts.documentJson);

  const { data: sections } = await supabase
    .from("notebook_sections")
    .select("id")
    .eq("notebook_id", opts.notebookId);
  const sectionIds = (sections ?? []).map((section) => section.id as string);
  if (sectionIds.length === 0) return { prepared: [], failed: [] };

  const { data: subsectionRows } = await supabase
    .from("notebook_subsections")
    .select("id, section_id, doc_key, floating_lines, floating_bucket")
    .in("section_id", sectionIds);
  const rows = (subsectionRows ?? []) as Array<PreparedRow & { doc_key?: string | null }>;
  if (rows.length === 0) return { prepared: [], failed: [] };

  const { data: blocks } = await supabase
    .from("notebook_blocks")
    .select("subsection_id, kind, content_ascii")
    .in("subsection_id", rows.map((row) => row.id));
  const problemBySub = new Map<string, string>();
  const solutionBySub = new Map<string, string>();
  for (const block of blocks ?? []) {
    const subsectionId = block.subsection_id as string | null;
    if (!subsectionId) continue;
    if (block.kind === "problem") problemBySub.set(subsectionId, String(block.content_ascii ?? ""));
    if (block.kind === "solution") solutionBySub.set(subsectionId, String(block.content_ascii ?? ""));
  }

  const forced = new Set(opts.forceDocKeys ?? []);
  const prepared: string[] = [];
  const failed: string[] = [];
  for (const row of rows) {
    const problem = cleanNoteLines(problemBySub.get(row.id) ?? "").join("\n");
    const solution = cleanNoteLines(solutionBySub.get(row.id) ?? "").join("\n");
    if (!problem.trim() || !solution.trim()) continue;
    const shouldRefresh = !!row.doc_key && forced.has(row.doc_key);
    if (!shouldRefresh && (hasLines(row.floating_lines) || row.floating_bucket != null)) continue;

    try {
      const { data, error } = await supabase.functions.invoke("notebook-ai", {
        body: {
          mode: "floating",
          problem,
          solution,
          subject: opts.subject ?? "Mathematics",
          subtopic: opts.subtopic ?? "",
        },
      });
      const lines = (data as { lines?: unknown[] } | null)?.lines ?? [];
      if (error || lines.length === 0) {
        failed.push(row.id);
        continue;
      }
      const { error: updateError } = await supabase
        .from("notebook_subsections")
        .update({ floating_lines: lines as never })
        .eq("id", row.id);
      if (updateError) failed.push(row.id);
      else prepared.push(row.id);
    } catch {
      failed.push(row.id);
    }
  }
  return { prepared, failed };
}