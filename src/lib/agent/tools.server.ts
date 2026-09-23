// Phase 1 — executors for the teaching agent's platform tools.
//
// Every executor runs with the teacher's own authenticated database client, so
// row-level security applies exactly as it does in the UI: the agent can never
// reach data the teacher could not open themselves.

import type { SupabaseClient } from "@supabase/supabase-js";

import { AGENT_TOOL_MANIFEST, findAgentTool, type AgentJson, type AgentToolResult } from "./toolTypes";
import { buildTeachingScript } from "./teachingScript";
import { findKnowledge, KNOWLEDGE_IDS } from "./knowledge";
import { handsExecutors } from "./hands.server";
import { attachmentExecutors } from "./attachments.server";



type Db = SupabaseClient<never, "public", never>;
// The agent bridge writes through loosely typed payloads; generated types stay
// authoritative for app code.
type AnyDb = {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

export type AgentToolContext = { supabase: Db; userId: string };

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
const num = (args: Args, key: string, fallback: number): number => {
  const v = args[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
};
const lines = (args: Args, key: string): string[] => {
  const v = args[key];
  if (!Array.isArray(v)) throw new Error(`Argument "${key}" must be a list of lines.`);
  const out = v.filter((x): x is string => typeof x === "string").map((x) => x);
  if (out.length === 0) throw new Error(`Argument "${key}" is empty.`);
  return out;
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
const BLOCK_KINDS = ["problem", "solution", "reasoning", "text"] as const;

const classCode = () => `CLS-${Math.floor(1000 + Math.random() * 9000)}`;

type Executor = (ctx: AgentToolContext, args: Args) => Promise<{ data: unknown; summary: string; navigateTo?: string }>;

const executors: Record<string, Executor> = {
  ...(handsExecutors as Record<string, Executor>),
  ...(attachmentExecutors as unknown as Record<string, Executor>),


  workspace_snapshot: async ({ supabase, userId }) => {
    const db = supabase as unknown as AnyDb;
    const [profile, classes, notebooks, games] = await Promise.all([
      db.from("profiles").select("full_name, display_name, active_org_id, school_name").eq("user_id", userId).maybeSingle(),
      db
        .from("classes")
        .select("id, name, class_code, school, schedule_days, schedule_times, workspace")
        .eq("owner_id", userId)
        .neq("workspace", "live")
        .order("created_at", { ascending: false }),
      db
        .from("notebooks")
        .select("id, title, subject, subtopic, updated_at")
        .eq("owner_id", userId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(8),
      db.from("games").select("id, title, topic").eq("owner_id", userId).order("updated_at", { ascending: false }).limit(8),
    ]);
    const data = {
      teacher: profile.data ?? null,
      classes: classes.data ?? [],
      recentLessonNotes: notebooks.data ?? [],
      recentGames: games.data ?? [],
      serverTimeUtc: new Date().toISOString(),
    };
    return {
      data,
      summary: `${(classes.data ?? []).length} classes, ${(notebooks.data ?? []).length} recent lesson notes, ${(games.data ?? []).length} recent games.`,
    };
  },

  list_classes: async ({ supabase, userId }) => {
    const db = supabase as unknown as AnyDb;
    const { data, error } = await db
      .from("classes")
      .select("id, name, class_code, school, description, workspace")
      .eq("owner_id", userId)
      .neq("workspace", "live")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string }[];
    const counts = await Promise.all(
      rows.map((r) => db.from("class_members").select("user_id", { count: "exact", head: true }).eq("class_id", r.id)),
    );
    const withCounts = rows.map((r, i) => ({ ...r, studentCount: counts[i]?.count ?? 0 }));
    return { data: withCounts, summary: `${withCounts.length} classes.` };
  },

  create_class: async ({ supabase, userId }, args) => {
    const db = supabase as unknown as AnyDb;
    const name = need(args, "name");
    let lastError = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await db
        .from("classes")
        .insert({
          name,
          school: str(args, "school") ?? null,
          description: str(args, "description") ?? null,
          class_code: classCode(),
          owner_id: userId,
        })
        .select("id, name, class_code")
        .single();
      if (!error && data) {
        const { data: code } = await db.rpc("get_class_join_code", { _class_id: data.id });
        return {
          data: { ...data, joinCode: (code as string | null) ?? null },
          summary: `Created class "${data.name}" (code ${data.class_code}).`,
          navigateTo: `/class/${data.id}`,
        };
      }
      lastError = error?.message ?? "Unknown error";
      if (error && (error as { code?: string }).code !== "23505") break;
    }
    throw new Error(lastError || "Could not create the class.");
  },

  list_class_students: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const classId = need(args, "classId");
    const { data, error } = await db.from("class_members").select("user_id, joined_at").eq("class_id", classId);
    if (error) throw new Error(error.message);
    const ids = ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profiles } = await db
        .from("profiles")
        .select("user_id, full_name, display_name, mathgpl_student_id")
        .in("user_id", ids);
      names = Object.fromEntries(
        ((profiles ?? []) as { user_id: string; full_name: string | null; display_name: string | null }[]).map((p) => [
          p.user_id,
          p.full_name || p.display_name || "Student",
        ]),
      );
    }
    const students = ((data ?? []) as { user_id: string; joined_at: string }[]).map((r) => ({
      userId: r.user_id,
      name: names[r.user_id] ?? "Student",
      joinedAt: r.joined_at,
    }));
    return { data: students, summary: `${students.length} students in this class.` };
  },

  list_lesson_notes: async ({ supabase, userId }, args) => {
    const db = supabase as unknown as AnyDb;
    const { data, error } = await db
      .from("notebooks")
      .select("id, title, subject, subtopic, class_name, updated_at")
      .eq("owner_id", userId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(Math.min(Math.max(num(args, "limit", 20), 1), 100));
    if (error) throw new Error(error.message);
    return { data: data ?? [], summary: `${(data ?? []).length} lesson notes.` };
  },

  create_lesson_note: async ({ supabase, userId }, args) => {
    const db = supabase as unknown as AnyDb;
    const title = need(args, "title");
    const kindArg = str(args, "sectionKind") ?? "explanation";
    const kind = (SECTION_KINDS as readonly string[]).includes(kindArg) ? kindArg : "explanation";
    const { data: nb, error } = await db
      .from("notebooks")
      .insert({
        owner_id: userId,
        title,
        subject: str(args, "subject") ?? "Mathematics",
        subtopic: str(args, "subtopic") ?? "",
        class_name: str(args, "className") ?? "",
      })
      .select("id, title")
      .single();
    if (error || !nb) throw new Error(error?.message ?? "Could not create the lesson note.");
    const { data: section, error: sectionError } = await db
      .from("notebook_sections")
      .insert({ notebook_id: nb.id, kind, order_index: 0 })
      .select("id, kind")
      .single();
    if (sectionError) throw new Error(sectionError.message);
    return {
      data: { notebookId: nb.id, sectionId: section?.id ?? null, sectionKind: kind },
      summary: `Created the lesson note "${nb.title}" with a ${kind} section.`,
      navigateTo: `/lesson-notes/${nb.id}`,
    };
  },

  append_lesson_lines: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const sectionId = need(args, "sectionId");
    const content = lines(args, "lines");
    const kindArg = str(args, "kind") ?? "text";
    const kind = (BLOCK_KINDS as readonly string[]).includes(kindArg) ? kindArg : "text";
    const { data: existing } = await db
      .from("notebook_blocks")
      .select("order_index")
      .eq("section_id", sectionId)
      .order("order_index", { ascending: false })
      .limit(1);
    let order = (((existing ?? []) as { order_index: number }[])[0]?.order_index ?? -1) + 1;
    const rows = content.map((text) => ({
      section_id: sectionId,
      kind,
      content_ascii: text,
      order_index: order++,
    }));
    const { error } = await db.from("notebook_blocks").insert(rows);
    if (error) throw new Error(error.message);
    return {
      data: { sectionId, added: rows.length, kind },
      summary: `Wrote ${rows.length} ${kind} line${rows.length === 1 ? "" : "s"} into the lesson note.`,
    };
  },

  add_lesson_session: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    const kindArg = need(args, "kind");
    const kind = (SECTION_KINDS as readonly string[]).includes(kindArg) ? kindArg : "example";
    const title = str(args, "title") ?? null;
    const { data: existing } = await db
      .from("notebook_sections")
      .select("order_index")
      .eq("notebook_id", notebookId)
      .order("order_index", { ascending: false })
      .limit(1);
    const order = (((existing ?? []) as { order_index: number }[])[0]?.order_index ?? -1) + 1;
    const { data: section, error } = await db
      .from("notebook_sections")
      .insert({ notebook_id: notebookId, kind, title, order_index: order })
      .select("id, kind, title")
      .single();
    if (error || !section) throw new Error(error?.message ?? "Could not add the session.");

    let subsectionId: string | null = null;
    if (["example", "exercise", "classwork", "homework"].includes(kind)) {
      const { data: sub, error: subError } = await db
        .from("notebook_subsections")
        .insert({ section_id: section.id, order_index: 0 })
        .select("id")
        .single();
      if (subError) throw new Error(subError.message);
      subsectionId = sub?.id ?? null;
    }

    return {
      data: {
        notebookId,
        sectionId: section.id,
        sectionKind: kind,
        title: section.title ?? null,
        subsectionId,
        floatingPreparationPath: subsectionId
          ? `/lesson-notes/${notebookId}/floating-prep/${subsectionId}`
          : null,
        floatingNumbersPath: subsectionId
          ? `/lesson-notes/${notebookId}/floating/${subsectionId}`
          : null,
      },
      summary: `Added a ${kind} session${title ? ` ("${title}")` : ""} to the lesson note.`,
    };
  },

  read_lesson_note: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    const { data: nb, error } = await db
      .from("notebooks")
      .select("id, title, subject, subtopic")
      .eq("id", notebookId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!nb) throw new Error("Lesson note not found.");
    const { data: sections } = await db
      .from("notebook_sections")
      .select("id, kind, title, order_index")
      .eq("notebook_id", notebookId)
      .order("order_index", { ascending: true });
    const sectionRows = (sections ?? []) as { id: string; kind: string; title: string | null }[];
    const withBlocks = await Promise.all(
      sectionRows.map(async (s) => {
        const { data: blocks } = await db
          .from("notebook_blocks")
          .select("id, kind, content_ascii, order_index")
          .eq("section_id", s.id)
          .order("order_index", { ascending: true });
        return { ...s, blocks: blocks ?? [] };
      }),
    );
    return {
      data: { notebook: nb, sections: withBlocks },
      summary: `Read "${nb.title}" — ${withBlocks.length} section${withBlocks.length === 1 ? "" : "s"}.`,
    };
  },

  link_lesson_note_to_class: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const classId = need(args, "classId");
    const notebookId = need(args, "notebookId");
    const { data: existing } = await db
      .from("class_lesson_notes")
      .select("id")
      .eq("class_id", classId)
      .eq("notebook_id", notebookId)
      .maybeSingle();
    if (existing) {
      return { data: existing, summary: "That lesson note is already shared with this class." };
    }
    const { data, error } = await db
      .from("class_lesson_notes")
      .insert({ class_id: classId, notebook_id: notebookId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      data,
      summary: "Lesson note shared with the class.",
      navigateTo: `/class/${classId}`,
    };
  },

  list_games: async ({ supabase, userId }) => {
    const db = supabase as unknown as AnyDb;
    const { data, error } = await db
      .from("games")
      .select("id, title, topic, subtopic, updated_at")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { data: data ?? [], summary: `${(data ?? []).length} games.` };
  },

  link_game_to_class: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const classId = need(args, "classId");
    const gameId = need(args, "gameId");
    const { data: existing } = await db
      .from("class_games")
      .select("id")
      .eq("class_id", classId)
      .eq("game_id", gameId)
      .maybeSingle();
    if (existing) return { data: existing, summary: "That game is already on this class playlist." };
    const { data, error } = await db
      .from("class_games")
      .insert({ class_id: classId, game_id: gameId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { data, summary: "Game added to the class playlist.", navigateTo: `/class/${classId}` };
  },

  archive_lesson_note: async ({ supabase, userId }, args) => {
    const db = supabase as unknown as AnyDb;
    const notebookId = need(args, "notebookId");
    const { data, error } = await db
      .from("notebooks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", notebookId)
      .eq("owner_id", userId)
      .select("id, title")
      .single();
    if (error) throw new Error(error.message);
    return { data, summary: "Lesson note archived." };
  },

  remove_student_from_class: async ({ supabase }, args) => {
    const db = supabase as unknown as AnyDb;
    const classId = need(args, "classId");
    const studentId = need(args, "studentId");
    const { error } = await db
      .from("class_members")
      .delete()
      .eq("class_id", classId)
      .eq("user_id", studentId);
    if (error) throw new Error(error.message);
    return { data: { classId, studentId }, summary: "Student removed from the class." };
  },

  teach_lesson: async (_ctx, args) => {
    const script = buildTeachingScript(args["say"], args["lines"], args["title"]);
    return {
      data: script as unknown,
      summary: `Teaching "${script.title}" aloud in ${script.steps.length} steps.`,
    };
  },

  explain_workflow: async (_ctx, args) => {
    const id = need(args, "workflow").trim();
    const node = findKnowledge(id);
    if (!node) {
      throw new Error(
        `There is no MathGPL workflow called "${id}". Known workflows: ${KNOWLEDGE_IDS.join(", ")}.`,
      );
    }
    return {
      data: node as unknown,
      summary: `Checked how ${node.title} works in MathGPL.`,
    };
  },

  navigate: async (_ctx, args) => {
    const path = need(args, "path");
    if (!path.startsWith("/") || path.startsWith("//")) {
      throw new Error("Path must be an in-app path starting with a single '/'.");
    }
    return { data: { path }, summary: `Opening ${path}.`, navigateTo: path };
  },
};

/** Every manifest entry must have an executor — guarded by tests. */
export function agentExecutorIds(): string[] {
  return Object.keys(executors);
}

export async function executeAgentTool(
  ctx: AgentToolContext,
  toolId: string,
  args: Args = {},
): Promise<AgentToolResult> {
  const spec = findAgentTool(toolId);
  const run = executors[toolId];
  if (!spec || !run) {
    return { ok: false, toolId, error: `Unknown tool "${toolId}".` };
  }
  // Nothing destructive happens on the agent's word alone: the teacher has to
  // say yes, and only then is the same action repeated with confirmed: true.
  if (spec.needsConfirmation && args["confirmed"] !== true) {
    return {
      ok: false,
      toolId,
      error:
        "This needs the teacher's confirmation. Ask them in one short sentence, and only if they clearly agree, call this again with confirmed: true.",
    };
  }
  try {
    const { data, summary, navigateTo } = await run(ctx, args);
    return { ok: true, toolId, data: data as AgentJson, summary, ...(navigateTo ? { navigateTo } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, toolId, error: message };
  }
}

export const AGENT_TOOL_COUNT = AGENT_TOOL_MANIFEST.length;
