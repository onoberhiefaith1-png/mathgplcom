import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, fail: "" }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/slate/storage", () => ({ normalizeGame: (g: unknown) => g }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from(table: string) {
  let rows = [...(state.tables[table] ?? [])];
  const q: any = { select: () => q, order: () => q, limit: () => q,
    eq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key] === value); return q; },
    in: (key: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[key])); return q; },
    maybeSingle: async () => ({ data: rows[0] ?? null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: state.fail === table ? { message: "unavailable" } : null }) };
  return q;
}, storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: "https://media.example/clip" } }) }) } } }));
import { Route as MediaRoute } from "@/routes/api/public/academia-media";
import { Route } from "@/routes/api/public/academia-pack";
const download = () => (Route as any).server.handlers.GET() as Promise<Response>;
beforeEach(() => {
  state.fail = "";
  state.tables = {
    academia: [{ id: "public", org_id: "org", visibility: "public" }, { id: "private", visibility: "private" }],
    organizations: [{ id: "org", name: "School" }],
    academia_classes: [{ id: "class", academia_id: "public" }, { id: "hidden-class", academia_id: "private" }],
    academia_subjects: [{ id: "subject", class_id: "class" }, { id: "hidden-subject", class_id: "hidden-class" }],
    academia_topics: [{ id: "topic", subject_id: "subject" }], academia_subtopics: [{ id: "subtopic", topic_id: "topic" }],
    academia_sessions: [{ id: "session", subtopic_id: "subtopic" }],
    academia_activities: [{ id: "mcq", session_id: "session", kind: "mcq", ref_id: "paper", title: "Quiz" }, { id: "adventure", session_id: "session", kind: "adventure", ref_id: "video", audio: { music: { path: "owner/music.mp3" } } }],
    academia_mcq_papers: [{ id: "paper", subject_id: "subject", title: "Algebra", questions: [{ n: 1, text: "Find x", answer: "A", options: [] }] }, { id: "hidden", subject_id: "hidden-subject", questions: [{ text: "PRIVATE QUESTION" }] }],
    academia_mcq_items: [{ activity_id: "mcq", n: 1, text: "Copied question", answer: "B", options: [] }],
    games: [{ id: "video", canvas: { video: { path: "owner/video.mp4", source: "storage" }, scenes: [{ id: "point", loopStart: 1, loopEnd: 5, elements: [] }] } }],
    academia_adventure_questions: [{ id: "copied", activity_id: "adventure", scene_id: "point", bar_id: "bar", question_text: "x=8", lines: [] }],
    academia_adventure_points: [{ activity_id: "adventure", scene_id: "point", pass_pct: 75 }],
  };
});
it("exports public subject papers, copied Session questions and Adventure assignments together", async () => {
  const response = await download(); const pack = await response.json();
  expect(pack.schema).toBe(6);
  expect(JSON.stringify(pack)).not.toContain("PRIVATE QUESTION");
  const subject = pack.schools[0].classes[0].subjects[0];
  expect(subject.papers[0].questions[0].answer).toBe("A");
  const [mcq, adventure] = subject.topics[0].subtopics[0].sessions[0].activities;
  expect(mcq.mcq.questions[0].answer).toBe("B");
  expect(adventure.adventure.questions[0]).toMatchObject({ id: "copied", sceneId: "point", questionText: "x=8" });
  expect(adventure.adventure.pass).toEqual({ point: 75 });
  expect(adventure.adventure.audio.music.path).toContain("adventureAsset=");
});
it("changes the content version when an answer changes without an activity timestamp", async () => {
  const before = await (await download()).json();
  state.tables.academia_mcq_items[0].answer = "C";
  const after = await (await download()).json();
  expect(after.version).not.toBe(before.version);
});
it("fails rather than replacing a saved download with silently missing questions", async () => {
  state.fail = "academia_mcq_items";
  await expect(download()).rejects.toThrow("academia_mcq_items");
});

it("serves linked public Adventure media and rejects private or unrelated assets", async () => {
  vi.stubGlobal("fetch", async () => new Response("clip", { headers: { "content-type": "audio/mpeg" } }));
  const request = (path: string) => (MediaRoute as any).server.handlers.GET({ request: new Request(`https://mathgpl.com/api/public/academia-media?activity=adventure&adventureAsset=${encodeURIComponent(path)}`) });
  try {
    expect((await request("owner/music.mp3")).status).toBe(200);
    expect((await request("owner/unlinked.mp3")).status).toBe(404);
    expect((await request("../secret.mp3")).status).toBe(404);
    state.tables.academia[0].visibility = "private";
    expect((await request("owner/music.mp3")).status).toBe(404);
  } finally { vi.unstubAllGlobals(); }
});
