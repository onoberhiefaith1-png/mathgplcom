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
import {
  buildLessonOutline,
  ownerQuestionSegment,
  renderSegmentBody,
  segmentHome,
  segmentKey,
} from "@/lib/lessonnotes/lessonOutline";
import { type SolutionObject } from "@/lib/floating/solutionItems";

type Node = any;

const QUESTION_KINDS: SectionKind[] = [
  "example",
  "exercise",
  "classwork",
  "homework",
  "assessment",
  "game_questions",
];
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
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
        subsections: [
          {
            problem: body.text,
            solution: "",
            solutionObjects: [],
            problemObjects: body.objects,
            docKey: key,
            docSectionId: seg.sectionId ?? null,
          },
        ],
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
    const section = owner ? (sectionForSegment.get(owner.index) ?? null) : null;
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
  doc_key: string | null;
  doc_section_id?: string | null;
}

interface ExistingSection {
  id: string;
  kind: string;
  order_index: number;
  doc_key: string | null;
  doc_section_id?: string | null;
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
  await supabase
    .from("notebook_blocks")
    .delete()
    .eq("subsection_id", subsectionId);
  await supabase.from("notebook_blocks").insert([
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "problem" as any,
      order_index: 0,
      content_ascii: problem,
      // Objects that belong to the QUESTION (tables, diagrams, charts, 3D).
      content_json: (problemObjects.length
        ? { objects: problemObjects }
        : null) as any,
    },
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "solution" as any,
      order_index: 1,
      content_ascii: solution,
      // Tables, diagrams, charts and 3D scenes that live inside the solution.
      content_json: (solutionObjects.length
        ? { objects: solutionObjects }
        : null) as any,
    },
    {
      section_id: sectionId,
      subsection_id: subsectionId,
      kind: "reasoning" as any,
      order_index: 2,
      content_ascii: "",
    },
  ]);
}

/**
 * Claim the existing section row for one parsed outline entry. Exported for
 * testing. Each question maps 1:1 to its own section row, so this is where a
 * reordered or newly-inserted question's row is actually found (or not) —
 * text match runs first for the same reason it does in
 * matchSubsectionsForSection: a stale doc_key is a position, and matching on
 * it first can silently hand one question's row (and its Floating Numbers)
 * to a different question that now happens to sit at that same position.
 * Mutates `unclaimed` as rows are claimed.
 */
export function claimSectionForEntry(
  existing: ExistingSection[],
  unclaimed: Set<string>,
  dbKind: string,
  docKey: string,
  problem: string | null,
): ExistingSection | null {
  if (problem) {
    const key = normalizeProblem(problem);
    if (key) {
      for (const e of existing) {
        if (
          unclaimed.has(e.id) &&
          e.kind === dbKind &&
          normalizeProblem(e.subs[0]?.problem ?? "") === key
        ) {
          unclaimed.delete(e.id);
          return e;
        }
      }
    }
  }
  for (const e of existing) {
    if (unclaimed.has(e.id) && e.doc_key && e.doc_key === docKey) {
      unclaimed.delete(e.id);
      return e;
    }
  }
  for (const e of existing) {
    if (unclaimed.has(e.id) && !e.doc_key && e.kind === dbKind) {
      unclaimed.delete(e.id);
      return e;
    }
  }
  for (const e of existing) {
    if (unclaimed.has(e.id) && !e.doc_key) {
      unclaimed.delete(e.id);
      return e;
    }
  }
  return null;
}

/**
 * Match one section's parsed subsections against its existing DB rows.
 * Exported for testing — this is the exact logic that used to run inline in
 * syncDocumentToNotebook(); see that function's history for why the rules
 * are ordered this way. Mutates `existing`'s per-section `subs` lists and
 * `claimedSubIds` as rows are claimed, so repeated calls (once per parsed
 * section, in document order) still see each other's claims — needed for
 * the cross-section fallback below.
 */
export function matchSubsectionsForSection(
  section: { subs: ExistingSub[] },
  existing: ExistingSection[],
  claimedSubIds: Set<string>,
  dbKind: string,
  parsedSubsections: { problem: string; docKey: string; docSectionId?: string | null }[],
): { claimed: (ExistingSub | null)[]; leftoverPool: ExistingSub[] } {
  const pool = [...section.subs];

  // EXACT TEXT WINS OVER A STALE KEY. doc_key is POSITIONAL
  // (index:kind:ordinal, see lessonOutline.ts segmentKey), not a durable id:
  // inserting or moving a same-kind question shifts every doc_key below it,
  // even when no question's own text changed. If key-matching ran first, a
  // row's now-stale key can coincidentally equal a DIFFERENT question's new
  // key (whatever now occupies that same position) — silently handing that
  // question someone else's saved Floating Numbers, while the row's own
  // question either steals another row in turn or is treated as new and
  // loses its own history. Matching unchanged problem text first, before any
  // key is consulted, keeps a row with its own question through a reorder or
  // an insertion above it; doc_key remains useful below only for a question
  // that was genuinely re-worded while staying in the same position, where
  // no exact text match exists to find it by.
  // The heading's permanent id beats everything: it survives re-wording AND
  // moving, the one case text and position together cannot recover.
  const takeById = (id?: string | null): ExistingSub | null => {
    if (!id) return null;
    const idx = pool.findIndex((p) => p.doc_section_id === id);
    if (idx === -1) return null;
    const sub = pool.splice(idx, 1)[0];
    claimedSubIds.add(sub.id);
    return sub;
  };

  const takeByProblem = (problem: string): ExistingSub | null => {
    const key = normalizeProblem(problem);
    if (!key) return null;
    const idx = pool.findIndex((p) => normalizeProblem(p.problem) === key);
    if (idx === -1) return null;
    const sub = pool.splice(idx, 1)[0];
    claimedSubIds.add(sub.id);
    return sub;
  };

  const takeByProblemGlobal = (
    problem: string,
    kind: string,
  ): ExistingSub | null => {
    const key = normalizeProblem(problem);
    if (!key) return null;
    for (const e of existing) {
      if (e.kind !== kind) continue;
      const idx = e.subs.findIndex(
        (p) => !claimedSubIds.has(p.id) && normalizeProblem(p.problem) === key,
      );
      if (idx !== -1) {
        const sub = e.subs.splice(idx, 1)[0];
        claimedSubIds.add(sub.id);
        return sub;
      }
    }
    return null;
  };

  // Last resort for a question whose text genuinely changed while it stayed
  // in the same position — no exact text match exists to find it by, so its
  // (still-accurate, since it didn't move) doc_key is the only signal left.
  const takeByKey = (docKey: string): ExistingSub | null => {
    const idx = pool.findIndex((p) => p.doc_key && p.doc_key === docKey);
    if (idx === -1) return null;
    const sub = pool.splice(idx, 1)[0];
    claimedSubIds.add(sub.id);
    return sub;
  };

  // THREE FULL PASSES, not one greedy pass per item: if item 1 fell through
  // to a stale-key match before item 2 got a chance to claim that same row by
  // its own correct, unchanged text, the row would go to the wrong question.
  // Running every item's strongest available match to completion before any
  // item is allowed to try its next-best match means a row's rightful
  // text-match owner always claims it first, regardless of processing order.
  const claimed: (ExistingSub | null)[] = new Array(
    parsedSubsections.length,
  ).fill(null);
  for (let j = 0; j < parsedSubsections.length; j++) {
    claimed[j] = takeById(parsedSubsections[j].docSectionId);
  }
  for (let j = 0; j < parsedSubsections.length; j++) {
    if (!claimed[j]) claimed[j] = takeByProblem(parsedSubsections[j].problem);
  }
  for (let j = 0; j < parsedSubsections.length; j++) {
    if (!claimed[j]) claimed[j] = takeByKey(parsedSubsections[j].docKey);
  }
  for (let j = 0; j < parsedSubsections.length; j++) {
    if (!claimed[j])
      claimed[j] = takeByProblemGlobal(parsedSubsections[j].problem, dbKind);
  }
  for (let j = 0; j < claimed.length; j++) {
    if (!claimed[j] && pool.length) {
      const idx = pool.findIndex((p) => !p.doc_key);
      if (idx !== -1) {
        const sub = pool.splice(idx, 1)[0];
        claimedSubIds.add(sub.id);
        claimed[j] = sub;
      }
    }
  }
  return { claimed, leftoverPool: pool };
}

/**
 * Claim section rows for EVERY parsed entry in full passes: all exact-text
 * matches first, then all doc_key matches, then the legacy fallbacks. One
 * greedy pass per entry let a brand-new question inserted above an existing
 * one claim that question's stale positional key before its rightful owner was
 * even considered, silently handing over its saved Floating Numbers.
 */
export function claimSectionsForEntries(
  existing: ExistingSection[],
  unclaimed: Set<string>,
  entries: {
    dbKind: string;
    docKey: string;
    problem: string | null;
    docSectionId?: string | null;
  }[],
): (ExistingSection | null)[] {
  const claimed: (ExistingSection | null)[] = new Array(entries.length).fill(
    null,
  );
  const take = (i: number, match: (e: ExistingSection) => boolean) => {
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
    if (claimed[i]) return;
    const key = entry.problem ? normalizeProblem(entry.problem) : "";
    if (!key) return;
    take(
      i,
      (e) =>
        e.kind === entry.dbKind &&
        normalizeProblem(e.subs[0]?.problem ?? "") === key,
    );
  });
  entries.forEach((entry, i) => {
    if (!claimed[i])
      take(i, (e) => !!e.doc_key && e.doc_key === entry.docKey);
  });
  entries.forEach((entry, i) => {
    if (!claimed[i]) take(i, (e) => !e.doc_key && e.kind === entry.dbKind);
  });
  entries.forEach((_, i) => {
    if (!claimed[i]) take(i, (e) => !e.doc_key);
  });
  return claimed;
}

export async function syncDocumentToNotebook(
  notebookId: string,
  doc: any,
): Promise<void> {
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
        .select("id, section_id, order_index, doc_key, doc_section_id")
        .in("section_id", secIds),
      supabase
        .from("notebook_blocks")
        .select("subsection_id, kind, content_ascii")
        .in("section_id", secIds),
    ]);
    const problemBySub = new Map<string, string>();
    for (const b of blks ?? []) {
      if ((b as any).kind === "problem" && (b as any).subsection_id) {
        problemBySub.set(
          (b as any).subsection_id,
          String((b as any).content_ascii ?? ""),
        );
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
        doc_key: ((s as any).doc_key as string | null) ?? null,
        doc_section_id: ((s as any).doc_section_id as string | null) ?? null,
      });
      subsBySection.set(sid, list);
    }

    for (const list of subsBySection.values())
      list.sort((a, b) => a.order_index - b.order_index);
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
  // A question section claims its row by the row's OWN unchanged problem
  // text first (see claimSectionForEntry — same reasoning as
  // matchSubsectionsForSection: doc_key is positional, not durable, so a
  // stale key can coincidentally belong to whatever question now occupies
  // that position). Only when no text match exists do we fall to doc_key,
  // then the legacy greedy kind/order matching for pre-doc_key notebooks.
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
        (target.doc_section_id ?? null) !== sec.docSectionId
      ) {
        await supabase
          .from("notebook_sections")
          .update({
            kind: dbKind as any,
            order_index: i,
            doc_key: sec.docKey,
            doc_section_id: sec.docSectionId,
          })
          .eq("id", target.id);
        target.kind = dbKind;
        target.order_index = i;
        target.doc_key = sec.docKey;
        target.doc_section_id = sec.docSectionId;
      }
    } else {
      const { data: created, error } = await supabase
        .from("notebook_sections")
        .insert({
          notebook_id: notebookId,
          kind: dbKind as any,
          order_index: i,
          doc_key: sec.docKey,
          doc_section_id: sec.docSectionId,
        })
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
      // AND their floating state. See matchSubsectionsForSection for the
      // matching rules themselves (extracted so they're unit-testable).
      const { claimed, leftoverPool: pool } = matchSubsectionsForSection(
        section,
        existing,
        claimedSubIds,
        dbKind,
        sec.subsections.map((s) => ({
          problem: s.problem,
          docKey: s.docKey,
          docSectionId: s.docSectionId,
        })),
      );

      for (let j = 0; j < sec.subsections.length; j++) {
        const {
          problem,
          solution,
          solutionObjects,
          problemObjects,
          docKey,
          docSectionId,
        } = sec.subsections[j];
        let subId = claimed[j]?.id ?? null;
        if (subId) {
          const row = claimed[j] as ExistingSub;
          if (
            row.section_id !== sectionId ||
            row.order_index !== j ||
            row.doc_key !== docKey ||
            (row.doc_section_id ?? null) !== docSectionId
          ) {
            await supabase
              .from("notebook_subsections")
              .update({
                section_id: sectionId,
                order_index: j,
                doc_key: docKey,
                doc_section_id: docSectionId,
              })
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
              floating_highlights: null,
              floating_lines: [],
              floating_bucket: null,
            })
            .select("id")
            .single();
          if (!subRow) continue;
          subId = subRow.id as string;
        }
        await writeBlocks(
          sectionId,
          subId,
          problem,
          solution,
          solutionObjects ?? [],
          problemObjects ?? [],
        );
      }

      // Subsections the teacher genuinely deleted.
      if (pool.length) {
        await supabase
          .from("notebook_subsections")
          .delete()
          .in(
            "id",
            pool.map((p) => p.id),
          );
      }
    } else {
      // Loose (non-question) section — its blocks are disposable.
      if (section.subs.length) {
        await supabase
          .from("notebook_subsections")
          .delete()
          .in(
            "id",
            section.subs.map((p) => p.id),
          );
      }

      await supabase
        .from("notebook_blocks")
        .delete()
        .eq("section_id", sectionId)
        .is("subsection_id", null);
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
    await supabase
      .from("notebook_sections")
      .delete()
      .in("id", Array.from(unclaimed));
  }
}
