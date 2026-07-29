// smart-card-game — public Adventure play for a Smart Card published as a
// Game Challenge.
//
// The classroom is removed: anyone on the internet gets the real game stage,
// its progress bars and its question boards, identified only by a
// participantKey. Nothing here is reachable unless the card is published in
// "game" mode, and the answer key is never returned.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const BodySchema = z.object({
  action: z.enum(["bundle", "progress", "finalize"]),
  slug: z.string().min(3).max(64),
  participantKey: z.string().min(8).max(64).optional(),
  displayName: z.string().min(1).max(80).optional(),
});


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SIGN_TTL = 60 * 60;
const BUCKET = "game-assets";

/** Every private storage path referenced anywhere in the game canvas. */
const assetPaths = (canvas: unknown): string[] => {
  const out = new Set<string>();
  const scenes = (canvas as any)?.scenes ?? [];
  for (const scene of scenes) {
    for (const el of scene?.elements ?? []) {
      if (el?.source !== "url" && el?.storagePath) out.add(el.storagePath);
      const p = el?.progress;
      if (!p) continue;
      if (p.effectSource !== "url" && p.effectStoragePath) out.add(p.effectStoragePath);
      for (const slot of Object.values(p.slotEffects ?? {}) as any[]) {
        if (slot?.effectSource !== "url" && slot?.effectStoragePath) out.add(slot.effectStoragePath);
      }
    }
  }
  return [...out];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { action, slug, participantKey, displayName } = parsed.data;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: card } = await admin
      .from("smart_cards")
      .select(
        "id, slug, title, published, publish_mode, game_id, class_id, assessment_id, total_marks, pass_mark_pct, game_progress_element_id",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (!card || !card.published || card.publish_mode !== "game" || !card.game_id || !card.class_id) {
      return json({ error: "game_challenge_not_found" }, 404);
    }

    const passPct = Math.max(1, Math.min(100, Number(card.pass_mark_pct ?? 100)));
    const totalMarks = Number(card.total_marks ?? 0);
    const requiredMarks = Math.max(1, Math.round((totalMarks * passPct) / 100));

    // Boards: only the progress bars a teacher explicitly mapped to a card.
    const { data: boardRows } = await admin
      .from("class_game_boards")
      .select("progress_element_id, assessment_id")
      .eq("class_id", card.class_id)
      .eq("game_id", card.game_id);
    const assessmentIds = (boardRows ?? []).map((r) => r.assessment_id as string);

    // The event countdown bar (bar 1) — never a question bar.
    const { data: timeBar } = await admin
      .from("game_time_bars")
      .select("progress_element_id, duration_seconds, started_at, paused_at, accumulated_paused_ms")
      .eq("game_id", card.game_id)
      .maybeSingle();

    const timerExpired = (): boolean => {
      if (!timeBar?.started_at) return false;
      const start = new Date(timeBar.started_at as string).getTime();
      const end = timeBar.paused_at ? new Date(timeBar.paused_at as string).getTime() : Date.now();
      const elapsed = end - start - (Number(timeBar.accumulated_paused_ms) || 0);
      return elapsed >= Number(timeBar.duration_seconds ?? 0) * 1000;
    };

    if (action === "progress") {
      if (!participantKey) return json({ error: "missing_participant" }, 400);
      const { data: rows } = await admin
        .from("assessment_progress")
        .select("assessment_id, score, solved_lines")
        .eq("student_id", participantKey)
        .in("assessment_id", assessmentIds.length ? assessmentIds : ["00000000-0000-0000-0000-000000000000"]);
      const scores: Record<string, number> = {};
      const solved: Record<string, unknown> = {};
      for (const r of rows ?? []) {
        scores[r.assessment_id as string] = Number(r.score ?? 0);
        solved[r.assessment_id as string] = r.solved_lines ?? {};
      }

      // Every player owns their own run — no class averaging here.
      const myScore = card.assessment_id ? Number(scores[card.assessment_id as string] ?? 0) : 0;
      const { data: existing } = await admin
        .from("smart_card_game_results")
        .select("id, started_at, qualified_at, completion_ms, score")
        .eq("card_id", card.id)
        .eq("participant_key", participantKey)
        .maybeSingle();

      const startedAt = (existing?.started_at as string) ?? new Date().toISOString();
      let qualifiedAt = (existing?.qualified_at as string | null) ?? null;
      let completionMs = (existing?.completion_ms as number | null) ?? null;
      if (!qualifiedAt && myScore >= requiredMarks) {
        qualifiedAt = new Date().toISOString();
        completionMs = Math.max(0, new Date(qualifiedAt).getTime() - new Date(startedAt).getTime());
      }

      await admin.from("smart_card_game_results").upsert(
        {
          card_id: card.id,
          participant_key: participantKey,
          display_name: displayName ?? null,
          score: myScore,
          required_marks: requiredMarks,
          started_at: startedAt,
          qualified_at: qualifiedAt,
          completion_ms: completionMs,
        },
        { onConflict: "card_id,participant_key" },
      );

      return json({
        scores,
        solved,
        requiredMarks,
        passMarkPct: passPct,
        qualified: !!qualifiedAt,
        completionMs,
        timerExpired: timerExpired(),
      });
    }

    if (action === "finalize") {
      if (!timerExpired()) return json({ finalized: false, reason: "timer_running" });
      const { data: results } = await admin
        .from("smart_card_game_results")
        .select("id, participant_key, display_name, completion_ms, qualified_at")
        .eq("card_id", card.id)
        .not("qualified_at", "is", null);
      const qualified = (results ?? []).filter((r) => r.completion_ms != null);
      if (qualified.length === 0) return json({ finalized: true, winners: [] });
      const best = Math.min(...qualified.map((r) => Number(r.completion_ms)));
      const winners = qualified.filter((r) => Number(r.completion_ms) === best);
      await admin
        .from("smart_card_game_results")
        .update({ is_winner: true, rewarded_at: new Date().toISOString() })
        .in("id", winners.map((w) => w.id));
      return json({
        finalized: true,
        winners: winners.map((w) => ({
          participantKey: w.participant_key,
          displayName: w.display_name,
          completionMs: Number(w.completion_ms),
        })),
      });
    }

    const { data: game } = await admin
      .from("games")
      .select("id, title, canvas, thumbnail_path")
      .eq("id", card.game_id)
      .maybeSingle();
    if (!game) return json({ error: "game_not_found" }, 404);

    const { data: assessments } = await admin
      .from("assessments")
      .select("id, title, total_marks, questions, unassigned_at")
      .in("id", assessmentIds.length ? assessmentIds : ["00000000-0000-0000-0000-000000000000"])
      .is("unassigned_at", null);
    const byId = new Map((assessments ?? []).map((a) => [a.id as string, a]));

    const boards = (boardRows ?? [])
      .map((r) => {
        const a = byId.get(r.assessment_id as string);
        if (!a) return null;
        return {
          progressElementId: r.progress_element_id,
          assessmentId: r.assessment_id,
          title: (a.title as string) ?? "Questions",
          totalMarks: Number(a.total_marks ?? 0),
          questions: a.questions ?? [],
        };
      })
      .filter(Boolean);

    // Signed URLs so the public stage renders the same private art the class
    // version shows. Short-lived, read-only, per request.
    const urls: Record<string, string> = {};
    await Promise.all(
      assetPaths(game.canvas).map(async (path) => {
        const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
        if (data?.signedUrl) urls[path] = data.signedUrl;
      }),
    );

    return json({
      card: {
        id: card.id,
        slug: card.slug,
        title: card.title,
        assessmentId: card.assessment_id,
        passMarkPct: passPct,
        requiredMarks,
        totalMarks,
        questionElementId: card.game_progress_element_id,
      },
      game: { id: game.id, title: game.title, canvas: game.canvas },
      timeBar: timeBar
        ? {
            progressElementId: timeBar.progress_element_id,
            durationSeconds: Number(timeBar.duration_seconds ?? 0),
            startedAt: timeBar.started_at,
            pausedAt: timeBar.paused_at,
            accumulatedPausedMs: Number(timeBar.accumulated_paused_ms ?? 0),
            expired: timerExpired(),
          }
        : null,
      boards,
      urls,
    });

  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
