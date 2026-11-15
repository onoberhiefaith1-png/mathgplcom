/* eslint-disable @typescript-eslint/no-explicit-any -- route handlers are untyped here */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAdmin, type Tables } from "./fakeAdmin";

const db: { tables: Tables; admin: ReturnType<typeof fakeAdmin> | null } = { tables: {}, admin: null };
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() { return db.admin; },
}));
import { Route } from "@/routes/api/public/arena/$code";

const SHARE = "20000000-0000-4000-8000-000000000001";
const SESSION = "30000000-0000-4000-8000-000000000001";
const ACT = "40000000-0000-4000-8000-000000000001";
const ASSESS = "50000000-0000-4000-8000-000000000001";
const TOKEN = "60000000-0000-4000-8000-000000000001";
const LINK = "70000000-0000-4000-8000-000000000001";
// A real 1x1 JPEG is not needed: the validator checks the signature and size only.
const JPEG = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString("base64")}`;

const h = (Route as any).server.handlers;
const get = async (code: string, qs: string) => h.GET({ params: { code }, request: new Request(`http://x/api/public/arena/${code}?${qs}`) }) as Promise<Response>;
const post = async (code: string, body: unknown) => (await h.POST({ params: { code }, request: new Request(`http://x/api/public/arena/${code}`, { method: "POST", body: JSON.stringify(body) }) })) as Response;

beforeEach(() => {
  db.tables = {
    arena_shares: [{ id: SHARE, code: "TASTUDENT01", display_code: "TDDISPLAY01", source_id: SESSION, guest_code: "GUEST01", title: "Group", entry_config: { name: "optional", photo: "optional" }, status: "open", created_at: new Date().toISOString() }],
    academia_sessions: [{ id: SESSION, title: "Linear equations", subtopic_id: null }],
    academia_activities: [{ id: ACT, session_id: SESSION, title: "Solve", kind: "question", assessment_id: ASSESS, class_id: null, subsection_id: null, position: 0 }],
    academia_mcq_items: [], academia_adventure_questions: [], assessments: [],
    guest_links: [{ id: LINK, code: "GUEST01" }],
    guest_attempts: [], guest_presence: [], arena_participants: [], arena_attempts: [], arena_bests: [],
  };
  db.admin = fakeAdmin(db.tables);
});

describe("Timer Arena route: a student's time reaches the Live Report", () => {
  it("join → start → marked correct → complete is counted and shows on the board with the picture", async () => {
    expect((await post("TASTUDENT01", { action: "join", token: TOKEN, name: "Amara", photo: JPEG })).status).toBe(200);
    expect((await post("TASTUDENT01", { action: "start", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS })).status).toBe(200);
    db.tables["guest_attempts"]!.push({ link_id: LINK, guest_token: TOKEN, assessment_id: ASSESS, score: 3, total_marks: 3 });
    const done = await (await post("TASTUDENT01", { action: "complete", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS, elapsedMs: 4200 })).json();
    expect(done).toMatchObject({ ok: true, counted: true });
    const board = await (await get("TDDISPLAY01", "action=board")).json();
    expect(board.columns[0].top[0]).toMatchObject({ name: "Amara" });
    const photo = board.columns[0].top[0].photo as string;
    expect(photo).toMatch(/^\/api\/public\/arena\/TDDISPLAY01\?action=photo&p=/);
    const img = await get("TDDISPLAY01", photo.split("?")[1]!);
    expect(img.status).toBe(200);
    expect(img.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("a finish that arrives before its marking lands is kept pending, then counted once the marks are saved", async () => {
    await post("TASTUDENT01", { action: "join", token: TOKEN, name: "Tunde" });
    const early = await (await post("TASTUDENT01", { action: "complete", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS, elapsedMs: 5000 })).json();
    expect(early).toMatchObject({ ok: true, counted: false, pending: true });
    db.tables["guest_attempts"]!.push({ link_id: LINK, guest_token: TOKEN, assessment_id: ASSESS, score: 2, total_marks: 2 });
    const late = await (await post("TASTUDENT01", { action: "complete", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS, elapsedMs: 5000 })).json();
    expect(late).toMatchObject({ ok: true, counted: true });
    expect(db.tables["arena_bests"]).toHaveLength(1);
  });

  it("a faster second sitting replaces the best; a slower one never does", async () => {
    await post("TASTUDENT01", { action: "join", token: TOKEN, name: "Chidi" });
    db.tables["guest_attempts"]!.push({ link_id: LINK, guest_token: TOKEN, assessment_id: ASSESS, score: 1, total_marks: 1 });
    for (const ms of [9000, 6000, 8000]) {
      await post("TASTUDENT01", { action: "start", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS });
      // The sitting really took a while (the test runs in microseconds).
      for (const a of db.tables["arena_attempts"]!) if (!a.completed_at) a.started_at = new Date(Date.now() - 60_000).toISOString();
      await post("TASTUDENT01", { action: "complete", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS, elapsedMs: ms });
    }
    expect(db.tables["arena_bests"]![0].best_ms).toBe(6000);
  });

  it("a database failure while saving the best is reported as retryable (503), never as saved", async () => {
    db.admin = fakeAdmin(db.tables, { failRpc: true });
    await post("TASTUDENT01", { action: "join", token: TOKEN, name: "Grace" });
    db.tables["guest_attempts"]!.push({ link_id: LINK, guest_token: TOKEN, assessment_id: ASSESS, score: 1, total_marks: 1 });
    const r = await post("TASTUDENT01", { action: "complete", token: TOKEN, assessmentId: ASSESS, questionId: ASSESS, elapsedMs: 3000 });
    expect(r.status).toBe(503);
  });

  it("the board lists everyone who joined with their picture, even before anyone finishes", async () => {
    await post("TASTUDENT01", { action: "join", token: TOKEN, name: "Zainab", photo: JPEG });
    const board = await (await get("TDDISPLAY01", "action=board")).json();
    expect(board.participants).toHaveLength(1);
    expect(board.participants[0]).toMatchObject({ name: "Zainab", presence: "active" });
    expect(board.participants[0].photo).toMatch(/action=photo/);
  });
});
