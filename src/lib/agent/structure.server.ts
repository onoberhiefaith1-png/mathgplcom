// The assistant's hands on a lesson note that already exists.
//
// Everything before this module could only add: a new note, a new session, more
// lines at the end. This module is the repair kit — read the whole note as a
// structure, change a line, move a question into a proper session, reorder,
// remove a duplicate once the teacher has said yes, and put the note back if a
// repair goes wrong.
//
// Two rules run through every executor here:
//   1. A move never rewrites mathematics. `content_ascii` travels untouched.
//   2. Nothing is reported that was not read back from the saved note.

import type { SupabaseClient } from "@supabase/supabase-js";

import { tokenizeMath } from "@/lib/notebook/mathTokens";
import { mintLineUid } from "@/lib/lessonnotes/lineIdentity";
import { describeCleanup, planCleanup } from "./noteHygiene";

type AnyDb = { from: (table: string) => any };
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
const ids = (args: Args, key: string): string[] => {
  const v = args[key];
  if (!Array.isArray(v)) throw new Error(`Argument "${key}" must be a list of ids.`);
  const out = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
  if (out.length === 0) throw new Error(`Argument "${key}" is empty.`);
  return out;
};
const optIds = (args: Args, key: string): string[] => {
  const v = args[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
};
const int = (args: Args, key: string): number | undefined => {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : undefined;
};

const SECTION_KINDS = [
  "introduction",
  "explanation",
  "example",
  "exercise",
  "classwork",
  "homework",
  "summary",
] as const;
const SESSION_KINDS = ["example", "exercise", "classwork", "homework"] as const;
const BLOCK_KINDS = ["problem", "solution", "reasoning", "text"] as const;

type BlockRow = {
  id: string;
  section_id: string;
  subsection_id: string | null;
  kind: string;
  content_ascii: string;
  order_index: number;
};
type SectionRow = { id: string; notebook_id: string; kind: string; title: string | null; order_index: number };
type SubRow = {
  id: string;
  section_id: string;
  order_index: number;
  floating_lines: unknown;
  floating_highlights: unknown;
};

/** The whole note, in one read: sections, sessions, lines. */
async function readTree(ctx: Ctx, notebookId: string) {
  const db = ctx.supabase as unknown as AnyDb;
  const { data: notebook, error } = await db
    .from("notebooks")
    .select("id, title, subject, subtopic, owner_id")
    .eq("id", notebookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!notebook) throw new Error("That lesson note was not found, or it is not yours.");

  const { data: sections } = await db
    .from("notebook_sections")
    .select("id, notebook_id, kind, title, order_index")
    .eq("notebook_id", notebookId)
    .order("order_index", { ascending: true });
  const sectionRows = (sections ?? []) as SectionRow[];
  const sectionIds = sectionRows.map((s) => s.id);

  let subRows: SubRow[] = [];
  let blockRows: BlockRow[] = [];
  if (sectionIds.length) {
    const [{ data: subs }, { data: blocks }] = await Promise.all([
      db
        .from("notebook_subsections")
        .select("id, section_id, order_index, floating_lines, floating_highlights")
        .in("section_id", sectionIds)
        .order("order_index", { ascending: true }),
      db
        .from("notebook_blocks")
        .select("id, section_id, subsection_id, kind, content_ascii, order_index")
        .in("section_id", sectionIds)
        .order("order_index", { ascending: true }),
    ]);
    subRows = (subs ?? []) as SubRow[];
    blockRows = (blocks ?? []) as BlockRow[];
  }

  return { notebook: notebook as { id: string; title: string | null; owner_id: string }, sectionRows, subRows, blockRows };
}

const listOf = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Do the saved chips still match the solution now written under a question? */
function chipsFresh(sub: SubRow, solutionLines: string[]): boolean | null {
  const highlights = listOf(sub.floating_highlights).filter((h) => !h?.notebookOnly);
  const chips = listOf(sub.floating_lines);
  if (chips.length === 0) return null;
  if (highlights.length !== solutionLines.length) return false;
  return highlights.every((h, i) => String(h?.payload ?? "").trim() === (solutionLines[i] ?? "").trim());
}

function describeTree(tree: Awaited<ReturnType<typeof readTree>>) {
  const { sectionRows, subRows, blockRows } = tree;
  const linesOf = (sectionId: string, subsectionId: string | null) =>
    blockRows
      .filter((b) => b.section_id === sectionId && (b.subsection_id ?? null) === subsectionId)
      .sort((a, b) => a.order_index - b.order_index)
      .map((b) => ({ blockId: b.id, kind: b.kind, order: b.order_index, text: b.content_ascii }));

  const sections = sectionRows.map((s) => {
    const sessions = subRows
      .filter((sub) => sub.section_id === s.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map((sub) => {
        const lines = linesOf(s.id, sub.id);
        const solution = lines.filter((l) => l.kind === "solution").map((l) => l.text);
        const missing: string[] = [];
        if (!lines.some((l) => l.kind === "problem")) missing.push("no question written");
        if (solution.length === 0) missing.push("no solution written");
        if (listOf(sub.floating_highlights).length === 0) missing.push("solution not highlighted");
        if (listOf(sub.floating_lines).length === 0) missing.push("no Floating Numbers generated");
        const fresh = chipsFresh(sub, solution);
        if (fresh === false) missing.push("Floating Numbers no longer match the solution");
        return {
          subsectionId: sub.id,
          order: sub.order_index,
          lines,
          highlighted: listOf(sub.floating_highlights).length,
          floatingLines: listOf(sub.floating_lines).length,
          chipsMatchSolution: fresh,
          missing,
        };
      });
    const loose = linesOf(s.id, null);
    return {
      sectionId: s.id,
      kind: s.kind,
      title: s.title,
      order: s.order_index,
      /** Lines sitting directly in the section, outside any session. */
      looseLines: loose,
      /** A question written as a loose line cannot be taught on the Smartboard. */
      looseQuestions: loose.filter((l) => l.kind === "problem").length,
      sessions,
    };
  });

  const strays = sections.filter((s) => s.looseQuestions > 0);
  return {
    sections,
    warnings: strays.map(
      (s) =>
        `The ${s.kind} section holds ${s.looseQuestions} question line${s.looseQuestions === 1 ? "" : "s"} outside any session — the Smartboard cannot step through ${s.looseQuestions === 1 ? "it" : "them"}. Move ${s.looseQuestions === 1 ? "it" : "each one"} into its own session with promote_to_session.`,
    ),
  };
}

async function ownedNotebook(ctx: Ctx, notebookId: string) {
  const db = ctx.supabase as unknown as AnyDb;
  const { data } = await db.from("notebooks").select("id, owner_id, title").eq("id", notebookId).maybeSingle();
  if (!data) throw new Error("That lesson note was not found, or it is not yours.");
  if (data.owner_id !== ctx.userId) throw new Error("That lesson note belongs to somebody else.");
  return data as { id: string; owner_id: string; title: string | null };
}

/** Which notebook a block belongs to, so every edit can be checked for ownership. */
async function blockHome(ctx: Ctx, blockIds: string[]) {
  const db = ctx.supabase as unknown as AnyDb;
  const { data } = await db
    .from("notebook_blocks")
    .select("id, section_id, subsection_id, kind, content_ascii, order_index")
    .in("id", blockIds);
  const rows = (data ?? []) as BlockRow[];
  if (rows.length !== blockIds.length) throw new Error("One of those lines no longer exists. Read the note again.");
  const sectionIds = [...new Set(rows.map((r) => r.section_id))];
  const { data: sections } = await db.from("notebook_sections").select("id, notebook_id").in("id", sectionIds);
  const map = Object.fromEntries(((sections ?? []) as { id: string; notebook_id: string }[]).map((s) => [s.id, s.notebook_id]));
  const notebookIds = [...new Set(rows.map((r) => map[r.section_id]))].filter(Boolean) as string[];
  if (notebookIds.length !== 1) throw new Error("Those lines are not all in the same lesson note.");
  await ownedNotebook(ctx, notebookIds[0]!);
  return { rows, notebookId: notebookIds[0]! };
}

/** Make room at `at` inside one container, then return the indices to use. */
async function makeRoom(
  ctx: Ctx,
  sectionId: string,
  subsectionId: string | null,
  at: number | undefined,
  count: number,
): Promise<number[]> {
  const db = ctx.supabase as unknown as AnyDb;
  let query = db.from("notebook_blocks").select("id, order_index").eq("section_id", sectionId);
  query = subsectionId ? query.eq("subsection_id", subsectionId) : query.is("subsection_id", null);
  const { data } = await query.order("order_index", { ascending: true });
  const rows = (data ?? []) as { id: string; order_index: number }[];
  const start = at === undefined ? rows.length : Math.min(at, rows.length);
  const after = rows.slice(start);
  for (let i = 0; i < after.length; i += 1) {
    const row = after[i]!;
    await db.from("notebook_blocks").update({ order_index: start + count + i }).eq("id", row.id);
  }
  return Array.from({ length: count }, (_v, i) => start + i);
}

type Executor = (
  ctx: Ctx,
  args: Args,
) => Promise<{ data: unknown; summary: string; navigateTo?: string }>;

export const structureExecutors: Record<string, Executor> = {
  inspect_lesson_note: async (ctx, args) => {
    const notebookId = need(args, "notebookId");
    const tree = await readTree(ctx, notebookId);
    const described = describeTree(tree);
    const sessions = described.sections.reduce((n, s) => n + s.sessions.length, 0);
    return {
      data: {
        notebookId,
        title: tree.notebook.title,
        sections: described.sections,
        warnings: described.warnings,
      },
      summary: `Read "${tree.notebook.title ?? "Untitled"}": ${described.sections.length} section${described.sections.length === 1 ? "" : "s"}, ${sessions} session${sessions === 1 ? "" : "s"}${described.warnings.length ? `, ${described.warnings.length} problem${described.warnings.length === 1 ? "" : "s"} found` : ""}.`,
    };
  },

  edit_lesson_text: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const text = typeof args["text"] === "string" ? (args["text"] as string) : undefined;
    const blockId = str(args, "blockId");
    const sectionId = str(args, "sectionId");
    const notebookId = str(args, "notebookId");

    if (blockId) {
      if (text === undefined) throw new Error('Give the new "text" for that line.');
      const { rows } = await blockHome(ctx, [blockId]);
      const before = rows[0]!;
      const { error } = await db.from("notebook_blocks").update({ content_ascii: text }).eq("id", blockId);
      if (error) throw new Error(error.message);
      const { data: after } = await db
        .from("notebook_blocks")
        .select("id, kind, content_ascii")
        .eq("id", blockId)
        .maybeSingle();
      if (!after || after.content_ascii !== text) throw new Error("That line did not save. Nothing was changed.");
      return {
        data: { blockId, kind: after.kind, before: before.content_ascii, after: after.content_ascii },
        summary: `Changed one ${after.kind} line.`,
      };
    }

    if (sectionId) {
      const title = str(args, "title") ?? text;
      const { data: section } = await db
        .from("notebook_sections")
        .select("id, notebook_id")
        .eq("id", sectionId)
        .maybeSingle();
      if (!section) throw new Error("That session was not found.");
      await ownedNotebook(ctx, section.notebook_id);
      const { error } = await db.from("notebook_sections").update({ title: title ?? null }).eq("id", sectionId);
      if (error) throw new Error(error.message);
      const { data: after } = await db.from("notebook_sections").select("id, title, kind").eq("id", sectionId).maybeSingle();
      return { data: after, summary: `Renamed that ${after?.kind ?? "session"} to "${after?.title ?? ""}".` };
    }

    if (notebookId) {
      const title = str(args, "title") ?? text;
      if (!title) throw new Error('Give the new "title" for the lesson note.');
      await ownedNotebook(ctx, notebookId);
      const { error } = await db.from("notebooks").update({ title }).eq("id", notebookId);
      if (error) throw new Error(error.message);
      const { data: after } = await db.from("notebooks").select("id, title").eq("id", notebookId).maybeSingle();
      if (after?.title !== title) throw new Error("The title did not save.");
      return { data: after, summary: `Renamed the lesson note to "${title}".` };
    }

    throw new Error("Say what to change: a blockId, a sectionId, or a notebookId.");
  },


  move_lesson_lines: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const blockIds = ids(args, "blockIds");
    const { rows, notebookId } = await blockHome(ctx, blockIds);

    const subsectionId = str(args, "toSubsectionId");
    let sectionId = str(args, "toSectionId");
    if (subsectionId) {
      const { data: sub } = await db.from("notebook_subsections").select("id, section_id").eq("id", subsectionId).maybeSingle();
      if (!sub) throw new Error("That destination session was not found.");
      sectionId = String(sub.section_id);
    }
    if (!sectionId) throw new Error("Say where the lines should go: toSectionId or toSubsectionId.");
    const { data: section } = await db.from("notebook_sections").select("id, notebook_id").eq("id", sectionId).maybeSingle();
    if (!section) throw new Error("That destination section was not found.");
    if (String(section.notebook_id) !== notebookId) {
      throw new Error("Lines can only move inside the same lesson note.");
    }

    const ordered = blockIds.map((id) => rows.find((r) => r.id === id)!);
    const slots = await makeRoom(ctx, sectionId, subsectionId ?? null, int(args, "at"), ordered.length);
    for (let i = 0; i < ordered.length; i += 1) {
      const { error } = await db
        .from("notebook_blocks")
        .update({ section_id: sectionId, subsection_id: subsectionId ?? null, order_index: slots[i]! })
        .eq("id", ordered[i]!.id);
      if (error) throw new Error(error.message);
    }

    const { data: after } = await db
      .from("notebook_blocks")
      .select("id, section_id, subsection_id, content_ascii, order_index")
      .in("id", blockIds);
    const landed = (after ?? []) as BlockRow[];
    const wrong = landed.filter((b) => b.section_id !== sectionId || (b.subsection_id ?? null) !== (subsectionId ?? null));
    if (wrong.length) throw new Error("Some lines did not move. Read the note again before reporting anything.");
    const changed = landed.filter((b) => {
      const before = ordered.find((o) => o.id === b.id)!;
      return before.content_ascii !== b.content_ascii;
    });
    if (changed.length) throw new Error("A line's text changed during the move. Stopped so nothing is lost.");

    return {
      data: {
        moved: landed.length,
        toSectionId: sectionId,
        toSubsectionId: subsectionId ?? null,
        texts: landed.map((b) => b.content_ascii),
      },
      summary: `Moved ${landed.length} line${landed.length === 1 ? "" : "s"} across, word for word.`,
    };
  },

  promote_to_session: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const kindArg = (str(args, "kind") ?? "example").toLowerCase();
    const kind = (SESSION_KINDS as readonly string[]).includes(kindArg) ? kindArg : "example";
    const questionIds = ids(args, "questionBlockIds");
    const solutionIds = optIds(args, "solutionBlockIds");
    const all = [...questionIds, ...solutionIds];
    const { rows, notebookId } = await blockHome(ctx, all);
    await ownedNotebook(ctx, notebookId);

    const { data: sections } = await db
      .from("notebook_sections")
      .select("id, order_index")
      .eq("notebook_id", notebookId)
      .order("order_index", { ascending: false })
      .limit(1);
    const order = ((((sections ?? []) as SectionRow[])[0]?.order_index ?? -1) as number) + 1;

    const { data: section, error: sectionError } = await db
      .from("notebook_sections")
      .insert({ notebook_id: notebookId, kind, title: str(args, "title") ?? null, order_index: order })
      .select("id, kind, title")
      .single();
    if (sectionError || !section) throw new Error(sectionError?.message ?? "Could not create the session.");

    const { data: sub, error: subError } = await db
      .from("notebook_subsections")
      .insert({ section_id: section.id, order_index: 0 })
      .select("id")
      .single();
    if (subError || !sub) throw new Error(subError?.message ?? "Could not create the question area.");

    let slot = 0;
    const move = async (blockId: string, blockKind: string) => {
      const { error } = await db
        .from("notebook_blocks")
        .update({ section_id: section.id, subsection_id: sub.id, kind: blockKind, order_index: slot++ })
        .eq("id", blockId);
      if (error) throw new Error(error.message);
    };
    for (const id of questionIds) await move(id, "problem");
    for (const id of solutionIds) await move(id, "solution");

    const { data: after } = await db
      .from("notebook_blocks")
      .select("id, kind, content_ascii, subsection_id, order_index")
      .eq("subsection_id", sub.id)
      .order("order_index", { ascending: true });
    const landed = (after ?? []) as BlockRow[];
    if (landed.length !== all.length) throw new Error("Not every line reached the new session. Read the note again.");
    for (const row of landed) {
      const before = rows.find((r) => r.id === row.id);
      if (before && before.content_ascii !== row.content_ascii) {
        throw new Error("A line's text changed while moving. Stopped so nothing is lost.");
      }
    }

    return {
      data: {
        notebookId,
        sectionId: section.id,
        subsectionId: sub.id,
        kind,
        question: landed.filter((b) => b.kind === "problem").map((b) => b.content_ascii),
        solution: landed.filter((b) => b.kind === "solution").map((b) => b.content_ascii),
        nextStep: "highlight_solution",
      },
      summary: `Made a ${kind} session and moved the question${solutionIds.length ? " and its solution" : ""} into it, unchanged.`,
    };
  },

  reorder_lesson: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const scope = (str(args, "scope") ?? "").toLowerCase();
    const order = ids(args, "orderedIds");

    if (scope === "sections") {
      const notebookId = need(args, "notebookId");
      await ownedNotebook(ctx, notebookId);
      const { data } = await db.from("notebook_sections").select("id").eq("notebook_id", notebookId);
      const known = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
      if (order.length !== known.size || order.some((id) => !known.has(id))) {
        throw new Error("List every section of the note exactly once, in the new order.");
      }
      for (let i = 0; i < order.length; i += 1) {
        await db.from("notebook_sections").update({ order_index: i }).eq("id", order[i]!);
      }
      const { data: after } = await db
        .from("notebook_sections")
        .select("id, kind, title, order_index")
        .eq("notebook_id", notebookId)
        .order("order_index", { ascending: true });
      return { data: after ?? [], summary: `Reordered ${order.length} sections.` };
    }

    if (scope === "sessions") {
      const sectionId = need(args, "sectionId");
      const { data: section } = await db.from("notebook_sections").select("id, notebook_id").eq("id", sectionId).maybeSingle();
      if (!section) throw new Error("That section was not found.");
      await ownedNotebook(ctx, section.notebook_id);
      const { data } = await db.from("notebook_subsections").select("id").eq("section_id", sectionId);
      const known = new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
      if (order.length !== known.size || order.some((id) => !known.has(id))) {
        throw new Error("List every session in that section exactly once, in the new order.");
      }
      for (let i = 0; i < order.length; i += 1) {
        await db.from("notebook_subsections").update({ order_index: i }).eq("id", order[i]!);
      }
      return { data: { sectionId, order }, summary: `Reordered ${order.length} sessions.` };
    }

    if (scope === "blocks" || scope === "lines") {
      const { rows } = await blockHome(ctx, order);
      const container = rows[0]!;
      const sameHome = rows.every(
        (r) => r.section_id === container.section_id && (r.subsection_id ?? null) === (container.subsection_id ?? null),
      );
      if (!sameHome) throw new Error("Reorder lines that sit in the same session; use move_lesson_lines to move them.");
      for (let i = 0; i < order.length; i += 1) {
        await db.from("notebook_blocks").update({ order_index: i }).eq("id", order[i]!);
      }
      const { data: after } = await db
        .from("notebook_blocks")
        .select("id, kind, content_ascii, order_index")
        .in("id", order)
        .order("order_index", { ascending: true });
      return { data: after ?? [], summary: `Reordered ${order.length} lines.` };
    }

    throw new Error('Argument "scope" must be "sections", "sessions" or "blocks".');
  },

  preview_removal: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const blockIds = optIds(args, "blockIds");
    const subsectionId = str(args, "subsectionId");
    const sectionId = str(args, "sectionId");

    if (blockIds.length) {
      const { rows } = await blockHome(ctx, blockIds);
      return {
        data: { blockIds, lines: rows.map((r) => ({ kind: r.kind, text: r.content_ascii })) },
        summary: `These ${rows.length} line${rows.length === 1 ? "" : "s"} would go: ${rows.map((r) => r.content_ascii).join(" / ")}`,
      };
    }
    if (subsectionId) {
      const { data: sub } = await db.from("notebook_subsections").select("id, section_id").eq("id", subsectionId).maybeSingle();
      if (!sub) throw new Error("That session was not found.");
      const { data: blocks } = await db
        .from("notebook_blocks")
        .select("id, kind, content_ascii")
        .eq("subsection_id", subsectionId)
        .order("order_index", { ascending: true });
      const rows = (blocks ?? []) as BlockRow[];
      return {
        data: { subsectionId, lines: rows.map((r) => ({ kind: r.kind, text: r.content_ascii })) },
        summary: rows.length
          ? `Removing that session would also remove ${rows.length} line${rows.length === 1 ? "" : "s"}: ${rows.map((r) => r.content_ascii).join(" / ")}`
          : "That session is empty, so nothing written would be lost.",
      };
    }
    if (sectionId) {
      const { data: blocks } = await db.from("notebook_blocks").select("id, kind, content_ascii").eq("section_id", sectionId);
      const rows = (blocks ?? []) as BlockRow[];
      return {
        data: { sectionId, lines: rows.map((r) => ({ kind: r.kind, text: r.content_ascii })) },
        summary: `Removing that section would remove ${rows.length} line${rows.length === 1 ? "" : "s"}.`,
      };
    }
    throw new Error("Say what to preview: blockIds, a subsectionId or a sectionId.");
  },

  delete_lesson_content: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const blockIds = optIds(args, "blockIds");
    const subsectionId = str(args, "subsectionId");
    const sectionId = str(args, "sectionId");

    if (blockIds.length) {
      const { rows } = await blockHome(ctx, blockIds);
      const { error } = await db.from("notebook_blocks").delete().in("id", blockIds);
      if (error) throw new Error(error.message);
      const { data: left } = await db.from("notebook_blocks").select("id").in("id", blockIds);
      if (((left ?? []) as unknown[]).length) throw new Error("Some lines are still there. Nothing more was removed.");
      return {
        data: { removed: rows.map((r) => r.content_ascii) },
        summary: `Removed ${rows.length} line${rows.length === 1 ? "" : "s"}.`,
      };
    }

    if (subsectionId) {
      const { data: sub } = await db.from("notebook_subsections").select("id, section_id").eq("id", subsectionId).maybeSingle();
      if (!sub) throw new Error("That session was not found.");
      const { data: section } = await db
        .from("notebook_sections")
        .select("id, notebook_id")
        .eq("id", sub.section_id)
        .maybeSingle();
      if (!section) throw new Error("That session has no section above it.");
      await ownedNotebook(ctx, section.notebook_id);
      await db.from("notebook_blocks").delete().eq("subsection_id", subsectionId);
      const { error } = await db.from("notebook_subsections").delete().eq("id", subsectionId);
      if (error) throw new Error(error.message);
      const { data: left } = await db.from("notebook_subsections").select("id").eq("id", subsectionId).maybeSingle();
      if (left) throw new Error("That session is still there.");
      return { data: { subsectionId }, summary: "Removed that session." };
    }

    if (sectionId) {
      const { data: section } = await db.from("notebook_sections").select("id, notebook_id, kind").eq("id", sectionId).maybeSingle();
      if (!section) throw new Error("That section was not found.");
      await ownedNotebook(ctx, section.notebook_id);
      await db.from("notebook_blocks").delete().eq("section_id", sectionId);
      await db.from("notebook_subsections").delete().eq("section_id", sectionId);
      const { error } = await db.from("notebook_sections").delete().eq("id", sectionId);
      if (error) throw new Error(error.message);
      return { data: { sectionId }, summary: `Removed that ${section.kind} section.` };
    }

    throw new Error("Say what to remove: blockIds, a subsectionId or a sectionId.");
  },

  snapshot_lesson_note: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    await ownedNotebook(ctx, notebookId);
    const tree = await readTree(ctx, notebookId);
    const snapshot = {
      sections: tree.sectionRows,
      subsections: tree.subRows,
      blocks: tree.blockRows,
    };
    const { data, error } = await db
      .from("notebook_restore_points")
      .insert({
        notebook_id: notebookId,
        owner_id: ctx.userId,
        label: str(args, "label") ?? "Before repair",
        snapshot,
      })
      .select("id, label, created_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      data: {
        restorePointId: data?.id ?? null,
        label: data?.label ?? null,
        sections: tree.sectionRows.length,
        sessions: tree.subRows.length,
        lines: tree.blockRows.length,
      },
      summary: `Saved a restore point of this note (${tree.sectionRows.length} sections, ${tree.blockRows.length} lines) before making changes.`,
    };
  },

  list_restore_points: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    await ownedNotebook(ctx, notebookId);
    const { data, error } = await db
      .from("notebook_restore_points")
      .select("id, label, created_at")
      .eq("notebook_id", notebookId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; label: string }[];
    return { data: rows, summary: `${rows.length} restore point${rows.length === 1 ? "" : "s"} saved for this note.` };
  },

  restore_lesson_note: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    await ownedNotebook(ctx, notebookId);
    const pointId = str(args, "restorePointId");
    let query = db
      .from("notebook_restore_points")
      .select("id, label, snapshot, created_at")
      .eq("notebook_id", notebookId);
    if (pointId) query = query.eq("id", pointId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    const point = ((data ?? []) as { id: string; label: string; snapshot: any }[])[0];
    if (!point) throw new Error("There is no restore point for this note, so nothing can be put back.");

    const snapshot = point.snapshot ?? {};
    const sections = (snapshot.sections ?? []) as SectionRow[];
    const subsections = (snapshot.subsections ?? []) as SubRow[];
    const blocks = (snapshot.blocks ?? []) as BlockRow[];

    const { data: current } = await db.from("notebook_sections").select("id").eq("notebook_id", notebookId);
    const currentIds = ((current ?? []) as { id: string }[]).map((r) => r.id);
    if (currentIds.length) {
      await db.from("notebook_blocks").delete().in("section_id", currentIds);
      await db.from("notebook_subsections").delete().in("section_id", currentIds);
      await db.from("notebook_sections").delete().in("id", currentIds);
    }
    if (sections.length) {
      const { error: se } = await db.from("notebook_sections").insert(sections);
      if (se) throw new Error(se.message);
    }
    if (subsections.length) {
      const { error: sse } = await db.from("notebook_subsections").insert(subsections);
      if (sse) throw new Error(sse.message);
    }
    if (blocks.length) {
      const { error: be } = await db.from("notebook_blocks").insert(blocks);
      if (be) throw new Error(be.message);
    }

    const after = await readTree(ctx, notebookId);
    if (after.blockRows.length !== blocks.length) {
      throw new Error("The note was not fully put back. Read it before reporting anything.");
    }
    return {
      data: {
        notebookId,
        restorePointId: point.id,
        label: point.label,
        sections: after.sectionRows.length,
        lines: after.blockRows.length,
      },
      summary: `Put the note back to "${point.label}" — ${after.sectionRows.length} sections and ${after.blockRows.length} lines.`,
      navigateTo: `/lesson-notes/${notebookId}`,
    };
  },

  inspect_board_state: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const subsectionId = need(args, "subsectionId");
    const { data: sub } = await db
      .from("notebook_subsections")
      .select("id, section_id, floating_lines, floating_highlights")
      .eq("id", subsectionId)
      .maybeSingle();
    if (!sub) throw new Error("That session was not found.");
    const { data: section } = await db
      .from("notebook_sections")
      .select("id, notebook_id, kind, title")
      .eq("id", sub.section_id)
      .maybeSingle();
    if (!section) throw new Error("That session has no section above it.");
    const { data: blocks } = await db
      .from("notebook_blocks")
      .select("kind, content_ascii, order_index")
      .eq("subsection_id", subsectionId)
      .order("order_index", { ascending: true });
    const rows = (blocks ?? []) as BlockRow[];
    const solution = rows.filter((b) => b.kind === "solution").map((b) => b.content_ascii);
    const fresh = chipsFresh(sub as SubRow, solution);

    const classId = str(args, "classId");
    let board: unknown = null;
    if (classId) {
      const { data: state } = await db
        .from("class_smartboard_state")
        .select("class_id, notebook_id, state_json, active_student_id, updated_at")
        .eq("class_id", classId)
        .maybeSingle();
      board = state ?? null;
    }

    return {
      data: {
        subsectionId,
        notebookId: section.notebook_id,
        sessionKind: section.kind,
        sessionTitle: section.title,
        question: rows.filter((b) => b.kind === "problem").map((b) => b.content_ascii),
        solution,
        highlighted: listOf(sub.floating_highlights).length,
        floatingLines: listOf(sub.floating_lines).length,
        chipsMatchSolution: fresh,
        testPath: `/lesson-notes/${section.notebook_id}/floating/${subsectionId}/test`,
        classBoard: board,
      },
      summary:
        listOf(sub.floating_lines).length === 0
          ? "This question has no Floating Numbers yet, so there is nothing on the board to test."
          : fresh === false
            ? "The saved chips no longer match the written solution — they need generating again."
            : `The board has ${listOf(sub.floating_lines).length} line${listOf(sub.floating_lines).length === 1 ? "" : "s"} of chips, matching the written solution.`,
    };
  },

  edit_highlights: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const subsectionId = need(args, "subsectionId");
    const wanted = args["lines"];
    const pick =
      Array.isArray(wanted) && wanted.length
        ? wanted.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).map((n) => Math.floor(n))
        : null;

    const { data: sub } = await db.from("notebook_subsections").select("id, section_id").eq("id", subsectionId).maybeSingle();
    if (!sub) throw new Error("That session was not found.");
    const { data: section } = await db.from("notebook_sections").select("id, notebook_id").eq("id", sub.section_id).maybeSingle();
    if (!section) throw new Error("That session has no section above it.");
    await ownedNotebook(ctx, section.notebook_id);

    const { data: blocks } = await db
      .from("notebook_blocks")
      .select("kind, content_ascii, order_index")
      .eq("subsection_id", subsectionId)
      .order("order_index", { ascending: true });
    const solution = ((blocks ?? []) as BlockRow[]).filter((b) => b.kind === "solution").map((b) => b.content_ascii);
    if (solution.length === 0) throw new Error("This question has no written solution, so there is nothing to highlight.");

    const chosen = (pick ?? solution.map((_s, i) => i + 1))
      .filter((n) => n >= 1 && n <= solution.length)
      .map((n) => ({ text: solution[n - 1]!.trim(), line: n - 1 }))
      .filter((r) => r.text.length > 0);
    if (chosen.length === 0) throw new Error("None of those line numbers exist in the solution.");

    const highlights = chosen.map((r, i) => ({
      uid: mintLineUid(),
      groupId: i + 1,
      tokens: tokenizeMath(r.text).map((_t, tok) => ({ line: r.line, tok })),
      payload: r.text,
      precedingNotebook: "",
    }));
    const { error } = await db.from("notebook_subsections").update({ floating_highlights: highlights }).eq("id", subsectionId);
    if (error) throw new Error(error.message);

    const { data: after } = await db
      .from("notebook_subsections")
      .select("floating_highlights, floating_lines")
      .eq("id", subsectionId)
      .maybeSingle();
    const saved = listOf(after?.floating_highlights);
    if (saved.length !== highlights.length) throw new Error("The highlights did not save.");
    return {
      data: {
        subsectionId,
        highlighted: saved.length,
        lines: highlights.map((h) => h.payload),
        chipsNeedRegenerating: listOf(after?.floating_lines).length > 0,
        nextStep: "generate_floating_numbers",
      },
      summary: `Highlighting now covers ${saved.length} solution line${saved.length === 1 ? "" : "s"}. The Floating Numbers must be generated again to match.`,
    };
  },

  select_session: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const subsectionId = need(args, "subsectionId");
    const { data: sub } = await db
      .from("notebook_subsections")
      .select("id, section_id, floating_lines")
      .eq("id", subsectionId)
      .maybeSingle();
    if (!sub) throw new Error("That session was not found.");
    const { data: section } = await db
      .from("notebook_sections")
      .select("id, notebook_id, kind, title")
      .eq("id", sub.section_id)
      .maybeSingle();
    if (!section) throw new Error("That session has no section above it.");
    const path = `/lesson-notes/${section.notebook_id}/floating/${subsectionId}`;
    return {
      data: { subsectionId, notebookId: section.notebook_id, kind: section.kind, title: section.title, path },
      summary: `Opening the ${section.kind} session${section.title ? ` "${section.title}"` : ""} on the board.`,
      navigateTo: path,
    };
  },

  preview_note_cleanup: async (ctx, args) => {
    const notebookId = need(args, "notebookId");
    await ownedNotebook(ctx, notebookId);
    const tree = await readTree(ctx, notebookId);
    const plan = planCleanup(tree.blockRows).filter((p) => p.action !== "keep");
    return {
      data: { notebookId, changes: plan },
      summary: plan.length
        ? `Mending this note would change ${plan.length} line${plan.length === 1 ? "" : "s"}: ${describeCleanup(plan)}. Nothing has changed yet.`
        : "Every line in this note is already clean — one step per line, no labels.",
    };
  },

  clean_lesson_note: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    await ownedNotebook(ctx, notebookId);
    const tree = await readTree(ctx, notebookId);
    const plan = planCleanup(tree.blockRows);
    const work = plan.filter((p) => p.action !== "keep");
    if (!work.length) {
      return {
        data: { notebookId, changed: 0 },
        summary: "Nothing to mend — every line is already one clean step.",
      };
    }

    const byId = new Map(tree.blockRows.map((b) => [b.id, b]));
    let deleted = 0;
    let rewritten = 0;
    let added = 0;

    for (const step of work) {
      const block = byId.get(step.blockId);
      if (!block) continue;
      if (step.action === "delete") {
        const { error } = await db.from("notebook_blocks").delete().eq("id", block.id);
        if (error) throw new Error(error.message);
        deleted += 1;
        continue;
      }
      if (step.action === "rewrite") {
        const { error } = await db
          .from("notebook_blocks")
          .update({ content_ascii: step.after })
          .eq("id", block.id);
        if (error) throw new Error(error.message);
        rewritten += 1;
        continue;
      }
      // One block holding a whole worked example becomes one block per step.
      const [first, ...rest] = step.lines;
      const { error: firstError } = await db
        .from("notebook_blocks")
        .update({ content_ascii: first })
        .eq("id", block.id);
      if (firstError) throw new Error(firstError.message);
      rewritten += 1;
      if (rest.length) {
        const slots = await makeRoom(ctx, block.section_id, block.subsection_id ?? null, block.order_index + 1, rest.length);
        const { error } = await db.from("notebook_blocks").insert(
          rest.map((text, i) => ({
            section_id: block.section_id,
            subsection_id: block.subsection_id ?? null,
            kind: block.kind,
            content_ascii: text,
            order_index: slots[i]!,
          })),
        );
        if (error) throw new Error(error.message);
        added += rest.length;
      }
    }

    const after = await readTree(ctx, notebookId);
    const left = planCleanup(after.blockRows).filter((p) => p.action !== "keep").length;
    return {
      data: { notebookId, rewritten, added, deleted, stillDirty: left, structure: describeTree(after) },
      summary: `Mended this note: ${rewritten} line${rewritten === 1 ? "" : "s"} rewritten, ${added} new line${added === 1 ? "" : "s"} split out, ${deleted} empty line${deleted === 1 ? "" : "s"} removed${left ? `, ${left} still need attention` : ""}.`,
    };
  },
};

export const STRUCTURE_SECTION_KINDS = SECTION_KINDS;
