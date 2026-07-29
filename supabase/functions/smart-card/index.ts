// smart-card — public endpoint for published Smart Cards.
//
// A Smart Card is a published Lesson Note question. Anyone on the internet can
// open it, solve it on the existing Smartboard and (at 100%) enter the
// leaderboard. No account is required, so this function is intentionally
// public: it only ever exposes data belonging to a PUBLISHED card, and it
// never returns the answer key.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  action: z.enum(["get", "progress", "leaderboard"]),
  slug: z.string().min(3).max(64),
  participantKey: z.string().uuid().optional(),
  displayName: z.string().min(1).max(40).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, slug, participantKey, displayName, durationMs } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: card } = await admin
      .from("smart_cards")
      .select("id, slug, title, presentation, geometry, assessment_id, total_marks, published")
      .eq("slug", slug)
      .maybeSingle();
    if (!card || !card.published) return json({ error: "card_not_found" }, 404);

    const leaderboard = async () => {
      const { data } = await admin
        .from("smart_card_attempts")
        .select("display_name, duration_ms, completed_at")
        .eq("card_id", card.id)
        .order("duration_ms", { ascending: true })
        .limit(50);
      return (data ?? []).map((r) => ({
        displayName: r.display_name,
        durationMs: Number(r.duration_ms ?? 0),
        completedAt: r.completed_at,
      }));
    };

    if (action === "leaderboard") {
      return json({ leaderboard: await leaderboard() });
    }

    // Assessment payload — questions only, never the answer key.
    let assessment: { id: string; title: string; questions: unknown; total_marks: number } | null = null;
    if (card.assessment_id) {
      const { data: a } = await admin
        .from("assessments")
        .select("id, title, questions, total_marks")
        .eq("id", card.assessment_id)
        .maybeSingle();
      if (a) {
        assessment = {
          id: a.id as string,
          title: (a.title as string) ?? card.title,
          questions: a.questions,
          total_marks: Number(a.total_marks ?? 0),
        };
      }
    }

    if (action === "get") {
      return json({
        card: {
          id: card.id,
          slug: card.slug,
          title: card.title,
          presentation: card.presentation,
          geometry: card.geometry,
          totalMarks: Number(card.total_marks ?? 0),
        },
        assessment,
        leaderboard: await leaderboard(),
      });
    }

    // action === "progress"
    if (!participantKey || !assessment) return json({ error: "missing_participant" }, 400);

    const { data: prog } = await admin
      .from("assessment_progress")
      .select("score")
      .eq("assessment_id", assessment.id)
      .eq("student_id", participantKey)
      .maybeSingle();

    const score = Number(prog?.score ?? 0);
    const total = Math.max(0, Number(assessment.total_marks ?? 0));
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    let recorded = false;

    if (percent >= 100 && total > 0) {
      const { data: already } = await admin
        .from("smart_card_attempts")
        .select("id")
        .eq("card_id", card.id)
        .eq("participant_key", participantKey)
        .order("created_at", { ascending: false })
        .limit(1);
      const bestMs = Number(durationMs ?? 0);
      const prior = (already ?? [])[0];
      if (!prior) {
        // Previous qualifying records are never deleted; a repeat run only
        // adds a new record when it is genuinely faster.
        await admin.from("smart_card_attempts").insert({
          card_id: card.id,
          display_name: (displayName ?? "Guest").slice(0, 40),
          participant_key: participantKey,
          percent,
          duration_ms: bestMs,
        });
        recorded = true;
      } else {
        const { data: best } = await admin
          .from("smart_card_attempts")
          .select("duration_ms")
          .eq("card_id", card.id)
          .eq("participant_key", participantKey)
          .order("duration_ms", { ascending: true })
          .limit(1);
        const fastest = Number((best ?? [])[0]?.duration_ms ?? Number.MAX_SAFE_INTEGER);
        if (bestMs > 0 && bestMs < fastest) {
          await admin.from("smart_card_attempts").insert({
            card_id: card.id,
            display_name: (displayName ?? "Guest").slice(0, 40),
            participant_key: participantKey,
            percent,
            duration_ms: bestMs,
          });
          recorded = true;
        }
      }
    }

    return json({
      score,
      total,
      percent,
      qualified: percent >= 100 && total > 0,
      recorded,
      leaderboard: await leaderboard(),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
