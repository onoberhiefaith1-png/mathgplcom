// Aura's eyes on a file the teacher gave her.
//
// The file never leaves the teacher's own private area: it is fetched with the
// teacher's own database client (so row-level security applies exactly as it
// does in the app), read straight into the model request, and only the reading
// comes back. Nothing here writes lesson notes — once Aura has read a file she
// uses her ordinary lesson-note hands to turn it into work.

import type { SupabaseClient } from "@supabase/supabase-js";

type Ctx = { supabase: SupabaseClient<never, "public", never>; userId: string };
type Args = Record<string, unknown>;
type AnyDb = { from: (table: string) => any };

const BUCKET = "aura-attachments";
const MODEL = "openai/gpt-6-astra";

const str = (args: Args, key: string): string | undefined => {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

const base64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
};

type Row = { id: string; name: string; mime: string; path: string; size_bytes: number };

/** Find the file by id, or by the closest name the teacher used. */
async function findFile(ctx: Ctx, args: Args): Promise<Row> {
  const db = ctx.supabase as unknown as AnyDb;
  const id = str(args, "attachmentId");
  if (id) {
    const { data, error } = await db
      .from("aura_attachments")
      .select("id, name, mime, path, size_bytes")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("I can't find that file. Ask me to list your files.");
    return data as Row;
  }

  const name = str(args, "name");
  const { data, error } = await db
    .from("aura_attachments")
    .select("id, name, mime, path, size_bytes")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) throw new Error("You haven't given me any files yet.");
  if (!name) return rows[0] as Row;
  const needle = name.toLowerCase();
  const match =
    rows.find((row) => row.name.toLowerCase() === needle) ??
    rows.find((row) => row.name.toLowerCase().includes(needle));
  if (!match) throw new Error(`I have no file called "${name}".`);
  return match;
}

/** Ask the model to read the file and report what is in it. */
async function readWithModel(file: Row, bytes: Uint8Array, instruction: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("The reading service isn't configured on this platform yet.");

  const data = `data:${file.mime};base64,${base64(bytes)}`;
  const part =
    file.mime === "application/pdf"
      ? { type: "input_file", filename: file.name, file_data: data }
      : { type: "input_image", image_url: data };

  const response = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: instruction }, part],
        },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 402) {
      throw new Error("This workspace has run out of AI credits, so I can't read the file.");
    }
    throw new Error(`I couldn't read that file (${response.status}). ${detail.slice(0, 300)}`);
  }

  // The reading is streamed; nothing shows progressively here, so the pieces are
  // collected and handed back whole.
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      for (const line of event.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
            text += parsed.delta;
          }
          if (parsed.type === "response.completed" && !text && parsed.response?.output_text) {
            text = parsed.response.output_text;
          }
        } catch {
          /* a half-formed event is simply skipped */
        }
      }
    }
  }

  const said = text.trim();
  if (!said) throw new Error("I opened the file but came back with nothing readable in it.");
  return said;
}

const DEFAULT_INSTRUCTION = [
  "Read this file for a mathematics teacher.",
  "Write out every question you can see, exactly as written, keeping numbering.",
  "Then list the topics covered. Do not solve anything yet.",
  "If the page is unreadable or empty, say so plainly.",
].join(" ");

export const attachmentExecutors = {
  list_attachments: async (ctx: Ctx) => {
    const db = ctx.supabase as unknown as AnyDb;
    const { data, error } = await db
      .from("aura_attachments")
      .select("id, name, mime, size_bytes, created_at")
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as any[];
    return {
      data: rows,
      summary:
        rows.length === 0
          ? "You haven't given me any files yet."
          : `${rows.length} file${rows.length === 1 ? "" : "s"}: ${rows.map((r) => r.name).join(", ")}.`,
    };
  },

  read_attachment: async (ctx: Ctx, args: Args) => {
    const file = await findFile(ctx, args);
    const { data: blob, error } = await ctx.supabase.storage.from(BUCKET).download(file.path);
    if (error || !blob) throw new Error("I couldn't open that file from your files area.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const instruction = str(args, "instruction") ?? DEFAULT_INSTRUCTION;
    const reading = await readWithModel(file, bytes, instruction);
    return {
      data: { attachmentId: file.id, name: file.name, mime: file.mime, reading },
      summary: `Read "${file.name}".`,
    };
  },
};
