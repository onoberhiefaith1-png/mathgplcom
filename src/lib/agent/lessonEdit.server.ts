// The assistant's hands for changing a lesson note that already exists.
//
// Writing a new note is in hands.server.ts. This file is the repair kit: edit a
// line, insert one in the middle, move one, show exactly what a removal would
// take away, and straighten a note whose questions were typed as plain prose
// instead of inside a real session — without ever leaving a duplicate behind.

import type { SupabaseClient } from "@supabase/supabase-js";

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
const maybeNum = (args: Args, key: string): number | undefined => {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};
const textList = (args: Args, key: string): string[] => {
  const v = args[key];
  if (!Array.isArray(v)) throw new Error(`Argument "${key}" must be a list.`);
  const out = v.filter((x): x is string => typeof x === "string");
  if (out.length === 0) throw new Error(`Argument "${key}" is empty.`);
  return out;
};

const BLOCK_KINDS = ["problem", "solution", "reasoning", "text"] as const;
const QUESTION_SECTIONS = ["example", "exercise", "classwork", "homework"];

type Block = {
  id: string;
  section_id: string;
  subsection_id: string | null;
  kind: string;
  content_ascii: string | null;
  order_index: number;
};

async function readBlock(ctx: Ctx, blockId: string): Promise<Block> {
  const db = ctx.supabase as unknown as AnyDb;
  const { data, error } = await db
    .from("notebook_blocks")
    .select("id, section_id, subsection_id, kind, content_ascii, order_index")
    .eq("id", blockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That line was not found in this workspace.");
  return data as Block;
}

/** Every line of one place in the note, in saved order. */
async function readSiblings(ctx: Ctx, block: Block): Promise<Block[]> {
  const db = ctx.supabase as unknown as AnyDb;
  let query = db
    .from("notebook_blocks")
    .select("id, section_id, subsection_id, kind, content_ascii, order_index")
    .eq("section_id", block.section_id);
  query = block.subsection_id
    ? query.eq("subsection_id", block.subsection_id)
    : query.is("subsection_id", null);
  const { data } = await query.order("order_index", { ascending: true });
  return (data ?? []) as Block[];
}

/** Rewrites 0..n-1 so an insert or a move never leaves two lines fighting. */
async function renumber(ctx: Ctx, blocks: Block[]): Promise<void> {
  const db = ctx.supabase as unknown as AnyDb;
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!;
    if (block.order_index === index) continue;
    const { error } = await db
      .from("notebook_blocks")
      .update({ order_index: index })
      .eq("id", block.id);
    if (error) throw new Error(error.message);
  }
}

type Executor = (
  ctx: Ctx,
  args: Args,
) => Promise<{ data: unknown; summary: string; navigateTo?: string }>;

export const lessonEditExecutors: Record<string, Executor> = {
  edit_lesson_line: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const blockId = need(args, "blockId");
    const text = typeof args["text"] === "string" ? (args["text"] as string) : undefined;
    if (text === undefined) throw new Error('Missing required argument "text".');
    const before = await readBlock(ctx, blockId);
    const { error } = await db
      .from("notebook_blocks")
      .update({ content_ascii: text })
      .eq("id", blockId);
    if (error) throw new Error(error.message);
    const after = await readBlock(ctx, blockId);
    if ((after.content_ascii ?? "") !== text) {
      throw new Error("The line did not change. Nothing was saved.");
    }
    return {
      data: { blockId, kind: after.kind, was: before.content_ascii ?? "", now: after.content_ascii ?? "" },
      summary: `Rewrote one ${after.kind} line.`,
    };
  },

  insert_lesson_lines: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const sectionId = str(args, "sectionId");
    const subsectionId = str(args, "subsectionId");
    const afterBlockId = str(args, "afterBlockId");
    const content = textList(args, "lines");
    const kindArg = str(args, "kind") ?? "text";
    const kind = (BLOCK_KINDS as readonly string[]).includes(kindArg) ? kindArg : "text";

    let anchorSection = sectionId;
    let anchorSub = subsectionId ?? null;
    let at: number;
    if (afterBlockId) {
      const anchor = await readBlock(ctx, afterBlockId);
      anchorSection = anchor.section_id;
      anchorSub = anchor.subsection_id;
      at = anchor.order_index + 1;
    } else {
      if (!anchorSection && !anchorSub) {
        throw new Error("Give afterBlockId, or sectionId, or subsectionId, so I know where to write.");
      }
      at = Math.max(0, Math.round(maybeNum(args, "atPosition") ?? 0));
    }

    if (!anchorSection && anchorSub) {
      const { data: sub } = await db
        .from("notebook_subsections")
        .select("section_id")
        .eq("id", anchorSub)
        .maybeSingle();
      anchorSection = String(sub?.section_id ?? "");
      if (!anchorSection) throw new Error("That question was not found.");
    }

    const probe: Block = {
      id: "",
      section_id: anchorSection!,
      subsection_id: anchorSub,
      kind,
      content_ascii: "",
      order_index: 0,
    };
    const existing = await readSiblings(ctx, probe);
    const index = Math.min(at, existing.length);

    // Everything at and after the insert point moves down first, so no two
    // lines ever share a position.
    const shifted = [
      ...existing.slice(0, index),
      ...content.map((_t, i) => ({ ...probe, id: `new-${i}` })),
      ...existing.slice(index),
    ];
    await renumber(ctx, existing.slice(index).map((b, i) => ({ ...b, order_index: index + content.length + i })));

    const rows = content.map((text, i) => ({
      section_id: anchorSection,
      subsection_id: anchorSub,
      kind,
      content_ascii: text,
      order_index: index + i,
    }));
    const { error } = await db.from("notebook_blocks").insert(rows);
    if (error) throw new Error(error.message);
    const after = await readSiblings(ctx, probe);
    await renumber(ctx, after);
    return {
      data: {
        sectionId: anchorSection,
        subsectionId: anchorSub,
        inserted: rows.length,
        at: index,
        total: after.length,
        order: shifted.length,
      },
      summary: `Wrote ${rows.length} ${kind} line${rows.length === 1 ? "" : "s"} in at position ${index + 1}.`,
    };
  },

  move_lesson_line: async (ctx, args) => {
    const blockId = need(args, "blockId");
    const to = Math.max(1, Math.round(maybeNum(args, "toPosition") ?? 1));
    const block = await readBlock(ctx, blockId);
    const siblings = await readSiblings(ctx, block);
    const from = siblings.findIndex((b) => b.id === blockId);
    if (from < 0) throw new Error("That line is not where I expected it. Read the note again.");
    const target = Math.min(siblings.length, to) - 1;
    const reordered = [...siblings];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(target, 0, moved!);
    await renumber(ctx, reordered);
    const after = await readSiblings(ctx, block);
    const landed = after.findIndex((b) => b.id === blockId) + 1;
    if (landed !== target + 1) {
      throw new Error(`The line did not move where it should. It is at position ${landed}.`);
    }
    return {
      data: {
        blockId,
        from: from + 1,
        to: landed,
        order: after.map((b, i) => ({ position: i + 1, blockId: b.id, kind: b.kind, text: b.content_ascii ?? "" })),
      },
      summary: `Moved that line from position ${from + 1} to ${landed}.`,
    };
  },

  preview_lesson_removal: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const blockIds = Array.isArray(args["blockIds"])
      ? (args["blockIds"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const subsectionId = str(args, "subsectionId");
    const sectionId = str(args, "sectionId");

    if (blockIds.length) {
      const { data } = await db
        .from("notebook_blocks")
        .select("id, kind, content_ascii")
        .in("id", blockIds);
      const rows = (data ?? []) as { id: string; kind: string; content_ascii: string | null }[];
      return {
        data: {
          wouldRemove: rows.map((r) => ({ blockId: r.id, kind: r.kind, text: r.content_ascii ?? "" })),
          count: rows.length,
          reversible: false,
        },
        summary: `This would delete ${rows.length} line${rows.length === 1 ? "" : "s"}. Read them out and wait for a clear yes.`,
      };
    }

    if (subsectionId) {
      const { data: sub } = await db
        .from("notebook_subsections")
        .select("id, floating_lines")
        .eq("id", subsectionId)
        .maybeSingle();
      if (!sub) throw new Error("That question was not found.");
      const { data: blocks } = await db
        .from("notebook_blocks")
        .select("id, kind, content_ascii")
        .eq("subsection_id", subsectionId)
        .order("order_index", { ascending: true });
      const rows = (blocks ?? []) as { id: string; kind: string; content_ascii: string | null }[];
      const floating = Array.isArray(sub.floating_lines) ? sub.floating_lines.length : 0;
      const { data: gameRows } = await db
        .from("slate_game_questions")
        .select("id, game_id")
        .eq("subsection_id", subsectionId);
      const usedByGames = ((gameRows ?? []) as { game_id: string }[]).map((r) => r.game_id);
      return {
        data: {
          wouldRemove: rows.map((r) => ({ blockId: r.id, kind: r.kind, text: r.content_ascii ?? "" })),
          alsoLost: { floatingNumberLines: floating },
          usedByGames,
          reversible: false,
        },
        summary: usedByGames.length
          ? `This question is a level in ${usedByGames.length} game${usedByGames.length === 1 ? "" : "s"}. Removing it would empty that level. Tell the teacher before doing anything.`
          : `This would delete the whole question: ${rows.length} line${rows.length === 1 ? "" : "s"} and ${floating} Floating Number line${floating === 1 ? "" : "s"}.`,
      };
    }

    if (sectionId) {
      const { data: blocks } = await db
        .from("notebook_blocks")
        .select("id, kind, content_ascii")
        .eq("section_id", sectionId)
        .order("order_index", { ascending: true });
      const rows = (blocks ?? []) as { id: string; kind: string; content_ascii: string | null }[];
      return {
        data: {
          wouldRemove: rows.map((r) => ({ blockId: r.id, kind: r.kind, text: r.content_ascii ?? "" })),
          count: rows.length,
          reversible: false,
        },
        summary: `This would delete a whole session and its ${rows.length} line${rows.length === 1 ? "" : "s"}.`,
      };
    }

    throw new Error("Give blockIds, or a subsectionId, or a sectionId, so I can show what would go.");
  },

  remove_lesson_lines: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const blockIds = Array.isArray(args["blockIds"])
      ? (args["blockIds"] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    if (blockIds.length === 0) throw new Error('Argument "blockIds" is empty.');
    const { data: before } = await db
      .from("notebook_blocks")
      .select("id, section_id, subsection_id, kind, content_ascii, order_index")
      .in("id", blockIds);
    const rows = (before ?? []) as Block[];
    if (rows.length === 0) throw new Error("None of those lines exist any more; nothing was deleted.");
    const { error } = await db.from("notebook_blocks").delete().in("id", blockIds);
    if (error) throw new Error(error.message);
    const { data: left } = await db.from("notebook_blocks").select("id").in("id", blockIds);
    if (((left ?? []) as unknown[]).length > 0) {
      throw new Error("Some of those lines could not be deleted. Read the note again.");
    }
    const home = rows[0]!;
    await renumber(ctx, await readSiblings(ctx, home));
    return {
      data: { removed: rows.map((r) => ({ blockId: r.id, kind: r.kind, text: r.content_ascii ?? "" })) },
      summary: `Deleted ${rows.length} line${rows.length === 1 ? "" : "s"}.`,
    };
  },

  inspect_lesson_structure: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    const { data: sections } = await db
      .from("notebook_sections")
      .select("id, kind, title, order_index")
      .eq("notebook_id", notebookId)
      .order("order_index", { ascending: true });
    const sectionRows = (sections ?? []) as { id: string; kind: string; title: string | null }[];
    if (sectionRows.length === 0) throw new Error("That lesson note has no sessions at all yet.");

    const problems: { sectionId: string; issue: string; fixable: boolean }[] = [];
    const report = await Promise.all(
      sectionRows.map(async (section) => {
        const { data: subs } = await db
          .from("notebook_subsections")
          .select("id, order_index, floating_lines, floating_highlights")
          .eq("section_id", section.id)
          .order("order_index", { ascending: true });
        const subRows = (subs ?? []) as { id: string; floating_lines: unknown; floating_highlights: unknown }[];
        const { data: blocks } = await db
          .from("notebook_blocks")
          .select("id, subsection_id, kind, content_ascii, order_index")
          .eq("section_id", section.id)
          .order("order_index", { ascending: true });
        const blockRows = (blocks ?? []) as Block[];
        const loose = blockRows.filter((b) => !b.subsection_id);
        const isQuestionSection = QUESTION_SECTIONS.includes(section.kind);

        if (isQuestionSection && subRows.length === 0) {
          problems.push({
            sectionId: section.id,
            issue: "This is a question session with no question inside it, so the Smartboard has nothing to step through.",
            fixable: true,
          });
        }
        if (isQuestionSection && subRows.length > 0 && loose.some((b) => b.kind === "problem" || b.kind === "solution")) {
          problems.push({
            sectionId: section.id,
            issue: "The question or its solution was written loose in the session instead of inside the question, so Floating Numbers cannot read it.",
            fixable: true,
          });
        }
        if (!isQuestionSection && loose.some((b) => /^(example|exercise|classwork|homework|assessment)\b\s*\d*\s*[:.]/i.test(String(b.content_ascii ?? "")))) {
          problems.push({
            sectionId: section.id,
            issue: "A question looks like it was typed as a plain line ('Example 1: ...') instead of being given its own session. It cannot be taught or turned into Floating Numbers where it is.",
            fixable: false,
          });
        }

        return {
          sectionId: section.id,
          kind: section.kind,
          title: section.title,
          questions: subRows.map((s) => ({
            subsectionId: s.id,
            floatingLines: Array.isArray(s.floating_lines) ? s.floating_lines.length : 0,
            highlighted: Array.isArray(s.floating_highlights) ? s.floating_highlights.length : 0,
            lines: blockRows
              .filter((b) => b.subsection_id === s.id)
              .map((b) => ({ blockId: b.id, kind: b.kind, text: b.content_ascii ?? "" })),
          })),
          looseLines: loose.map((b) => ({ blockId: b.id, kind: b.kind, text: b.content_ascii ?? "" })),
        };
      }),
    );

    return {
      data: { notebookId, sections: report, problems },
      summary:
        problems.length === 0
          ? `"${notebookId}" is structured correctly: every question sits in its own session.`
          : `Found ${problems.length} structural problem${problems.length === 1 ? "" : "s"}: ${problems.map((p) => p.issue).join(" ")}`,
    };
  },

  repair_lesson_structure: async (ctx, args) => {
    const db = ctx.supabase as unknown as AnyDb;
    const sectionId = need(args, "sectionId");
    const { data: section } = await db
      .from("notebook_sections")
      .select("id, kind, notebook_id")
      .eq("id", sectionId)
      .maybeSingle();
    if (!section) throw new Error("That session was not found.");
    if (!QUESTION_SECTIONS.includes(String(section.kind))) {
      throw new Error(
        `A ${section.kind} session holds no question, so there is nothing to repair here. A question needs its own Example, Exercise, Classwork or Homework session.`,
      );
    }

    const { data: subs } = await db
      .from("notebook_subsections")
      .select("id, order_index")
      .eq("section_id", sectionId)
      .order("order_index", { ascending: true });
    let subsectionId = ((subs ?? []) as { id: string }[])[0]?.id ?? null;
    let created = false;
    if (!subsectionId) {
      const { data: made, error } = await db
        .from("notebook_subsections")
        .insert({ section_id: sectionId, order_index: 0 })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      subsectionId = String(made.id);
      created = true;
    }

    const { data: blocks } = await db
      .from("notebook_blocks")
      .select("id, section_id, subsection_id, kind, content_ascii, order_index")
      .eq("section_id", sectionId)
      .is("subsection_id", null)
      .order("order_index", { ascending: true });
    const loose = ((blocks ?? []) as Block[]).filter(
      (b) => b.kind === "problem" || b.kind === "solution",
    );

    // Moving is not copying: the same row is re-pointed, so no duplicate can
    // appear in the note.
    for (const block of loose) {
      const { error } = await db
        .from("notebook_blocks")
        .update({ subsection_id: subsectionId })
        .eq("id", block.id);
      if (error) throw new Error(error.message);
    }

    const { data: after } = await db
      .from("notebook_blocks")
      .select("id, kind, content_ascii, order_index")
      .eq("subsection_id", subsectionId)
      .order("order_index", { ascending: true });
    const rows = (after ?? []) as { id: string; kind: string; content_ascii: string | null }[];
    const hasProblem = rows.some((r) => r.kind === "problem");
    return {
      data: {
        sectionId,
        subsectionId,
        createdQuestion: created,
        movedLines: loose.length,
        nowInside: rows.map((r) => ({ blockId: r.id, kind: r.kind, text: r.content_ascii ?? "" })),
        hasQuestionLine: hasProblem,
        nextStep: hasProblem ? "highlight_solution" : "write the question line with append_lesson_lines",
      },
      summary: created
        ? `Gave this session a proper question and moved ${loose.length} line${loose.length === 1 ? "" : "s"} inside it. Nothing was duplicated.`
        : `Moved ${loose.length} loose line${loose.length === 1 ? "" : "s"} inside the question. Nothing was duplicated.`,
    };
  },
};
