/**
 * LOCAL DEV ONLY. A tiny in-memory stand-in for the Supabase tables the public
 * Academia pack reads, so `/api/public/academia-pack` can be exercised on a
 * plain `vite dev` without the service-role key (which is never stored locally).
 *
 * Enabled only when ACADEMIA_PACK_FIXTURE=1 (e.g. in the git-ignored
 * `.env.local`) AND NODE_ENV !== "production" (and never under Vitest). Production never reads this.
 * The rows run through the real pack builder, so the response shape is exactly
 * what a real school would produce, including the tier batch (§6) and the three
 * per-tier Session videos (§1).
 */
import type { PackDb } from "./packQuery";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const line = (questionId: string, n: number, equation: string, fillers: string[]) => ({
  lineId: `${questionId}-l${n}`, questionId, equation, fillers,
  containers: [], arrangement: fillers.map((_, i) => i).reverse(), marks: 1,
});

const practice = (id: string, tier: string, position: number, title: string) => ({
  id, session_id: "dev-session-linear", title, kind: "practice", tier, position,
  ref_id: null, audio: null, subsection_id: `sub-${id}`, question_key: `sub-${id}`,
  question_design: null, practice_video: null, play_video: null, thumbnail_path: null,
  question_image_path: null, game_id: null, updated_at: "2026-10-31T00:00:00Z",
});

const QUESTIONS: Record<string, { q: string; lines: [string, string[]][] }> = {
  "dev-b1": { q: "x + 3 = 7", lines: [["x + 3 = 7", []], ["x = 7 - 3", ["x", "=", "7", "-3"]], ["x = 4", ["x", "=", "4"]]] },
  "dev-b2": { q: "2x = 10", lines: [["2x = 10", []], ["x = 10 / 2", ["x", "=", "10", "/2"]], ["x = 5", ["x", "=", "5"]]] },
  "dev-i1": { q: "3x + 2 = 14", lines: [["3x + 2 = 14", []], ["3x = 12", ["3x", "=", "12"]], ["x = 4", ["x", "=", "4"]]] },
  "dev-i2": { q: "5x - 4 = 21", lines: [["5x - 4 = 21", []], ["5x = 25", ["5x", "=", "25"]], ["x = 5", ["x", "=", "5"]]] },
  "dev-e1": { q: "2(x + 3) = 3x - 1", lines: [["2(x + 3) = 3x - 1", []], ["2x + 6 = 3x - 1", ["2x", "+6", "=", "3x", "-1"]], ["7 = x", ["7", "=", "x"]]] },
};

function tables(): Record<string, Row[]> {
  const activities = [
    practice("dev-b1", "beginner", 1, "Beginner 1: one-step add"),
    practice("dev-b2", "beginner", 2, "Beginner 2: one-step multiply"),
    practice("dev-i1", "intermediate", 1, "Intermediate 1: two-step"),
    practice("dev-i2", "intermediate", 2, "Intermediate 2: two-step"),
    practice("dev-e1", "expert", 1, "Expert 1: brackets both sides"),
    { ...practice("dev-mcq", "beginner", 3, "Beginner quiz"), kind: "mcq", ref_id: "dev-paper", subsection_id: null, question_key: null },
  ];
  const subsections = Object.entries(QUESTIONS).map(([id, { lines }]) => ({
    id: `sub-${id}`, section_id: "dev-section",
    floating_lines: lines.map(([eq, f], i) => line(`sub-${id}`, i, eq, f)),
  }));
  const blocks = Object.entries(QUESTIONS).map(([id, { q }]) => ({
    subsection_id: `sub-${id}`, kind: "problem", content_ascii: q, content_json: null, order_index: 0,
  }));
  return {
    academia: [{ id: "dev-academia", org_id: "dev-org", name: "Local Dev Academia", description: "Fixture pack for local re-tests", visibility: "public", updated_at: "2026-10-31T00:00:00Z" }],
    organizations: [{ id: "dev-org", name: "Local Dev School" }],
    academia_classes: [{ id: "dev-class", academia_id: "dev-academia", name: "Year 9", position: 1 }],
    academia_subjects: [{ id: "dev-subject", class_id: "dev-class", name: "Mathematics", position: 1 }],
    academia_topics: [{ id: "dev-topic", subject_id: "dev-subject", name: "Algebra", position: 1 }],
    academia_subtopics: [{ id: "dev-subtopic", topic_id: "dev-topic", name: "Linear equations", position: 1 }],
    academia_sessions: [
      // All three tier slots filled: click-to-play test.
      { id: "dev-session-linear", subtopic_id: "dev-subtopic", title: "Solving linear equations", description: "Three tiers, three videos", position: 1,
        video_url: "https://www.youtube.com/watch?v=Qyd_v3DGzTM", intermediate_video_url: "https://www.youtube.com/watch?v=l3XzepN03KQ", expert_video_url: "https://www.youtube.com/watch?v=bAerID24QJ0" },
      // Only Beginner filled: the other two show their empty state (no fallback).
      { id: "dev-session-empty", subtopic_id: "dev-subtopic", title: "Empty tier slots", description: "Only a Beginner video", position: 2,
        video_url: "https://www.youtube.com/watch?v=Qyd_v3DGzTM", intermediate_video_url: null, expert_video_url: null },
    ],
    academia_activities: [
      ...activities,
      { ...practice("dev-empty-b1", "beginner", 1, "Beginner only activity"), session_id: "dev-session-empty", subsection_id: "sub-dev-b1", question_key: "sub-dev-b1" },
    ],
    academia_mcq_papers: [{ id: "dev-paper", subject_id: "dev-subject", title: "Algebra quiz", position: 1, questions: [{ n: 1, text: "Solve x + 2 = 5", options: ["2", "3", "4", "5"], answer: "B", solution: "x = 3" }] }],
    academia_mcq_items: [{ activity_id: "dev-mcq", n: 1, text: "Solve x + 2 = 5", options: ["2", "3", "4", "5"], answer: "B", position: 1 }],
    games: [], academia_adventure_questions: [], academia_adventure_points: [], slate_games: [],
    notebook_subsections: subsections,
    notebook_sections: [{ id: "dev-section", notebook_id: "dev-notebook" }],
    notebook_blocks: blocks,
  };
}

export const devPackFixtureEnabled = () =>
  typeof process !== "undefined" && process.env?.ACADEMIA_PACK_FIXTURE === "1" && process.env?.NODE_ENV !== "production" && !process.env?.VITEST;

/** Minimal PostgREST-like query builder over the fixture rows. */
export function devPackDb(): PackDb {
  const data = tables();
  return {
    from(table: string) {
      let rows = [...(data[table] ?? [])];
      const keys: string[] = [];
      const sorted = () => [...rows].sort((a, b) => {
        for (const k of keys) {
          const c = String(a[k] ?? "").localeCompare(String(b[k] ?? ""), undefined, { numeric: true });
          if (c) return c;
        }
        return 0;
      });
      const q: any = { // eslint-disable-line @typescript-eslint/no-explicit-any
        select: () => q, limit: (n: number) => { rows = rows.slice(0, n); return q; },
        order: (key: string) => { keys.push(key); return q; },
        eq: (key: string, value: unknown) => { rows = rows.filter((r) => r[key] === value); return q; },
        in: (key: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[key])); return q; },
        range: (from: number, to: number) => { rows = sorted().slice(from, to + 1); keys.length = 0; return q; },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => Promise.resolve({ data: sorted(), error: null }).then(resolve, reject),
      };
      return q;
    },
  };
}
