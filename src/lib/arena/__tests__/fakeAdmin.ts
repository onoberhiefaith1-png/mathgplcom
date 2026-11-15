/* eslint-disable @typescript-eslint/no-explicit-any -- a tiny in-memory PostgREST stand-in for route tests */
export type Tables = Record<string, any[]>;
let seq = 0;
const uuid = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;

/** Enough of supabase-js's query builder for the Arena route: filters, insert/update, maybeSingle. */
export function fakeAdmin(tables: Tables, opts: { failRpc?: boolean } = {}) {
  const calls: { table: string; op: string; row?: any }[] = [];
  const from = (table: string) => {
    tables[table] ??= [];
    let filters: ((r: any) => boolean)[] = [];
    let op: "select" | "insert" | "update" = "select";
    let payload: any = null;
    let single: "one" | "maybe" | null = null;
    let head = false;
    let count = false;
    let cols = "*";
    const run = () => {
      const all = tables[table]!;
      if (op === "insert") {
        const rows = (Array.isArray(payload) ? payload : [payload]).map((r: any) => ({ id: uuid(), ...defaults(table), ...r }));
        for (const r of rows) {
          const clash = uniqueClash(table, all, r);
          if (clash) return { data: null, error: { message: `duplicate key value violates unique constraint "${clash}"` } };
        }
        all.push(...rows); calls.push({ table, op, row: rows[0] });
        return shape(rows);
      }
      const hit = all.filter((r) => filters.every((f) => f(r)));
      if (op === "update") { for (const r of hit) Object.assign(r, payload); calls.push({ table, op, row: payload }); return shape(hit); }
      if (count) return { data: head ? null : hit, error: null, count: hit.length };
      return shape(hit);
    };
    const shape = (rows: any[]) => {
      const pick = (r: any) => (cols === "*" ? { ...r } : Object.fromEntries(cols.split(",").map((c) => c.trim()).filter(Boolean).map((c) => [c, r[c] ?? null])));
      const missing = cols.split(",").map((c) => c.trim()).find((c) => c !== "*" && c && rows[0] && !(c in rows[0]) && !(c in defaults(table)));
      if (missing && missingColumns[table]?.includes(missing)) return { data: null, error: { message: `column ${table}.${missing} does not exist` } };
      if (single === "one") return rows.length === 1 ? { data: pick(rows[0]), error: null } : { data: null, error: { message: "not one row" } };
      if (single === "maybe") return rows.length > 1 ? { data: null, error: { message: "multiple rows" } } : { data: rows[0] ? pick(rows[0]) : null, error: null };
      return { data: rows.map(pick), error: null };
    };
    const q: any = {
      select: (c = "*", o?: { count?: string; head?: boolean }) => { cols = c; if (o?.count) count = true; if (o?.head) head = true; return q; },
      insert: (r: any) => { op = "insert"; payload = r; return q; },
      update: (p: any) => { op = "update"; payload = p; return q; },
      eq: (k: string, v: unknown) => { filters.push((r) => r[k] === v); return q; },
      in: (k: string, v: unknown[]) => { filters.push((r) => v.includes(r[k])); return q; },
      is: (k: string, v: unknown) => { filters.push((r) => (r[k] ?? null) === v); return q; },
      order: () => q, limit: () => q,
      maybeSingle: () => { single = "maybe"; return q; },
      single: () => { single = "one"; return q; },
      then: (res: (v: unknown) => void, rej?: (e: unknown) => void) => Promise.resolve(run()).then(res, rej),
    };
    return q;
  };
  const rpc = (name: string, a: Record<string, any>) => {
    if (name !== "arena_promote_best") return Promise.resolve({ data: null, error: { message: "no such function" } });
    if (opts.failRpc) return Promise.resolve({ data: null, error: { message: "rpc failed" } });
    const all = (tables["arena_bests"] ??= []);
    const old = all.find((b) => b.share_id === a._share && b.participant_id === a._participant && b.assessment_id === a._assessment && b.question_id === a._question);
    if (!old) { all.push({ share_id: a._share, participant_id: a._participant, assessment_id: a._assessment, question_id: a._question, best_ms: a._ms, achieved_at: a._at, attempt_id: a._attempt }); return Promise.resolve({ data: true, error: null }); }
    if (a._ms < old.best_ms) { Object.assign(old, { best_ms: a._ms, achieved_at: a._at, attempt_id: a._attempt }); return Promise.resolve({ data: true, error: null }); }
    return Promise.resolve({ data: false, error: null });
  };
  return { from, rpc, calls };
}

export const missingColumns: Record<string, string[]> = {};

const defaults = (table: string): Record<string, unknown> => {
  const now = new Date().toISOString();
  if (table === "arena_participants") return { joined_at: now, last_seen_at: now, display_name: null, avatar_key: null, avatar_photo: null, avatar_photo_at: null };
  if (table === "arena_attempts") return { started_at: now, completed_at: null, elapsed_ms: null, success: false };
  return {};
};
const uniqueClash = (table: string, all: any[], r: any): string | null => {
  if (table === "arena_participants") {
    if (all.some((x) => x.share_id === r.share_id && x.device_token === r.device_token)) return "arena_participants_share_id_device_token_key";
    if (all.some((x) => x.share_id === r.share_id && x.anon_label === r.anon_label)) return "arena_participants_share_id_anon_label_key";
  }
  return null;
};
