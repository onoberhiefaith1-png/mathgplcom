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
import { buildLessonOutline, renderSegmentBody, segmentHome, segmentKey } from "@/lib/lessonnotes/lessonOutline";
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

/** A flattened section as understood by the Smartboard. */
interface ParsedSection {
  kind: SectionKind;
  /** Permanent outline identity of this session ("4:example:3"). */
  docKey: string;
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
    /** Same permanent identity as the owning session. */
    docKey: string;
  }[];
}


/** Normalize a problem string for matching across edits (case/whitespace). */
const normalizeProblem = (s: string): string =>
  String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();


/**
 * Parse a TipTap document into the Smartboard structure.
 *
 * SEGMENTATION IS DETERMINISTIC and comes from `buildLessonOutline`: each
 * structural session heading opens a segment which ends at the line before the
 * next structural heading.
 *
 * OWNERSHIP IS RECORDED, NOT POSITIONAL: a `Solution` segment is folded into
 * the question named by its owner id (`ownerQuestionId` on the heading, or on
 * the floating frame it was dragged into). Only an owner-less legacy solution
 * falls back to the question above it. That is why a solution parked in a
 * frame at the very end of the note still belongs to its own question.
 */
export function parseDocumentToSections(doc: any): ParsedSection[] {
  const segments = buildLessonOutline(doc);
  const out: ParsedSection[] = [];
  const sectionForSegment = new Map<number, ParsedSection>();

  // ── PASS 1: questions and plain sessions, in document order ─────────────
  for (const seg of segments) {
    if (seg.kind === "solution") continue;
    const key = segmentKey(seg);

    if (isQuestionKind(seg.kind)) {
      // EVERY question segment owns exactly one subsection, even when empty,
      // so the Floating workspace can always be opened for it.
      const body = renderSegmentBody(seg.nodes, false, segmentHome(seg));
      const section: ParsedSection = {
        kind: seg.kind,
        docKey: key,
        loose: [],
        looseObjects: [],
        subsections: [{
          problem: body.text,
          solution: "",
          solutionObjects: [],
          problemObjects: body.objects,
          docKey: key,
        }],
      };
      out.push(section);
      sectionForSegment.set(seg.index, section);
      continue;
    }

    const body = renderSegmentBody(seg.nodes, false, segmentHome(seg));
    out.push({
      kind: seg.kind,
      docKey: key,
      loose: body.text ? [body.text] : [],
      looseObjects: body.objects,
      subsections: [],
    });
  }

  // ── PASS 2: solutions, each into the question that owns it ──────────────
  for (const seg of segments) {
    if (seg.kind !== "solution") continue;
    const owner = ownerQuestionSegment(segments, seg);
    // Persist the OWNER's segment home so diagrams cannot drift sessions.
    const body = renderSegmentBody(seg.nodes, true, segmentHome(owner ?? seg));
    const section = owner ? sectionForSegment.get(owner.index) ?? null : null;
    const host = section?.subsections[section.subsections.length - 1];
    if (host) {
      host.solution = [host.solution, body.text].filter(Boolean).join("\n");
      host.solutionObjects = [...host.solutionObjects, ...body.objects];
      continue;
    }
    // Orphan solution (no question owns it): keep it as readable content.
    out.push({
      kind: "explanation",
      docKey: segmentKey(seg),
      loose: body.text ? [body.text] : [],
      looseObjects: body.objects,
      subsections: [],
    });
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
  doc_key: string | null;
}

interface ExistingSection {
  id: string;
  kind: string;
  order_index: number;
  doc_key: string | null;
  subs: ExistingSub[];
}


async function writeBlocks(
  sectionId: string,
  subsectionId: string,
  problem: string,
  solution: string,
  solutionObjects: SolutionObject[] = [],
  problemObjects: SolutionObject[] = [],
): Promise<void> {
  await supabase.from("notebook_blocks").delete().eq("subsection_id", subsectionId);
  await supabase.from("notebook_blocks").insert([
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "problem" as any,
      order_index: 0,
      content_ascii: problem,
      // Objects that belong to the QUESTION (tables, diagrams, charts, 3D).
      content_json: (problemObjects.length ? { objects: problemObjects } : null) as any,
    },
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
    .select("id, kind, order_index, doc_key")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true });
  const secList = (secRows ?? []) as { id: string; kind: string; order_index: number; doc_key: string | null }[];
  const secIds = secList.map((s) => s.id);

  const subsBySection = new Map<string, ExistingSub[]>();
  if (secIds.length) {
    const [{ data: subs }, { data: blks }] = await Promise.all([
      supabase
        .from("notebook_subsections")
        .select("id, section_id, order_index, doc_key")
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
        doc_key: ((s as any).doc_key as string | null) ?? null,
      });
      subsBySection.set(sid, list);
    }
    for (const list of subsBySection.values()) list.sort((a, b) => a.order_index - b.order_index);
  }

  const existing: ExistingSection[] = secList.map((s) => ({
    id: s.id,
    kind: String(s.kind),
    order_index: Number(s.order_index) || 0,
    doc_key: s.doc_key ?? null,
    subs: subsBySection.get(s.id) ?? [],
  }));


  // ---- 2. Match parsed sections to existing rows --------------------------
  // DURABLE IDENTITY FIRST: a section claims the row carrying the same
  // `doc_key` (outline position + kind + ordinal). Only when no keyed row
  // exists do we fall back to the legacy greedy kind/order matching, so old
  // notebooks keep working while new saves become positionally exact.
  const unclaimed = new Set(existing.map((e) => e.id));
  const byId = new Map(existing.map((e) => [e.id, e]));
  const claimSection = (dbKind: string, docKey: string): ExistingSection | null => {
    for (const e of existing) {
      if (unclaimed.has(e.id) && e.doc_key && e.doc_key === docKey) { unclaimed.delete(e.id); return e; }
    }
    for (const e of existing) {
      if (unclaimed.has(e.id) && !e.doc_key && e.kind === dbKind) { unclaimed.delete(e.id); return e; }
    }
    for (const e of existing) {
      if (unclaimed.has(e.id) && !e.doc_key) { unclaimed.delete(e.id); return e; }
    }
    return null;
  };

  for (let i = 0; i < parsed.length; i++) {
    const sec = parsed[i];
    const dbKind = DB_KIND[sec.kind];
    let target = claimSection(dbKind, sec.docKey);

    if (target) {
      if (target.kind !== dbKind || target.order_index !== i || target.doc_key !== sec.docKey) {
        await supabase
          .from("notebook_sections")
          .update({ kind: dbKind as any, order_index: i, doc_key: sec.docKey })
          .eq("id", target.id);
        target.kind = dbKind;
        target.order_index = i;
        target.doc_key = sec.docKey;
      }
    } else {
      const { data: created, error } = await supabase
        .from("notebook_sections")
        .insert({ notebook_id: notebookId, kind: dbKind as any, order_index: i, doc_key: sec.docKey })
        .select("id")
        .single();
      if (error || !created) continue;
      target = { id: created.id as string, kind: dbKind, order_index: i, doc_key: sec.docKey, subs: [] };
      byId.set(target.id, target);
    }

    const section: ExistingSection = target;
    const sectionId = section.id;

    if (sec.subsections.length) {
      // Match subsections: durable doc_key first, then exact problem text, then
      // leftover rows in document order. Matched rows keep their id AND their
      // floating state.
      const pool = [...section.subs];
      const takeByKey = (docKey: string): ExistingSub | null => {
        const idx = pool.findIndex((p) => p.doc_key && p.doc_key === docKey);
        if (idx === -1) return null;
        return pool.splice(idx, 1)[0];
      };
      const takeByProblem = (problem: string): ExistingSub | null => {
        const key = normalizeProblem(problem);
        if (!key) return null;
        const idx = pool.findIndex((p) => !p.doc_key && normalizeProblem(p.problem) === key);
        if (idx === -1) return null;
        return pool.splice(idx, 1)[0];
      };

      const claimed: (ExistingSub | null)[] = sec.subsections.map(
        (s) => takeByKey(s.docKey) ?? takeByProblem(s.problem),
      );
      for (let j = 0; j < claimed.length; j++) {
        if (!claimed[j] && pool.length) {
          const idx = pool.findIndex((p) => !p.doc_key);
          if (idx !== -1) claimed[j] = pool.splice(idx, 1)[0];
        }
      }


      for (let j = 0; j < sec.subsections.length; j++) {
        const { problem, solution, solutionObjects, problemObjects, docKey } = sec.subsections[j];
        let subId = claimed[j]?.id ?? null;
        if (subId) {
          const row = claimed[j] as ExistingSub;
          if (row.order_index !== j || row.doc_key !== docKey) {
            await supabase
              .from("notebook_subsections")
              .update({ order_index: j, doc_key: docKey })
              .eq("id", subId);
          }
        } else {
          const { data: subRow } = await supabase
            .from("notebook_subsections")
            .insert({
              section_id: sectionId,
              order_index: j,
              doc_key: docKey,
              floating_highlights: null,
              floating_lines: [],
              floating_bucket: null,
            })
            .select("id")
            .single();
          if (!subRow) continue;
          subId = subRow.id as string;
        }
        await writeBlocks(sectionId, subId, problem, solution, solutionObjects ?? [], problemObjects ?? []);
      }

      // Subsections the teacher genuinely deleted.
      if (pool.length) {
        await supabase.from("notebook_subsections").delete().in("id", pool.map((p) => p.id));
      }
    } else {
      // Loose (non-question) section — its blocks are disposable.
      if (section.subs.length) {
        await supabase.from("notebook_subsections").delete().in("id", section.subs.map((p) => p.id));
      }

      await supabase.from("notebook_blocks").delete().eq("section_id", sectionId).is("subsection_id", null);
      if (sec.loose.length || sec.looseObjects.length) {
        const texts = sec.loose.length ? sec.loose : [""];
        await supabase.from("notebook_blocks").insert(
          texts.map((text, k) => ({
            section_id: sectionId,
            kind: "text" as any,
            order_index: k,
            content_ascii: text,
            // Objects inside a non-question session (tables, diagrams, charts)
            // travel with the session so the Smartboard can present them.
            content_json: (k === 0 && sec.looseObjects.length
              ? { objects: sec.looseObjects }
              : null) as any,
          })),
        );
      }
      section.subs = [];
    }
  }

  // ---- 3. Sections the teacher genuinely removed ---------------------------
  if (unclaimed.size) {
    await supabase.from("notebook_sections").delete().in("id", Array.from(unclaimed));
  }
}

