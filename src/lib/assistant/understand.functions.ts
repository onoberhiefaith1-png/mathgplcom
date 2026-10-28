// Talking MathGPL's brain: a small, cheap model reads the MathGPL map and picks
// ONE destination/action from what the teacher said. It never writes mathematics.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMMAND_KINDS, describeApp, type BrainPick, type ScreenView } from "./appMap";
import type { Known } from "./matcher";

const MODEL = "google/gemini-3.1-flash-lite";

const SYSTEM = `You are MathGPL itself, talking. You know the app from the map below and act by choosing exactly one action.
Rules:
- Understand meaning in any wording or language; never ask the user to rephrase if the intent is clear.
- Use ids ONLY from the lists. Paths ONLY from PAGES.
- You never write, solve or check mathematics. Requests to produce maths content go to make_note, copilot_say or ai_edit with the teacher's words.
- If the teacher asks how to edit a document or a table, do it: choose ai_edit with their instruction (and the note id if named).
- ON SCREEN NOW lists what is already open. Never tell the teacher to open something listed there; act on it. "Tutorial", "guide", "teach me", "walk me through" on an open question means guide_start.
- If the teacher says "done", "I have opened it" or similar, repeat the action they asked for just before.
- "reply" is one short friendly spoken sentence in the teacher's language saying what you are doing.
- Use clarify only when two different actions are equally likely.`;

const nullable = (type: string) => ({ type: [type, "null"] });
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: [...COMMAND_KINDS] },
    reply: nullable("string"), path: nullable("string"), label: nullable("string"), id: nullable("string"),
    classId: nullable("string"), topic: nullable("string"), subtopic: nullable("string"), className: nullable("string"),
    extra: nullable("string"), text: nullable("string"), instruction: nullable("string"), n: nullable("number"),
    from: nullable("number"), to: nullable("number"), numbers: { type: ["array", "null"], items: { type: "number" } },
    a: nullable("string"), b: nullable("string"),
  },
  required: ["kind", "reply", "path", "label", "id", "classId", "topic", "subtopic", "className", "extra", "text", "instruction", "n", "from", "to", "numbers", "a", "b"],
};

type Input = { text: string; here: string; known: Known; history: { who: string; text: string }[]; screen: ScreenView | null };

export const understandRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown): Input => {
    const v = (raw ?? {}) as Partial<Input>;
    const text = String(v.text ?? "").slice(0, 600);
    if (!text.trim()) throw new Error("Nothing to understand.");
    const ents = (xs: unknown) => (Array.isArray(xs) ? xs : []).slice(0, 60).map((x) => ({ id: String((x as { id?: unknown }).id ?? ""), name: String((x as { name?: unknown }).name ?? "").slice(0, 80) }));
    const k = (v.known ?? {}) as Partial<Known>;
    const sc = v.screen && typeof v.screen === "object" ? (v.screen as Partial<ScreenView>) : null;
    return {
      text,
      here: String(v.here ?? "/").slice(0, 200),
      known: { classes: ents(k.classes), notes: ents(k.notes), games: ents(k.games) },
      history: (Array.isArray(v.history) ? v.history : []).slice(-6).map((h) => ({ who: String(h.who), text: String(h.text).slice(0, 300) })),
      screen: sc ? {
        page: String(sc.page ?? "other").slice(0, 40),
        question: sc.question ? String(sc.question).slice(0, 200) : null,
        hasSolution: !!sc.hasSolution,
        available: (Array.isArray(sc.available) ? sc.available : []).slice(0, 40).map((a) => String(a).slice(0, 40)),
      } : null,
    };
  })
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, status: 401, error: "Talking MathGPL is not configured yet.", pick: null };
    const messages = [
      { role: "system", content: `${SYSTEM}\n\n${describeApp(data.known, data.here, data.screen)}` },
      ...data.history.map((h) => ({ role: h.who === "you" ? "user" : "assistant", content: h.text })),
      { role: "user", content: data.text },
    ];
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: MODEL,
        messages,
        max_tokens: 300,
        response_format: { type: "json_schema", json_schema: { name: "pick", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok) {
      let msg = "";
      try { const j = (await res.json()) as { message?: string; error?: { message?: string } }; msg = j.message ?? j.error?.message ?? ""; } catch { /* ignore */ }
      const error = res.status === 402 ? msg || "AI credits have run out, so I'll use simple commands for now."
        : res.status === 429 ? "I'm busy for a moment, so I'll use simple commands."
        : msg || "I couldn't think just now.";
      return { ok: false as const, status: res.status, error, pick: null };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    const { meterTurn } = await import("@/lib/agent/auraMeter.server");
    await meterTurn(context.userId, MODEL, json.usage?.prompt_tokens ?? 0, json.usage?.completion_tokens ?? 0, "mathgpl_tutor");
    try {
      const raw = json.choices?.[0]?.message?.content ?? "";
      const pick = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "") as BrainPick;
      return { ok: true as const, status: 200, error: null, pick };
    } catch {
      return { ok: false as const, status: 422, error: "I didn't quite understand.", pick: null };
    }
  });
