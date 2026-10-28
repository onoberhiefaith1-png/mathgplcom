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
import { buildLessonOutline, ownerQuestionSegment, renderSegmentBody, segmentHome, segmentKey } from "@/lib/lessonnotes/lessonOutline";
import { type SolutionObject } from "@/lib/floating/solutionItems";
import { cleanNoteLines } from "@/lib/agent/noteHygiene";
import { hasPreparedFloating, planFloatingHydration, type FloatingCarrier } from "@/lib/lessonnotes/hydrateFloatingFromOrigin";

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
  canvas: "explanation",
};

/** A flattened section as understood by the Smartboard. */
interface ParsedSection {
  kind: SectionKind;
  /** Permanent outline identity of this session ("4:example:3"). */
  docKey: string;
  /** The heading's permanent `sectionId`; survives re-wording and moving. */
  docSectionId: string | null;
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
    docSectionId: string | null;
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
        docSectionId: seg.sectionId ?? null,
        loose: [],
        looseObjects: [],
        subsections: [{
          problem: body.text,
          solution: "",
          solutionObjects: [],
          problemObjects: body.objects,
          docKey: key,
          docSectionId: seg.sectionId ?? null,
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
      docSectionId: seg.sectionId ?? null,
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
      docSectionId: null,
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
  section_id: string;
  order_index: number;
  problem: string;
  solution: string;
  doc_key: string | null;
  doc_section_id: string | null;
  stable_key: string | null;
  floating_lines: unknown;
  floating_bucket: unknown;
  floating_highlights: unknown;
  floating_scoring: unknown;
}


interface ExistingSection {
  id: string;
  kind: string;
  order_index: number;
  doc_key: string | null;
  doc_section_id: string | null;
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
  // The page prints its own "Problem" and "Solution" headings, so a label can
  // never be stored as content. Without this, every save re-read the labels out
  // of the document and stacked another one on top.
  const cleanProblem = cleanNoteLines(problem).join("\n");
  const cleanSolution = cleanNoteLines(solution).join("\n");
  await supabase.from("notebook_blocks").delete().eq("subsection_id", subsectionId);
  await supabase.from("notebook_blocks").insert([
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "problem" as any,
      order_index: 0,
      content_ascii: cleanProblem,
      // Objects that belong to the QUESTION (tables, diagrams, charts, 3D).
      content_json: (problemObjects.length ? { objects: problemObjects } : null) as any,
    },
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "solution" as any,
      order_index: 1,
      content_ascii: cleanSolution,
      // Tables, diagrams, charts and 3D scenes that live inside the solution.
      content_json: (solutionObjects.length ? { objects: solutionObjects } : null) as any,
    },
    { section_id: sectionId, subsection_id: subsectionId, kind: "reasoning" as any, order_index: 2, content_ascii: "" },
  ]);
}

/** The fields the matching rules read; real rows carry more. */
export interface MatchableSub {
  id: string;
  problem: string;
  solution?: string;
  doc_key: string | null;
  doc_section_id?: string | null;
}

export interface MatchableSection<S extends MatchableSub = MatchableSub> {
  id: string;
  kind: string;
  doc_key: string | null;
  doc_section_id?: string | null;
  subs: S[];
}

/**
 * Claim section rows for EVERY parsed entry in full passes, strongest signal
 * first, so one question can never take a row that another question owns:
 *   1. the heading's permanent id (survives re-wording AND moving)
 *   2. unchanged question text
 *   3. the positional doc_key (a re-worded question that stayed put)
 *   4. legacy rows saved before doc_key existed
 *   5. unchanged solution text
 * A stale positional key is only a position: matched first, it hands a row (and
 * its Floating Numbers) to whatever question now sits there, so it is not
 * consulted until text has had its chance.
 */
export function claimSectionsForEntries<E extends MatchableSection>(
  existing: E[],
  unclaimed: Set<string>,
  entries: {
    dbKind: string;
    docKey: string;
    problem: string | null;
    solution?: string | null;
    docSectionId?: string | null;
  }[],
): (E | null)[] {
  const claimed: (E | null)[] = new Array(entries.length).fill(null);
  const take = (i: number, match: (e: E) => boolean) => {
    if (claimed[i]) return;
    const found = existing.find((e) => unclaimed.has(e.id) && match(e));
    if (!found) return;
    unclaimed.delete(found.id);
    claimed[i] = found;
  };

  entries.forEach((entry, i) => {
    const id = entry.docSectionId;
    if (id) take(i, (e) => e.doc_section_id === id);
  });
  entries.forEach((entry, i) => {
    const key = normalizeProblem(entry.problem ?? "");
    if (!key) return;
    take(i, (e) => e.kind === entry.dbKind && e.subs.some((sub) => normalizeProblem(sub.problem) === key));
  });
  entries.forEach((entry, i) => take(i, (e) => !!e.doc_key && e.doc_key === entry.docKey));
  entries.forEach((entry, i) => take(i, (e) => !e.doc_key && e.kind === entry.dbKind));
  entries.forEach((entry, i) => {
    const key = normalizeProblem(entry.solution ?? "");
    if (!key) return;
    take(i, (e) => e.kind === entry.dbKind && e.subs.some((sub) => normalizeProblem(sub.solution ?? "") === key));
  });
  entries.forEach((_, i) => take(i, (e) => !e.doc_key));
  return claimed;
}

/**
 * Match one section's parsed subsections against its existing rows, again in
 * full passes: permanent id, exact text, positional key, the same text or
 * solution anywhere in the notebook (a question moved between sessions), then
 * leftover un-keyed rows. Claimed rows keep their id AND their floating state.
 * Mutates `claimedSubIds` and the per-section `subs` lists it takes rows from.
 */
export function matchSubsectionsForSection<S extends MatchableSub>(
  section: { subs: S[] },
  existing: { kind: string; subs: S[] }[],
  claimedSubIds: Set<string>,
  dbKind: string,
  parsedSubsections: {
    problem: string;
    solution?: string;
    docKey: string;
    docSectionId?: string | null;
  }[],
): { claimed: (S | null)[]; leftoverPool: S[] } {
  const pool = [...section.subs];
  const claimed: (S | null)[] = new Array(parsedSubsections.length).fill(null);

  const takeFromPool = (i: number, match: (p: S) => boolean) => {
    if (claimed[i]) return;
    const idx = pool.findIndex(match);
    if (idx === -1) return;
    const sub = pool.splice(idx, 1)[0];
    claimedSubIds.add(sub.id);
    claimed[i] = sub;
  };
  const takeGlobal = (i: number, match: (p: S) => boolean) => {
    if (claimed[i]) return;
    for (const e of existing) {
      if (e.kind !== dbKind) continue;
      const idx = e.subs.findIndex((p) => !claimedSubIds.has(p.id) && match(p));
      if (idx === -1) continue;
      const sub = e.subs.splice(idx, 1)[0];
      claimedSubIds.add(sub.id);
      claimed[i] = sub;
      return;
    }
  };

  parsedSubsections.forEach((s, i) => {
    if (s.docSectionId) takeFromPool(i, (p) => p.doc_section_id === s.docSectionId);
  });
  parsedSubsections.forEach((s, i) => {
    const key = normalizeProblem(s.problem);
    if (key) takeFromPool(i, (p) => normalizeProblem(p.problem) === key);
  });
  parsedSubsections.forEach((s, i) => takeFromPool(i, (p) => !!p.doc_key && p.doc_key === s.docKey));
  parsedSubsections.forEach((s, i) => {
    const key = normalizeProblem(s.problem);
    if (key) takeGlobal(i, (p) => normalizeProblem(p.problem) === key);
  });
  parsedSubsections.forEach((s, i) => {
    const key = normalizeProblem(s.solution ?? "");
    if (key) takeGlobal(i, (p) => normalizeProblem(p.solution ?? "") === key);
  });
  parsedSubsections.forEach((_, i) => takeFromPool(i, (p) => !p.doc_key));
  return { claimed, leftoverPool: pool };
}

export async function syncDocumentToNotebook(notebookId: string, doc: any): Promise<void> {
  if (!notebookId || !doc) return;
  const parsed = parseDocumentToSections(doc);
  if (!parsed.length) return; // never wipe legacy data for an empty/unknown doc

  // ---- 1. Load the current tree ------------------------------------------
  const { data: secRows } = await supabase
    .from("notebook_sections")
    .select("id, kind, order_index, doc_key, doc_section_id")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true });
  const secList = (secRows ?? []) as {
    id: string;
    kind: string;
    order_index: number;
    doc_key: string | null;
    doc_section_id: string | null;
  }[];
  const secIds = secList.map((s) => s.id);

  const subsBySection = new Map<string, ExistingSub[]>();
  if (secIds.length) {
    const [{ data: subs }, { data: blks }] = await Promise.all([
      supabase
        .from("notebook_subsections")
        .select("id, section_id, order_index, doc_key, doc_section_id, stable_key, floating_lines, floating_bucket, floating_highlights, floating_scoring")
        .in("section_id", secIds),
      supabase
        .from("notebook_blocks")
        .select("subsection_id, kind, content_ascii")
        .in("section_id", secIds),
    ]);
    const problemBySub = new Map<string, string>();
    const solutionBySub = new Map<string, string>();
    for (const b of blks ?? []) {
      if ((b as any).kind === "problem" && (b as any).subsection_id) {
        problemBySub.set((b as any).subsection_id, String((b as any).content_ascii ?? ""));
      }
      if ((b as any).kind === "solution" && (b as any).subsection_id) {
        solutionBySub.set((b as any).subsection_id, String((b as any).content_ascii ?? ""));
      }
    }
    for (const s of subs ?? []) {
      const sid = (s as any).section_id as string;
      const list = subsBySection.get(sid) ?? [];
      list.push({
        id: (s as any).id as string,
        section_id: sid,
        order_index: Number((s as any).order_index) || 0,
        problem: problemBySub.get((s as any).id as string) ?? "",
        solution: solutionBySub.get((s as any).id as string) ?? "",
        doc_key: ((s as any).doc_key as string | null) ?? null,
        doc_section_id: ((s as any).doc_section_id as string | null) ?? null,
        stable_key: ((s as any).stable_key as string | null) ?? null,
        floating_lines: (s as any).floating_lines,
        floating_bucket: (s as any).floating_bucket,
        floating_highlights: (s as any).floating_highlights,
        floating_scoring: (s as any).floating_scoring,
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
    doc_section_id: s.doc_section_id ?? null,
    subs: subsBySection.get(s.id) ?? [],
  }));


  // ---- 2. Match parsed sections to existing rows --------------------------
  // DURABLE IDENTITY FIRST: a section claims the row carrying the same
  // `doc_key` (outline position + kind + ordinal). Only when no keyed row
  // exists do we fall back to the legacy greedy kind/order matching, so old
  // notebooks keep working while new saves become positionally exact.
  const unclaimed = new Set(existing.map((e) => e.id));
  const claimedSubIds = new Set<string>();
  const byId = new Map(existing.map((e) => [e.id, e]));

  const claimedSections = claimSectionsForEntries(
    existing,
    unclaimed,
    parsed.map((sec) => ({
      dbKind: DB_KIND[sec.kind],
      docKey: sec.docKey,
      problem: sec.subsections[0]?.problem ?? null,
      solution: sec.subsections[0]?.solution ?? null,
      docSectionId: sec.docSectionId,
    })),
  );

  for (let i = 0; i < parsed.length; i++) {
    const sec = parsed[i];
    const dbKind = DB_KIND[sec.kind];
    let target = claimedSections[i];

    if (target) {
      if (
        target.kind !== dbKind ||
        target.order_index !== i ||
        target.doc_key !== sec.docKey ||
        target.doc_section_id !== sec.docSectionId
      ) {
        await supabase
          .from("notebook_sections")
          .update({ kind: dbKind as any, order_index: i, doc_key: sec.docKey, doc_section_id: sec.docSectionId })
          .eq("id", target.id);
        target.kind = dbKind;
        target.order_index = i;
        target.doc_key = sec.docKey;
        target.doc_section_id = sec.docSectionId;
      }
    } else {
      const { data: created, error } = await supabase
        .from("notebook_sections")
        .insert({ notebook_id: notebookId, kind: dbKind as any, order_index: i, doc_key: sec.docKey, doc_section_id: sec.docSectionId })
        .select("id")
        .single();
      if (error || !created) continue;
      target = {
        id: created.id as string,
        kind: dbKind,
        order_index: i,
        doc_key: sec.docKey,
        doc_section_id: sec.docSectionId,
        subs: [],
      };
      byId.set(target.id, target);
    }

    const section: ExistingSection = target;
    const sectionId = section.id;

    if (sec.subsections.length) {
      // Match subsections: durable doc_key first, then exact problem text,
      // then a global cross-section problem-text match (so renumbering or
      // moving a question does not orphan its saved floating state), and
      // finally leftover rows in document order. Matched rows keep their id
      // AND their floating state.
      const { claimed, leftoverPool: pool } = matchSubsectionsForSection(
        section,
        existing,
        claimedSubIds,
        dbKind,
        sec.subsections.map((sub) => ({
          problem: sub.problem,
          solution: sub.solution,
          docKey: sub.docKey,
          docSectionId: sub.docSectionId,
        })),
      );

      for (let j = 0; j < sec.subsections.length; j++) {
        const { problem, solution, solutionObjects, problemObjects, docKey, docSectionId } = sec.subsections[j];
        let subId = claimed[j]?.id ?? null;
        if (subId) {
          const row = claimed[j] as ExistingSub;
          if (
            row.section_id !== sectionId ||
            row.order_index !== j ||
            row.doc_key !== docKey ||
            row.doc_section_id !== docSectionId
          ) {
            await supabase
              .from("notebook_subsections")
              .update({ section_id: sectionId, order_index: j, doc_key: docKey, doc_section_id: docSectionId })
              .eq("id", subId);
          }
        } else {
          const { data: subRow } = await supabase
            .from("notebook_subsections")
            .insert({
              section_id: sectionId,
              order_index: j,
              doc_key: docKey,
              doc_section_id: docSectionId,
            })
            .select("id")
            .single();
          if (!subRow) continue;
          subId = subRow.id as string;

          // A changed outline key must never erase preparation. If this really
          // is the same question, copy every prepared field before old rows are
          // removed. Matching consumes each source once.
          const targetCarrier: FloatingCarrier = { id: subId, doc_key: docKey, problem };
          const sourceCarriers: FloatingCarrier[] = existing.flatMap((item) => item.subs)
            .filter((item) => !claimedSubIds.has(item.id) && hasPreparedFloating(item))
            .map((item) => ({ ...item }));
          const patch = planFloatingHydration([targetCarrier], sourceCarriers)[0];
          if (patch) {
            await supabase.from("notebook_subsections").update({
              floating_lines: patch.floating_lines as never,
              floating_bucket: patch.floating_bucket as never,
              floating_highlights: patch.floating_highlights as never,
              floating_scoring: patch.floating_scoring as never,
            }).eq("id", subId);
          }
        }
        await writeBlocks(sectionId, subId, problem, solution, solutionObjects ?? [], problemObjects ?? []);
      }

      // Subsections the teacher genuinely deleted.
      const genuinelyRemoved = pool.filter((row) => !claimedSubIds.has(row.id));
      if (genuinelyRemoved.length) {
        await supabase.from("notebook_subsections").delete().in("id", genuinelyRemoved.map((p) => p.id));
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

