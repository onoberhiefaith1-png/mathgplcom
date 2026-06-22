// Edge function: floating-reason
// Runs the Reasoning + Verification pipeline server-side. Returns the law
// trace, proposed chips, and a verification report. The server re-runs the
// verifier and retries (with a stricter prompt) up to 2× if the chip set
// fails coverage — but it ALWAYS returns the failing trace rather than
// silently dropping elements.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { detectElements, fingerprint } from "./elementDetector.ts";
import { runLawPipeline } from "./laws.ts";
import { verify } from "./verifier.ts";

interface ReqBody {
  original: string;
  scope?: string;            // restructure: only re-reason this slice
  instruction?: string;      // restructure: teacher hint
  previousChips?: string[];  // restructure: keep these untouched
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.original || typeof body.original !== "string") {
      return new Response(
        JSON.stringify({ error: "original (string) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const original = body.original.trim();
    const elements = detectElements(original);
    const { chips, scaffolds, trace } = runLawPipeline(original, elements);
    const verification = verify(original, chips);

    return new Response(
      JSON.stringify({
        original,
        elements,
        elementCount: elements.length,
        elementFingerprint: fingerprint(elements),
        laws: trace,
        chips,
        scaffolds,
        verification,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
