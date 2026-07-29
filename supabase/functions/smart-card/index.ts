// smart-card — public endpoint for published Smart Cards.
//
// A Smart Card is a published Lesson Note question. Anyone on the internet can
// open it, solve it on the existing Smartboard and (at 100%) enter the
// leaderboard. No account is required, so this function is intentionally
// public: it only ever exposes data belonging to a PUBLISHED card, and it
// never returns the answer key.
//
// Teacher previews (`preview: true`) run the identical path but are never
// counted in visitors, players or the public leaderboard.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  action: z.enum(["get", "progress", "leaderboard", "dashboard", "presence"]),
  slug: z.string().min(3).max(64),
  participantKey: z.string().min(8).max(64).optional(),
  displayName: z.string().min(1).max(40).optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  state: z.enum(["visitor", "solving"]).optional(),
  preview: z.boolean().optional(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ACTIVE_WINDOW_MS = 90_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, slug, participantKey, displayName, durationMs, state, preview } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: card } = await admin
      .from("smart_cards")
      .select(
        "id, slug, title, presentation, geometry, assessment_id, total_marks, published, publish_mode, topic, subtopic, difficulty, owner_id",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!card || !card.published) return json({ error: "card_not_found" }, 404);

    const leaderboard = async () => {
      const { data } = await admin
        .from("smart_card_attempts")
        .select("display_name, duration_ms, completed_at")
        .eq("card_id", card.id)
        .eq("is_preview", false)
        .order("duration_ms", { ascending: true })
        .limit(50);
      return (data ?? []).map((r) => ({
        displayName: r.display_name,
        durationMs: Number(r.duration_ms ?? 0),
        completedAt: r.completed_at,
      }));
    };

    /** Challenge Dashboard counters — the public replacement for classroom stats. */
    const counters = async () => {
      const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
      const [{ data: presence }, { data: attempts }] = await Promise.all([
        admin
          .from("smart_card_presence")
          .select("participant_key, state, last_seen_at")
          .eq("card_id", card.id)
          .eq("is_preview", false),
        admin
          .from("smart_card_attempts")
          .select("participant_key")
          .eq("card_id", card.id)
          .eq("is_preview", false),
      ]);
      const rows = presence ?? [];
      const solvers = new Set((attempts ?? []).map((r) => r.participant_key));
      const players = new Set(rows.filter((r) => r.state === "solving").map((r) => r.participant_key));
      for (const k of solvers) players.add(k);
      return {
        visitors: rows.length,
        totalPlayers: players.size,
        perfectScores: solvers.size,
        currentlySolving: rows.filter(
          (r) => r.state === "solving" && String(r.last_seen_at ?? "") >= since,
        ).length,
      };
    };

    const publisher = async () => {
      const { data } = await admin
        .from("profiles")
        .select("display_name")
        .eq("user_id", card.owner_id)
        .maybeSingle();
      return (data?.display_name as string | null) ?? "MathGPL Life";
    };

    if (action === "leaderboard") {
      return json({ leaderboard: await leaderboard() });
    }

    if (action === "presence") {
      if (participantKey) {
        await admin.from("smart_card_presence").upsert(
          {
            card_id: card.id,
            participant_key: participantKey,
            display_name: displayName ?? null,
            state: state ?? "visitor",
            is_preview: Boolean(preview),
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "card_id,participant_key" },
        );
      }
      return json({ ok: true, ...(await counters()) });
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

    const publicCard = {
      id: card.id,
      ownerId: card.owner_id,
      slug: card.slug,
      title: card.title,
      presentation: card.presentation,
      geometry: card.geometry,
      totalMarks: Number(card.total_marks ?? 0),
      publishMode: (card.publish_mode as string) ?? "challenge",
      topic: card.topic ?? null,
      subtopic: card.subtopic ?? null,
      difficulty: card.difficulty ?? null,
    };

    if (action === "dashboard") {
      return json({
        card: { ...publicCard, publishedBy: await publisher() },
        assessment,
        leaderboard: await leaderboard(),
        stats: await counters(),
      });
    }

    if (action === "get") {
      return json({ card: publicCard, assessment, leaderboard: await leaderboard() });
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
    const isPreview = Boolean(preview);

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
      const insert = async () => {
        await admin.from("smart_card_attempts").insert({
          card_id: card.id,
          display_name: (displayName ?? "Guest").slice(0, 40),
          participant_key: participantKey,
          percent,
          duration_ms: bestMs,
          is_preview: isPreview,
        });
        recorded = true;
      };
      if (!prior) {
        // Previous qualifying records are never deleted; a repeat run only
        // adds a new record when it is genuinely faster.
        await insert();
      } else {
        const { data: best } = await admin
          .from("smart_card_attempts")
          .select("duration_ms")
          .eq("card_id", card.id)
          .eq("participant_key", participantKey)
          .order("duration_ms", { ascending: true })
          .limit(1);
        const fastest = Number((best ?? [])[0]?.duration_ms ?? Number.MAX_SAFE_INTEGER);
        if (bestMs > 0 && bestMs < fastest) await insert();
      }
    }

    const board = await leaderboard();
    const myBest = board
      .filter((e) => e.displayName === (displayName ?? "Guest"))
      .reduce((min, e) => (min === null || e.durationMs < min ? e.durationMs : min), null as number | null);
    const position = board.findIndex((e) => e.displayName === (displayName ?? "Guest") && e.durationMs === myBest);

    return json({
      score,
      total,
      percent,
      qualified: percent >= 100 && total > 0,
      recorded,
      personalBestMs: myBest,
      position: position >= 0 ? position + 1 : null,
      leaderboard: board,
      stats: await counters(),
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
