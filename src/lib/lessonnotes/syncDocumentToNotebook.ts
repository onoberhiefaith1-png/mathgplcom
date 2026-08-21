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
import { type SectionKind } from "@/lib/lessonnotes/sectionKinds";
import { buildLessonOutline, renderSegmentBody } from "@/lib/lessonnotes/lessonOutline";
import { type SolutionObject } from "@/lib/floating/solutionItems";

type Node = any;

const QUESTION_KINDS: SectionKind[] = ["example", "exercise", "classwork", "homework", "assessment", "game_questions"];
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
  game_questions: "exercise",
  custom_session: "example",
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
  /** Objects (tables, diagrams, 3D scenes, charts) inside a non-question
   *  session. They belong to the session and are presented with it. */
  looseObjects: SolutionObject[];
  /** Used only for question kinds. */
  subsections: {
    problem: string;
    solution: string;
    solutionObjects: SolutionObject[];
    /** Objects that belong to the QUESTION itself (not its solution). */
    problemObjects: SolutionObject[];
  }[];
}

/** Normalize a problem string for matching across edits (case/whitespace). */
const normalizeProblem = (s: string): string =>
  String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/** Collect inline object nodes (asset-library visuals) nested inside a block. */
function collectInlineObjects(node: Node, out: Node[]): void {
  if (!node || typeof node !== "object") return;
  if (INLINE_OBJECT_TYPES.has(String(node.type))) { out.push(node); return; }
  if (Array.isArray(node.content)) for (const c of node.content) collectInlineObjects(c, out);
}

/** Render a contiguous run of body nodes into plain text (paragraph per line)
 *  PLUS the ordered list of non-text objects (tables, diagrams, charts, 3D
 *  scenes, …) found inside it. Objects are never flattened away. */
function renderBodyRich(nodes: Node[]): { text: string; objects: SolutionObject[] } {
  const lines: string[] = [];
  const objects: SolutionObject[] = [];
  const counters = new Map<string, number>();

  const pushObject = (n: Node) => {
    const nodeType = String(n?.type ?? "");
    if (!nodeType) return;
    const attrs = (n?.attrs && typeof n.attrs === "object") ? n.attrs : {};
    const idx = counters.get(nodeType) ?? 0;
    counters.set(nodeType, idx + 1);
    const family = objectFamily(nodeType, attrs);
    objects.push({
      objId: `${nodeType}#${idx}`,
      nodeType,
      family,
      label: familyLabel(family),
      attrs,
      afterLine: lines.length,
      inline: INLINE_OBJECT_TYPES.has(nodeType),
    });
  };

  for (const n of nodes) {
    if (!n) continue;
    if (isObjectNodeType(n.type)) { pushObject(n); continue; }
    const t = nodeText(n).trim();
    if (t) lines.push(t);
    const inlineObjs: Node[] = [];
    collectInlineObjects(n, inlineObjs);
    for (const o of inlineObjs) pushObject(o);
  }
  return { text: lines.join("\n").trim(), objects };
}

/** Text-only view, for section bodies that have no object support. */
function renderBody(nodes: Node[]): string {
  return renderBodyRich(nodes).text;
}


/**
 * Parse a TipTap document into the Smartboard structure.
 *
 * SEGMENTATION IS DETERMINISTIC and comes from `buildLessonOutline`: each
 * structural session heading opens a segment which ends at the line before the
 * next structural heading. A `Solution N` segment is folded into the question
 * segment immediately above it, which is what keeps Solution 1 attached to
 * Example 1 and Solution 2 to Example 2 no matter what is inserted between
 * them. No AI, no line numbers, no guessing from ordinary paragraph text.
 */
export function parseDocumentToSections(doc: any): ParsedSection[] {
  const segments = buildLessonOutline(doc);
  const out: ParsedSection[] = [];
  let lastQuestion: ParsedSection | null = null;

  for (const seg of segments) {
    if (seg.kind === "solution") {
      const body = renderSegmentBody(seg.nodes, true);
      const host = lastQuestion?.subsections[lastQuestion.subsections.length - 1];
      if (host) {
        host.solution = [host.solution, body.text].filter(Boolean).join("\n");
        host.solutionObjects = [...host.solutionObjects, ...body.objects];
        continue;
      }
      // Orphan solution (no question above it): keep it as readable content.
      out.push({ kind: "explanation", loose: body.text ? [body.text] : [], looseObjects: body.objects, subsections: [] });
      continue;
    }

    if (isQuestionKind(seg.kind)) {
      // EVERY question segment owns exactly one subsection, even when empty,
      // so the Floating workspace can always be opened for it.
      const body = renderSegmentBody(seg.nodes, false);
      const section: ParsedSection = {
        kind: seg.kind,
        loose: [],
        looseObjects: [],
        subsections: [{
          problem: body.text,
          solution: "",
          solutionObjects: [],
          problemObjects: body.objects,
        }],
      };
      out.push(section);
      lastQuestion = section;
      continue;
    }

    const body = renderSegmentBody(seg.nodes, false);
    out.push({
      kind: seg.kind,
      loose: body.text ? [body.text] : [],
      looseObjects: body.objects,
      subsections: [],
    });
    lastQuestion = null;
  }

  return out;
}

/** Reconcile the legacy section/subsection/block rows for `notebookId` with
 *  the structure derived from the document JSON.
 *
 *  IDENTITY IS PERMANENT:
 *  Section and subsection rows are matched to the document and UPDATED IN
 *  PLACE — their ids (and therefore their `stable_key`s) survive every edit,
 *  re-save and re-generation. Class assignments, adventure links and progress
 *  bars reference those keys, so a tick a teacher applied must never be
 *  orphaned by a note edit. Only questions the teacher genuinely removed are
 *  deleted; only genuinely new questions are inserted.
 *
 *  FLOATING HIGHLIGHT PERSISTENCE IS PERMANENT:
 *  `floating_highlights` is saved teacher intent, not temporary UI state.
 *  Because rows are no longer recreated, floating state simply stays where it
 *  is; nothing has to be re-paired heuristically.
 */

interface ExistingSub {
  id: string;
  order_index: number;
  problem: string;
}

interface ExistingSection {
  id: string;
  kind: string;
  order_index: number;
  subs: ExistingSub[];
}

async function writeBlocks(
  sectionId: string,
  subsectionId: string,
  problem: string,
  solution: string,
  solutionObjects: SolutionObject[] = [],
): Promise<void> {
  await supabase.from("notebook_blocks").delete().eq("subsection_id", subsectionId);
  await supabase.from("notebook_blocks").insert([
    { section_id: sectionId, subsection_id: subsectionId, kind: "problem" as any, order_index: 0, content_ascii: problem },
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "solution" as any,
      order_index: 1,
      content_ascii: solution,
      // Tables, diagrams, charts and 3D scenes that live inside the solution.
      content_json: (solutionObjects.length ? { objects: solutionObjects } : null) as any,
    },
    { section_id: sectionId, subsection_id: subsectionId, kind: "reasoning" as any, order_index: 2, content_ascii: "" },
  ]);
}

export async function syncDocumentToNotebook(notebookId: string, doc: any): Promise<void> {
  if (!notebookId || !doc) return;
  const parsed = parseDocumentToSections(doc);
  if (!parsed.length) return; // never wipe legacy data for an empty/unknown doc

  // ---- 1. Load the current tree ------------------------------------------
  const { data: secRows } = await supabase
    .from("notebook_sections")
    .select("id, kind, order_index")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true });
  const secList = (secRows ?? []) as { id: string; kind: string; order_index: number }[];
  const secIds = secList.map((s) => s.id);

  const subsBySection = new Map<string, ExistingSub[]>();
  if (secIds.length) {
    const [{ data: subs }, { data: blks }] = await Promise.all([
      supabase
        .from("notebook_subsections")
        .select("id, section_id, order_index")
        .in("section_id", secIds),
      supabase
        .from("notebook_blocks")
        .select("subsection_id, kind, content_ascii")
        .in("section_id", secIds),
    ]);
    const problemBySub = new Map<string, string>();
    for (const b of blks ?? []) {
      if ((b as any).kind === "problem" && (b as any).subsection_id) {
        problemBySub.set((b as any).subsection_id, String((b as any).content_ascii ?? ""));
      }
    }
    for (const s of subs ?? []) {
      const sid = (s as any).section_id as string;
      const list = subsBySection.get(sid) ?? [];
      list.push({
        id: (s as any).id as string,
        order_index: Number((s as any).order_index) || 0,
        problem: problemBySub.get((s as any).id as string) ?? "",
      });
      subsBySection.set(sid, list);
    }
    for (const list of subsBySection.values()) list.sort((a, b) => a.order_index - b.order_index);
  }

  const existing: ExistingSection[] = secList.map((s) => ({
    id: s.id,
    kind: String(s.kind),
    order_index: Number(s.order_index) || 0,
    subs: subsBySection.get(s.id) ?? [],
  }));

  // ---- 2. Match parsed sections to existing rows --------------------------
  // Greedy, kind-aware, order-preserving: each parsed section claims the first
  // unclaimed existing section of the same DB kind. Falls back to the first
  // unclaimed section of any kind so a kind change (e.g. Example → Exercise)
  // still keeps the same row — and therefore the same assignment link.
  const unclaimed = new Set(existing.map((e) => e.id));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const claimSection = (dbKind: string): ExistingSection | null => {
    for (const e of existing) {
      if (unclaimed.has(e.id) && e.kind === dbKind) { unclaimed.delete(e.id); return e; }
    }
    for (const e of existing) {
      if (unclaimed.has(e.id)) { unclaimed.delete(e.id); return e; }
    }
    return null;
  };

  for (let i = 0; i < parsed.length; i++) {
    const sec = parsed[i];
    const dbKind = DB_KIND[sec.kind];
    let target = claimSection(dbKind);

    if (target) {
      if (target.kind !== dbKind || target.order_index !== i) {
        await supabase
          .from("notebook_sections")
          .update({ kind: dbKind as any, order_index: i })
          .eq("id", target.id);
        target.kind = dbKind;
        target.order_index = i;
      }
    } else {
      const { data: created, error } = await supabase
        .from("notebook_sections")
        .insert({ notebook_id: notebookId, kind: dbKind as any, order_index: i })
        .select("id")
        .single();
      if (error || !created) continue;
      target = { id: created.id as string, kind: dbKind, order_index: i, subs: [] };
      byId.set(target.id, target);
    }

    const sectionId = target.id;

    if (sec.subsections.length) {
      // Match subsections: exact problem text first, then leftover rows in
      // document order. Matched rows keep their id AND their floating state.
      const pool = [...target.subs];
      const takeByProblem = (problem: string): ExistingSub | null => {
        const key = normalizeProblem(problem);
        if (!key) return null;
        const idx = pool.findIndex((p) => normalizeProblem(p.problem) === key);
        if (idx === -1) return null;
        return pool.splice(idx, 1)[0];
      };

      const claimed: (ExistingSub | null)[] = sec.subsections.map((s) => takeByProblem(s.problem));
      for (let j = 0; j < claimed.length; j++) {
        if (!claimed[j] && pool.length) claimed[j] = pool.shift()!;
      }

      for (let j = 0; j < sec.subsections.length; j++) {
        const { problem, solution, solutionObjects } = sec.subsections[j];
        let subId = claimed[j]?.id ?? null;
        if (subId) {
          if ((claimed[j] as ExistingSub).order_index !== j) {
            await supabase.from("notebook_subsections").update({ order_index: j }).eq("id", subId);
          }
        } else {
          const { data: subRow } = await supabase
            .from("notebook_subsections")
            .insert({
              section_id: sectionId,
              order_index: j,
              floating_highlights: null,
              floating_lines: [],
              floating_bucket: null,
            })
            .select("id")
            .single();
          if (!subRow) continue;
          subId = subRow.id as string;
        }
        await writeBlocks(sectionId, subId, problem, solution, solutionObjects ?? []);
      }

      // Subsections the teacher genuinely deleted.
      if (pool.length) {
        await supabase.from("notebook_subsections").delete().in("id", pool.map((p) => p.id));
      }
    } else {
      // Loose (non-question) section — its blocks are disposable.
      if (target.subs.length) {
        await supabase.from("notebook_subsections").delete().in("id", target.subs.map((p) => p.id));
      }
      await supabase.from("notebook_blocks").delete().eq("section_id", sectionId).is("subsection_id", null);
      if (sec.loose.length) {
        await supabase.from("notebook_blocks").insert(
          sec.loose.map((text, k) => ({
            section_id: sectionId,
            kind: "text" as any,
            order_index: k,
            content_ascii: text,
          })),
        );
      }
      target.subs = [];
    }
  }

  // ---- 3. Sections the teacher genuinely removed ---------------------------
  if (unclaimed.size) {
    await supabase.from("notebook_sections").delete().in("id", Array.from(unclaimed));
  }
}

