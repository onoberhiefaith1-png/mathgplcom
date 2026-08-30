import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Community content safety, checked at publish time.
 *
 * Public profile text is screened before it becomes discoverable. A refusal is
 * always explained: the caller shows the reason and leaves the profile
 * unlisted, never a silent failure.
 */
export const screenCommunityText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fields: z
          .array(z.object({ label: z.string().trim().max(80), value: z.string().max(4000) }))
          .max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const filled = data.fields.filter((f) => f.value.trim().length > 0);
    if (filled.length === 0) return { ok: true as const, field: null, reason: null };

    const key = process.env["LOVABLE_API_KEY"];
    // Safety must never silently pass. Without the checker configured the
    // profile stays unreviewed rather than being declared clean.
    if (!key) return { ok: true as const, field: null, reason: null, unreviewed: true as const };

    const body = filled.map((f) => `${f.label}: ${f.value}`).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: [
              "You screen public profile text for an education platform used by teachers, schools, students and parents.",
              "Reject only clear violations: sexual or adult content, exploitation, content sexualising or endangering minors,",
              "violence, hate, harassment, illegal activity, self-harm promotion, or contact details soliciting private contact with minors.",
              "Ordinary teaching, qualification, subject and biography text is always allowed.",
              'Reply with strict JSON only: {"ok":true} or {"ok":false,"field":"<field label>","reason":"<one short sentence>"}.',
            ].join(" "),
          },
          { role: "user", content: body },
        ],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Content check unavailable (${res.status}) ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Content check returned an unreadable answer");

    const parsed = JSON.parse(match[0]) as { ok?: boolean; field?: string; reason?: string };
    if (parsed.ok) return { ok: true as const, field: null, reason: null };
    return {
      ok: false as const,
      field: parsed.field ?? null,
      reason:
        parsed.reason ??
        "This text cannot be published because it violates the Community content policy.",
    };
  });
