/** Minimal Lovable AI Gateway call (Responses API) returning plain text. */
export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function gatewayText(instructions: string, input: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new GatewayError(401, "AI is not configured for this app yet.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-6-astra", instructions, input }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = "";
    try { msg = (JSON.parse(body) as { message?: string; error?: { message?: string } }).message ?? JSON.parse(body).error?.message ?? ""; } catch { /* plain */ }
    const friendly =
      res.status === 402 ? msg || "AI credits have run out. Top up to continue."
      : res.status === 429 ? "AI is busy right now. Please try again in a minute."
      : res.status === 403 ? msg || "AI access is not available for this workspace."
      : msg || `AI is unavailable (${res.status}).`;
    throw new GatewayError(res.status, friendly);
  }
  const json = (await res.json()) as {
    output_text?: string;
    output?: { type?: string; content?: { type?: string; text?: string }[] }[];
  };
  if (json.output_text) return json.output_text;
  const parts: string[] = [];
  for (const item of json.output ?? []) for (const c of item.content ?? []) if (c.text) parts.push(c.text);
  const text = parts.join("\n").trim();
  if (!text) throw new GatewayError(422, "The AI did not return an answer.");
  return text;
}

export function extractJson<T>(raw: string): T {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new GatewayError(422, "The AI answer could not be read.");
  return JSON.parse(m[0]) as T;
}
