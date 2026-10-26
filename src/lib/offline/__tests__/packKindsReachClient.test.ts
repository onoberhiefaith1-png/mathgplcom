/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, inSizes: [] as number[] }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/slate/storage", () => ({ normalizeGame: (g: unknown) => g }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from(table: string) {
  let rows = [...(state.tables[table] ?? [])];
  const q: any = { select: () => q, order: () => q, limit: () => q,
    // PostgREST answers at most 1000 rows per request, whatever range was asked for.
    range: (from: number, to: number) => { rows = rows.slice(from, Math.min(to + 1, from + 1000)); return q; },
    eq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key] === value); return q; },
    in: (key: string, values: unknown[]) => { state.inSizes.push(values.length); rows = rows.filter((r) => values.includes(r[key])); return q; },
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }) };
  return q;
} } }));
import { Route } from "@/routes/api/public/academia-pack";
import { isActivityReady, activityNotReadyReason } from "../activityReady";
import { ACADEMIA_PACK_SCHEMA } from "../academiaPack";
import type { Catalogue, PackActivity } from "../academiaStore";

const download = async (query = "") => (Route as any).server.handlers.GET({ request: new Request(`https://mathgpl.com/api/public/academia-pack${query}`) }) as Promise<Response>;
const activitiesOf = (pack: Catalogue) => pack.schools[0]!.classes[0]!.subjects[0]!.topics[0]!.subtopics[0]!.sessions.flatMap((s) => s.activities);
const line = (id: string, equation: string, marks = 1) => ({ lineId: id, equation, fillers: equation.split(""), containers: [], arrangement: [], marks });

beforeEach(() => {
  state.inSizes = [];
  state.tables = {
    academia: [{ id: "public", org_id: "org", visibility: "public", updated_at: "2026-10-20T00:00:00Z" }],
    organizations: [{ id: "org", name: "School" }],
    academia_classes: [{ id: "class", academia_id: "public" }], academia_subjects: [{ id: "subject", class_id: "class" }],
    academia_topics: [{ id: "topic", subject_id: "subject" }], academia_subtopics: [{ id: "subtopic", topic_id: "topic" }],
    academia_sessions: [{ id: "session", subtopic_id: "subtopic" }],
    academia_activities: [
      // Every kind Academia can put in a Session (the table's kind check) that the pack serializes.
      { id: "lesson_note", session_id: "session", kind: "lesson_note", title: "Note", subsection_id: "sub", game_id: "g1", position: 1 },
      { id: "smartboard", session_id: "session", kind: "smartboard", title: "Board", subsection_id: "sub", position: 2 },
      { id: "question", session_id: "session", kind: "question", title: "Question", subsection_id: "sub", game_id: "g1", position: 3 },
      { id: "mcq", session_id: "session", kind: "mcq", ref_id: "paper", title: "Quiz", position: 4 },
      { id: "adventure", session_id: "session", kind: "adventure", ref_id: "video", game_id: "g1", title: "Adventure", position: 5 },
      { id: "adventure-no-game", session_id: "session", kind: "adventure", ref_id: "video", title: "Adventure 2", position: 6 },
      { id: "mcq-empty", session_id: "session", kind: "mcq", ref_id: "paper", title: "Empty quiz", position: 7 },
      { id: "game", session_id: "session", kind: "game", title: "Plain Game", position: 8 },
    ],
    notebook_subsections: [{ id: "sub", section_id: "sec", floating_lines: [line("l0", "x+7=15"), line("l1", "x=8")] }],
    notebook_sections: [{ id: "sec", notebook_id: "nb" }], notebook_blocks: [],
    slate_games: [{ id: "g1", name: "Game", surface_id: "plain", slots: [], settings: {}, status: {}, background: {}, pattern_length: 1, updated_at: "2026-10-20T00:00:00Z" }],
    academia_mcq_papers: [{ id: "paper", subject_id: "subject", title: "Algebra", questions: [{ n: 1, text: "Find x", answer: "A", options: [] }] }],
    academia_mcq_items: [{ id: "i1", activity_id: "mcq", n: 1, text: "Copied", answer: "B", options: [] }],
    games: [{ id: "video", canvas: { video: { path: "owner/video.mp4", source: "storage" }, scenes: [{ id: "point", loopStart: 1, loopEnd: 5, elements: [] }] }, updated_at: "2026-10-20T00:00:00Z" }],
    academia_adventure_questions: ["adventure", "adventure-no-game"].map((activity_id) => ({ id: `q-${activity_id}`, activity_id, scene_id: "point", bar_id: "bar", question_text: "x=8", lines: [] })),
    academia_adventure_points: [{ activity_id: "adventure", scene_id: "point", pass_pct: 75 }],
  };
});

it("every activity kind the pack serializes reaches the client model, and is ready when it has content", async () => {
  const pack = (await (await download()).json()) as Catalogue;
  const byId = Object.fromEntries(activitiesOf(pack).map((a) => [a.id, a as PackActivity]));
  expect(Object.keys(byId).sort()).toEqual(["adventure", "adventure-no-game", "lesson_note", "mcq", "mcq-empty", "question", "smartboard"]);
  for (const id of ["lesson_note", "smartboard", "question", "mcq", "adventure"]) expect(isActivityReady(byId[id]!), id).toBe(true);
  expect(byId.mcq!.mcq!.questions[0]).toMatchObject({ n: 1, text: "Copied", answer: "B" });
  expect(byId.adventure!.adventure!.questions).toHaveLength(1);
  expect(byId.adventure!.adventure!.game).toBeTruthy();
  expect(byId.question!.game).toBeTruthy(); // Practice and Play
  expect(byId.smartboard!.game).toBeNull(); // Practice only
  // Content that is missing in Academia is explained, not just "No question yet".
  expect(activityNotReadyReason(byId["mcq-empty"]!, pack.schema)).toBe("No questions assigned to this session yet");
  expect(activityNotReadyReason(byId["adventure-no-game"]!, pack.schema)).toBe("No Game attached to this adventure yet");
});

it("the lightweight version answer matches the full pack and carries no content", async () => {
  const full = await (await download()).json();
  const light = await (await download("?versionOnly=1")).json();
  expect(light).toEqual({ schema: ACADEMIA_PACK_SCHEMA, version: full.version });
});

it("the version only changes when Academia content changes", async () => {
  const a = (await (await download("?versionOnly=1")).json()).version;
  expect((await (await download("?versionOnly=1")).json()).version).toBe(a);
  state.tables.academia_mcq_items![0]!.text = "Edited in Academia";
  expect((await (await download("?versionOnly=1")).json()).version).not.toBe(a);
});

it("keeps every row past the 1000-row cap and splits long id lists", async () => {
  state.tables.academia_mcq_items = Array.from({ length: 2300 }, (_, i) => ({ id: `i${i}`, activity_id: "mcq", n: i + 1, text: `Q${i}`, answer: "A", options: [] }));
  state.tables.academia_sessions = Array.from({ length: 400 }, (_, i) => ({ id: i === 0 ? "session" : `s${i}`, subtopic_id: "subtopic" }));
  const pack = (await (await download()).json()) as Catalogue;
  const mcq = activitiesOf(pack).find((a) => a.id === "mcq")!;
  expect(mcq.mcq!.questions).toHaveLength(2300);
  expect(pack.schools[0]!.classes[0]!.subjects[0]!.topics[0]!.subtopics[0]!.sessions).toHaveLength(400);
  expect(Math.max(...state.inSizes)).toBeLessThanOrEqual(150);
});
