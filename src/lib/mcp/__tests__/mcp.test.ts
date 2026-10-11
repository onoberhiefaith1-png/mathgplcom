// MathGPL ChatGPT connector: auth, catalog, ownership isolation, confirmation
// and Smartboard command authorization. Fixtures only — no real accounts.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

/* ───────── in-memory database (deliberately WITHOUT row-level security, so
   every test proves the tool's own owner checks, not the database's) ───────── */
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
let idSeq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, "0")}`;

function subFromBearer(header: string | undefined): string | null {
  const token = header?.replace("Bearer ", "") ?? "";
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub ?? null;
  } catch {
    return null;
  }
}

function query(table: string) {
  const filters: [string, unknown][] = [];
  let mode: "select" | "update" | "insert" = "select";
  let patch: Row = {};
  let inserted: Row[] = [];
  let limitN = Infinity;
  const rows = () => (db[table] ??= []).filter((r) => filters.every(([k, v]) => r[k] === v));
  const run = () => {
    if (mode === "insert") return inserted;
    if (mode === "update") {
      const hit = rows();
      hit.forEach((r) => Object.assign(r, patch));
      return hit;
    }
    return rows().slice(0, limitN);
  };
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    in: () => q,
    order: () => q,
    limit: (n: number) => ((limitN = n), q),
    update: (p: Row) => ((mode = "update"), (patch = p), q),
    insert: (p: Row | Row[]) => {
      mode = "insert";
      inserted = (Array.isArray(p) ? p : [p]).map((r) => ({ id: newId(), ...r }));
      (db[table] ??= []).push(...inserted);
      return q;
    },
    maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    single: async () => {
      const r = run()[0];
      return r ? { data: r, error: null } : { data: null, error: { message: "no rows" } };
    },
    then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
  };
  return q;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: (_u: string, _k: string, opts: { global?: { headers?: Record<string, string> } }) => {
    const sub = subFromBearer(opts?.global?.headers?.Authorization);
    return {
      auth: { getUser: async () => ({ data: { user: sub ? { id: sub } : null }, error: null }) },
      from: (t: string) => query(t),
    };
  },
}));

/* ───────── a local OAuth issuer standing in for the real one ───────── */
const ISSUER = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset"}.supabase.co/auth/v1`;
let privateKey: CryptoKey;
let foreignKey: CryptoKey;
let jwks: unknown;

const TEACHER_A = "aaaaaaaa-0000-4000-8000-000000000001";
const TEACHER_B = "bbbbbbbb-0000-4000-8000-000000000002";

async function token(sub: string, extra: Row = { client_id: "chatgpt-test" }, key = privateKey, iss = ISSUER) {
  return new SignJWT({ role: "authenticated", ...extra })
    .setProtectedHeader({ alg: "ES256", kid: "test", typ: "JWT" })
    .setSubject(sub)
    .setIssuer(iss)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}

beforeAll(async () => {
  process.env.SUPABASE_URL = "https://fixture.invalid";
  process.env.SUPABASE_PUBLISHABLE_KEY = "fixture-publishable";
  const pair = await generateKeyPair("ES256");
  privateKey = pair.privateKey as CryptoKey;
  foreignKey = (await generateKeyPair("ES256")).privateKey as CryptoKey;
  jwks = { keys: [{ ...(await exportJWK(pair.publicKey)), kid: "test", alg: "ES256", use: "sig" }] };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("jwks")) return Response.json(jwks);
    if (url.includes("/.well-known/")) return Response.json({ issuer: ISSUER, jwks_uri: `${ISSUER}/.well-known/jwks.json` });
    return realFetch(input, init);
  }) as typeof fetch;
});

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  db.notebooks = [
    { id: "11111111-0000-4000-8000-00000000000a", owner_id: TEACHER_A, title: "Fixture A note" },
    { id: "22222222-0000-4000-8000-00000000000b", owner_id: TEACHER_B, title: "Fixture B note" },
  ];
});

const NOTE_A = "11111111-0000-4000-8000-00000000000a";
const NOTE_B = "22222222-0000-4000-8000-00000000000b";

async function handlers() {
  const { default: mcp } = await import("../index");
  const tanstack = await import("@lovable.dev/mcp-js/stacks/tanstack");
  const opts = { resourcePath: "/mcp", metadataPath: "/.well-known/oauth-protected-resource" };
  return {
    mcp: tanstack.createTanStackMcpHandler(mcp, opts),
    invoke: tanstack.createTanStackInvokeToolHandler(mcp, opts),
  };
}

async function rpc(method: string, params: Row, bearer?: string) {
  const { mcp } = await handlers();
  const res = await mcp({
    request: new Request("https://mathgpl.com/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  });
  const text = await res.text();
  const json = text.startsWith("{") ? JSON.parse(text) : JSON.parse(text.split("data: ").pop()!.split("\n")[0]);
  return { status: res.status, headers: res.headers, json };
}

async function call(name: string, args: Row, sub = TEACHER_A) {
  const r = await rpc("tools/call", { name, arguments: args }, await token(sub));
  return r.json.result as { isError?: boolean; content: { text: string }[] };
}

/* ───────── authentication / token validation ───────── */
describe("MCP authentication", () => {
  it("rejects a request with no token and points to the metadata", async () => {
    const r = await rpc("tools/list", {});
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain("/.well-known/oauth-protected-resource");
  });
  it("rejects a token signed by a different key", async () => {
    expect((await rpc("tools/list", {}, await token(TEACHER_A, { client_id: "x" }, foreignKey))).status).toBe(401);
  });
  it("rejects a token from a different issuer", async () => {
    expect((await rpc("tools/list", {}, await token(TEACHER_A, { client_id: "x" }, privateKey, "https://evil.invalid/auth/v1"))).status).toBe(401);
  });
  it("rejects a copied app session token that has no OAuth client claim", async () => {
    expect((await rpc("tools/list", {}, await token(TEACHER_A, {}))).status).toBe(401);
  });
  it("accepts a valid OAuth token", async () => {
    expect((await rpc("tools/list", {}, await token(TEACHER_A))).status).toBe(200);
  });
});

/* ───────── catalog ───────── */
describe("tools/list", () => {
  it("lists the core lesson-note and Smartboard tools with input schemas", async () => {
    const r = await rpc("tools/list", {}, await token(TEACHER_A));
    const tools = r.json.result.tools as { name: string; description: string; inputSchema: Row }[];
    const names = tools.map((t) => t.name);
    for (const n of ["create_notebook", "get_notebook", "update_notebook", "list_notebooks", "open_screen", "smartboard_control", "get_current_view"]) {
      expect(names).toContain(n);
    }
    expect(new Set(names).size).toBe(names.length);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
  });
  it("never exposes Aura-internal or web-fetching tools", async () => {
    const r = await rpc("tools/list", {}, await token(TEACHER_A));
    const names = (r.json.result.tools as { name: string }[]).map((t) => t.name);
    for (const n of ["propose_knowledge", "recall_knowledge", "read_attachment", "web_search", "read_web_page", "study_tutorial", "navigate"]) expect(names).not.toContain(n);
  });
});

/* ───────── lesson-note ownership isolation ───────── */
describe("lesson-note ownership", () => {
  it("creates a note owned by the caller, never by an id in the input", async () => {
    const r = await call("create_notebook", { title: "Fixture new note" });
    expect(r.isError).toBeFalsy();
    const created = db.notebooks.find((n) => n.title === "Fixture new note");
    expect(created?.owner_id).toBe(TEACHER_A);
  });
  it("reads the caller's own note", async () => {
    expect((await call("get_notebook", { id: NOTE_A })).isError).toBeFalsy();
  });
  it("refuses to read another teacher's note", async () => {
    const r = await call("get_notebook", { id: NOTE_B });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).not.toContain("Fixture B note");
  });
  it("lists only the caller's notes", async () => {
    const r = await call("list_notebooks", {});
    expect(r.content[0].text).toContain("Fixture A note");
    expect(r.content[0].text).not.toContain("Fixture B note");
  });
  it("refuses to rename another teacher's note", async () => {
    const r = await call("update_notebook", { id: NOTE_B, title: "Hijacked" });
    expect(r.isError).toBe(true);
    expect(db.notebooks.find((n) => n.id === NOTE_B)?.title).toBe("Fixture B note");
  });
  it("refuses to append sections to another teacher's note", async () => {
    const r = await call("update_notebook", { id: NOTE_B, appendSections: [{ kind: "summary", blocks: [] }] });
    expect(r.isError).toBe(true);
    expect((db.notebook_sections ?? []).length).toBe(0);
  });
  it("updates the caller's own note", async () => {
    expect((await call("update_notebook", { id: NOTE_A, title: "Renamed" })).isError).toBeFalsy();
    expect(db.notebooks.find((n) => n.id === NOTE_A)?.title).toBe("Renamed");
  });
});

/* ───────── destructive-action confirmation ───────── */
describe("destructive actions", () => {
  it("refuse to run until the teacher has confirmed", async () => {
    const { AGENT_TOOL_MANIFEST } = await import("@/lib/agent/toolTypes");
    const destructive = AGENT_TOOL_MANIFEST.filter((s) => s.needsConfirmation);
    expect(destructive.length).toBeGreaterThan(0);
    const spec = destructive[0];
    const args: Row = {};
    for (const p of spec.params) if (p.required) args[p.name] = p.type === "number" ? 1 : p.type === "boolean" ? true : p.type.endsWith("[]") ? [] : NOTE_A;
    const before = JSON.stringify(db);
    const r = await call(spec.id, args);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/confirm/i);
    expect(JSON.stringify(db)).toBe(before);
  });
});

/* ───────── Smartboard command authorization ───────── */
describe("Smartboard live commands", () => {
  it("sends commands only to the caller's own windows", async () => {
    await call("smartboard_control", { action: "next", times: 2 });
    const cmds = db.chatgpt_commands ?? [];
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ user_id: TEACHER_A, command: "smartboard", payload: { action: "next", times: 2 } });
  });
  it("refuses to open another teacher's note on the Smartboard", async () => {
    const r = await call("open_screen", { target: "smartboard", notebookId: NOTE_B });
    expect(r.isError).toBe(true);
    expect(db.chatgpt_commands ?? []).toHaveLength(0);
  });
  it("caps step jumps at 20", async () => {
    const r = await call("smartboard_control", { action: "next", times: 50 });
    expect(r.isError).toBe(true);
    expect(db.chatgpt_commands ?? []).toHaveLength(0);
  });
  it("sends nothing without a valid token", async () => {
    const r = await rpc("tools/call", { name: "smartboard_control", arguments: { action: "next" } });
    expect(r.status).toBe(401);
    expect(db.chatgpt_commands ?? []).toHaveLength(0);
  });
});

/* ───────── registry quality ───────── */
describe("tool registry quality", () => {
  it("every tool has a title, a clear description, a closed schema and described parameters", async () => {
    const r = await rpc("tools/list", {}, await token(TEACHER_A));
    const tools = r.json.result.tools as { name: string; title?: string; description: string; inputSchema: Row; annotations?: Row }[];
    const missing: string[] = [];
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]*$/);
      if (!t.title) missing.push(`${t.name}: title`);
      if (t.description.length < 20) missing.push(`${t.name}: description`);
      if (Object.keys((t.inputSchema.properties ?? {}) as Row).length && t.inputSchema.additionalProperties !== false) missing.push(`${t.name}: open schema`);
      const props = (t.inputSchema.properties ?? {}) as Record<string, Row>;
      for (const [k, v] of Object.entries(props)) if (!v.description) missing.push(`${t.name}.${k}: description`);
    }
    expect(missing).toEqual([]);
  });
  it("never accepts an owner or user id from the caller", async () => {
    const r = await rpc("tools/list", {}, await token(TEACHER_A));
    for (const t of r.json.result.tools as { name: string; inputSchema: Row }[]) {
      const keys = Object.keys((t.inputSchema.properties ?? {}) as Row);
      for (const bad of ["owner_id", "ownerId", "user_id", "userId"]) expect(keys, t.name).not.toContain(bad);
    }
  });
});

/* ───────── Smartboard input validation ───────── */
describe("Smartboard input validation", () => {
  const rejects = async (name: string, args: Row) => {
    const r = await call(name, args);
    expect(r.isError).toBe(true);
    expect(db.chatgpt_commands ?? []).toHaveLength(0);
  };
  it("rejects an unknown screen", () => rejects("open_screen", { target: "admin" }));
  it("requires a notebook for the Smartboard", () => rejects("open_screen", { target: "smartboard" }));
  it("rejects a notebook id that is not a uuid", () => rejects("open_screen", { target: "note", notebookId: "../x" }));
  it("rejects an unknown Smartboard action", () => rejects("smartboard_control", { action: "delete" }));
  it("rejects zero or fractional steps", async () => {
    await rejects("smartboard_control", { action: "next", times: 0 });
    await rejects("smartboard_control", { action: "next", times: 1.5 });
  });
  it("ignores an undeclared target user and only commands the caller's own window", async () => {
    await call("smartboard_control", { action: "next", userId: TEACHER_B });
    const cmds = db.chatgpt_commands ?? [];
    expect(cmds.every((c) => c.user_id === TEACHER_A)).toBe(true);
    expect(cmds.some((c) => c.user_id === TEACHER_B)).toBe(false);
  });
});

/* ───────── lesson-note size limits (ported from the integration draft) ───────── */
describe("lesson-note size limits", () => {
  it("rejects an empty or blank title", async () => {
    expect((await call("create_notebook", { title: "   " })).isError).toBe(true);
  });
  it("rejects a title over 200 characters", async () => {
    expect((await call("create_notebook", { title: "x".repeat(201) })).isError).toBe(true);
  });
  it("rejects more than 50 sections in one call", async () => {
    const sections = Array.from({ length: 51 }, () => ({ kind: "summary" }));
    expect((await call("create_notebook", { title: "Fixture big", sections })).isError).toBe(true);
    expect(db.notebooks.some((n) => n.title === "Fixture big")).toBe(false);
  });
  it("rejects appending more than 50 sections", async () => {
    const appendSections = Array.from({ length: 51 }, () => ({ kind: "summary" }));
    expect((await call("update_notebook", { id: NOTE_A, appendSections })).isError).toBe(true);
  });
});
