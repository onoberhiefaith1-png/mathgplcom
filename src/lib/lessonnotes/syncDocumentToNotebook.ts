// Lesson Note → Smartboard sync layer.
//
// The Smartboard reads the legacy structured tables (notebook_sections /
// notebook_subsections / notebook_blocks). The Document Editor now stores
// everything in `notebooks.document_json` (TipTap ProseMirror JSON). This
// helper rebuilds the legacy rows from the doc on every save so the
// Smartboard always presents the exact lesson the teacher just wrote.
//
// Floating-number data already saved on existing subsections is preserved by
// matching the problem text — so once the teacher fine-tunes floating
// numbers or highlight selections, those survive subsequent edits as long as
// the problem text stays the same.

import { supabase } from "@/integrations/supabase/client";
import { detectSectionKind, type SectionKind } from "@/lib/lessonnotes/sectionKinds";

type Node = any;

const QUESTION_KINDS: SectionKind[] = ["example", "exercise", "classwork", "homework", "assessment"];
const isQuestionKind = (k: SectionKind) => QUESTION_KINDS.includes(k);

// Smartboard's section.kind column only accepts the legacy set.
const DB_KIND: Record<SectionKind, string> = {
  introduction: "introduction",
  objectives: "explanation",
  explanation: "explanation",
  example: "example",
  exercise: "exercise",
  classwork: "classwork",
  homework: "homework",
  assessment: "exercise",
  summary: "summary",
  solution: "example",
};

/** Concatenate the visible text of a TipTap node, preserving math as their
 *  raw LaTeX value (so the floating-number extractor can read it). */
function nodeText(node: Node): string {
  if (!node) return "";
  if (node.type === "text") return String(node.text ?? "");
  if (node.type === "mathInline" || node.type === "mathBlock") {
    return String(node.attrs?.value ?? "");
  }
  if (Array.isArray(node.content)) return node.content.map(nodeText).join("");
  return "";
}

const isHeading = (n: Node, maxLevel = 6) =>
  n?.type === "heading" && (n.attrs?.level ?? 6) <= maxLevel;

const headingText = (n: Node) => nodeText(n).trim();

/** A flattened section as understood by the Smartboard. */
interface ParsedSection {
  kind: SectionKind;
  /** Used only for non-question sections. */
  loose: string[];
  /** Used only for question kinds. */
  subsections: { problem: string; solution: string }[];
}

/** Normalize a problem string for matching across edits (case/whitespace). */
const normalizeProblem = (s: string): string =>
  String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Render a contiguous run of body nodes into plain text, paragraph per line. */
function renderBody(nodes: Node[]): string {
  const lines: string[] = [];
  for (const n of nodes) {
    if (!n) continue;
    if (n.type === "paragraph" || n.type === "heading" || n.type === "mathBlock") {
      const t = nodeText(n).trim();
      if (t) lines.push(t);
    } else if (Array.isArray(n.content)) {
      const t = nodeText(n).trim();
      if (t) lines.push(t);
    }
  }
  return lines.join("\n").trim();
}

/** Split a question section's body into one subsection per H3 "Solution"
 *  boundary. Any H3 whose text matches another section kind starts a NEW
 *  subsection (e.g. "Example 2"). */
function splitQuestionBody(nodes: Node[]): { problem: string; solution: string }[] {
  const out: { problem: string; solution: string }[] = [];
  let problemBuf: Node[] = [];
  let solutionBuf: Node[] = [];
  let mode: "problem" | "solution" = "problem";

  const flush = () => {
    const problem = renderBody(problemBuf);
    const solution = renderBody(solutionBuf);
    if (problem || solution) out.push({ problem, solution });
    problemBuf = [];
    solutionBuf = [];
    mode = "problem";
  };

  for (const n of nodes) {
    if (isHeading(n, 3)) {
      const t = headingText(n).toLowerCase();
      if (t.startsWith("solution") || t.includes("worked solution")) {
        mode = "solution";
        continue;
      }
      // Numbered subsection marker like "Example 2" → start a new subsection.
      if (/\b(example|exercise|classwork|homework|question|q)\s*\d/i.test(t)) {
        flush();
        continue;
      }
      // Some other H3 — fold the heading text into the current buffer.
    }
    if (mode === "problem") problemBuf.push(n);
    else solutionBuf.push(n);
  }
  flush();
  return out;
}

/** Parse a TipTap document into the Smartboard structure. */
export function parseDocumentToSections(doc: any): ParsedSection[] {
  const content: Node[] = Array.isArray(doc?.content) ? doc.content : [];
  const sections: { kind: SectionKind; body: Node[] }[] = [];
  let current: { kind: SectionKind; body: Node[] } | null = null;

  for (const node of content) {
    if (isHeading(node, 2)) {
      const k = detectSectionKind(headingText(node));
      if (k && k !== "solution") {
        current = { kind: k, body: [] };
        sections.push(current);
        continue;
      }
      // H1/H2 with unrecognised text → keep it inside the current section.
    }
    if (!current) {
      // Preamble before the first recognised heading goes into an implicit
      // explanation section so nothing is silently dropped.
      current = { kind: "explanation", body: [] };
      sections.push(current);
    }
    current.body.push(node);
  }

  return sections.map((s) => {
    if (isQuestionKind(s.kind)) {
      const subs = splitQuestionBody(s.body);
      return { kind: s.kind, loose: [], subsections: subs };
    }
    const text = renderBody(s.body);
    return { kind: s.kind, loose: text ? [text] : [], subsections: [] };
  });
}

/** Replace the legacy section/subsection/block rows for `notebookId` with a
 *  fresh structure derived from the document JSON. Preserves all floating
 *  teacher state attached to subsections whose problem text is unchanged.
 *
 *  FLOATING HIGHLIGHT PERSISTENCE IS PERMANENT:
 *  `floating_highlights` is saved teacher intent, not temporary UI state.
 *  Sync/rebuild paths must never drop it; only explicit teacher actions may
 *  remove it.
 */
export async function syncDocumentToNotebook(notebookId: string, doc: any): Promise<void> {
  if (!notebookId || !doc) return;
  const parsed = parseDocumentToSections(doc);
  if (!parsed.length) return; // never wipe legacy data for an empty/unknown doc

  // 1. Snapshot existing floating data, keyed by normalized problem text.
  const { data: oldSecs } = await supabase
    .from("notebook_sections")
    .select("id")
    .eq("notebook_id", notebookId);
  const oldSecIds = (oldSecs ?? []).map((s: any) => s.id);

  const floatingByProblem = new Map<string, { highlights: any; lines: any; bucket: any }>();
  if (oldSecIds.length) {
    const [{ data: subs }, { data: blks }] = await Promise.all([
      supabase
        .from("notebook_subsections")
        .select("id, section_id, floating_highlights, floating_lines, floating_bucket")
        .in("section_id", oldSecIds),
      supabase
        .from("notebook_blocks")
        .select("subsection_id, kind, content_ascii")
        .in("section_id", oldSecIds),
    ]);
    const problemBySub = new Map<string, string>();
    for (const b of blks ?? []) {
      if ((b as any).kind === "problem" && (b as any).subsection_id) {
        problemBySub.set((b as any).subsection_id, String((b as any).content_ascii ?? ""));
      }
    }
    for (const s of subs ?? []) {
      const problem = problemBySub.get((s as any).id) ?? "";
      const key = normalizeProblem(problem);
      if (!key) continue;
      floatingByProblem.set(key, {
        highlights: (s as any).floating_highlights,
        lines: (s as any).floating_lines,
        bucket: (s as any).floating_bucket,
      });
    }
  }

  // 2. Wipe the legacy tree (cascades to subsections + blocks).
  if (oldSecIds.length) {
    await supabase.from("notebook_sections").delete().in("id", oldSecIds);
  }

  // 3. Rebuild from parsed structure.
  for (let i = 0; i < parsed.length; i++) {
    const sec = parsed[i];
    const { data: secRow, error: secErr } = await supabase
      .from("notebook_sections")
      .insert({ notebook_id: notebookId, kind: DB_KIND[sec.kind] as any, order_index: i })
      .select("id")
      .single();
    if (secErr || !secRow) continue;
    const sectionId = secRow.id as string;

    if (sec.subsections.length) {
      for (let j = 0; j < sec.subsections.length; j++) {
        const { problem, solution } = sec.subsections[j];
        const preserved = floatingByProblem.get(normalizeProblem(problem));
        const { data: subRow } = await supabase
          .from("notebook_subsections")
          .insert({
            section_id: sectionId,
            order_index: j,
            floating_highlights: (preserved?.highlights as any) ?? null,
            floating_lines: (preserved?.lines as any) ?? [],
            floating_bucket: (preserved?.bucket as any) ?? null,
          })
          .select("id")
          .single();
        if (!subRow) continue;
        await supabase.from("notebook_blocks").insert([
          { section_id: sectionId, subsection_id: subRow.id, kind: "problem" as any, order_index: 0, content_ascii: problem },
          { section_id: sectionId, subsection_id: subRow.id, kind: "solution" as any, order_index: 1, content_ascii: solution },
          { section_id: sectionId, subsection_id: subRow.id, kind: "reasoning" as any, order_index: 2, content_ascii: "" },
        ]);
      }
    } else if (sec.loose.length) {
      const rows = sec.loose.map((text, k) => ({
        section_id: sectionId,
        kind: "text" as any,
        order_index: k,
        content_ascii: text,
      }));
      await supabase.from("notebook_blocks").insert(rows);
    }
  }
}
