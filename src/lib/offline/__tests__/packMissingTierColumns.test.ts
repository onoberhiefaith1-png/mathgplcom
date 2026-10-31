import { expect, it, vi } from "vitest";
// A database that has not had migrations 0022/0023 yet: selecting a tier column fails like PostgREST does.
const missing = ["tier", "intermediate_video_url", "expert_video_url"];
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: unknown) => options }));
vi.mock("@/lib/slate/storage", () => ({ normalizeGame: (g: unknown) => g }));
vi.mock("@/integrations/supabase/client.server", () => {
  const tables: Record<string, any[]> = {
    academia: [{ id: "a", org_id: "o", visibility: "public" }], organizations: [{ id: "o", name: "School" }],
    academia_classes: [{ id: "c", academia_id: "a" }], academia_subjects: [{ id: "s", class_id: "c" }],
    academia_topics: [{ id: "t", subject_id: "s" }], academia_subtopics: [{ id: "u", topic_id: "t" }],
    academia_sessions: [{ id: "se", subtopic_id: "u", video_url: "https://youtu.be/Qyd_v3DGzTM" }],
    academia_activities: [{ id: "q", session_id: "se", kind: "mcq", ref_id: "p", title: "Quiz" }],
  };
  return { supabaseAdmin: { from(table: string) {
    let rows = [...(tables[table] ?? [])]; let cols = "";
    const q: any = { select: (c: string) => { cols = c; return q; }, order: () => q, limit: () => q, range: () => q,
      eq: (k: string, v: unknown) => { rows = rows.filter((r) => r[k] === v); return q; },
      in: (k: string, v: unknown[]) => { rows = rows.filter((r) => v.includes(r[k])); return q; },
      then: (resolve: (v: unknown) => void) => {
        const bad = missing.find((c) => cols.split(",").includes(c));
        resolve(bad ? { data: null, error: { message: `column ${table}.${bad} does not exist` } } : { data: rows, error: null });
      } };
    return q;
  } } };
});
import { Route } from "@/routes/api/public/academia-pack";

it("still serves the pack when the tier columns are not migrated yet (Beginner default, empty extra slots)", async () => {
  const pack = await ((await (Route as any).server.handlers.GET()) as Response).json();
  const session = pack.schools[0].classes[0].subjects[0].topics[0].subtopics[0].sessions[0];
  expect(session.videos).toEqual({ beginner: "https://youtu.be/Qyd_v3DGzTM", intermediate: null, expert: null });
  expect(session.activities[0].tier).toBe("beginner");
});
