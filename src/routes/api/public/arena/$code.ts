/**
 * Timer Arena — public surface for ONE participation group.
 *
 * The student code (`TA…`) lets a device join, time and read its own position.
 * The display code (`TD…`) is read-only: champions and Top 5 only.
 * Every query is scoped to the single share the code resolves to, so two
 * teachers' groups on the same Session never mix.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  cleanDisplayName, isStrictlyFaster, myPosition, normaliseEntry, rankBests, verifiedElapsed,
  ARENA_AVATARS, type ArenaBest,
} from "@/lib/arena/ranking";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type Admin = { from: (t: string) => any };

const loadShare = async (admin: Admin, code: string) => {
  const col = code.startsWith("TD") ? "display_code" : "code";
  const { data } = await admin
    .from("arena_shares")
    .select("id, code, display_code, source_id, guest_code, title, entry_config, status, created_at")
    .eq(col, code)
    .maybeSingle();
  return data ? { ...data, isDisplay: col === "display_code" } : null;
};

/** The Session's question cards in Session order, plus the breadcrumb. */
const loadQuestions = async (admin: Admin, sessionId: string) => {
  const { data: session } = await admin.from("academia_sessions").select("id, title, subtopic_id").eq("id", sessionId).maybeSingle();
  const { data: rows } = await admin
    .from("academia_activities")
    .select("id, title, assessment_id, position")
    .eq("session_id", sessionId)
    .eq("kind", "question")
    .order("position");
  const questions = (rows ?? [])
    .filter((r: any) => r.assessment_id)
    .map((r: any, i: number) => ({ number: i + 1, activityId: r.id, assessmentId: r.assessment_id as string, title: r.title as string }));
  const crumbs: Record<string, string | null> = { school: null, class: null, subject: null, topic: null, subtopic: null };
  try {
    const { data: st } = await admin.from("academia_subtopics").select("name, topic_id").eq("id", session?.subtopic_id).maybeSingle();
    crumbs["subtopic"] = st?.name ?? null;
    const { data: tp } = await admin.from("academia_topics").select("name, subject_id").eq("id", st?.topic_id).maybeSingle();
    crumbs["topic"] = tp?.name ?? null;
    const { data: sj } = await admin.from("academia_subjects").select("name, class_id").eq("id", tp?.subject_id).maybeSingle();
    crumbs["subject"] = sj?.name ?? null;
    const { data: cl } = await admin.from("academia_classes").select("name, academia_id").eq("id", sj?.class_id).maybeSingle();
    crumbs["class"] = cl?.name ?? null;
    const { data: ac } = await admin.from("academia").select("name").eq("id", cl?.academia_id).maybeSingle();
    crumbs["school"] = ac?.name ?? null;
  } catch { /* breadcrumb is decoration */ }
  return { sessionTitle: (session?.title as string) ?? "Session", questions, crumbs };
};

const toBest = (r: any): ArenaBest => ({
  participantId: r.participant_id, bestMs: Number(r.best_ms), achievedAt: r.achieved_at, attemptId: r.attempt_id,
});

const ONLINE_MS = 60_000;

const snapshot = async (admin: Admin, share: any) => {
  const meta = await loadQuestions(admin, share.source_id);
  const [{ data: bests }, { data: people }] = await Promise.all([
    admin.from("arena_bests").select("participant_id, assessment_id, best_ms, achieved_at, attempt_id").eq("share_id", share.id).limit(50000),
    admin.from("arena_participants").select("id, display_name, anon_label, avatar_key, last_seen_at").eq("share_id", share.id).limit(50000),
  ]);
  const byId = new Map<string, any>((people ?? []).map((p: any) => [p.id, p]));
  const now = Date.now();
  const online = (people ?? []).filter((p: any) => now - Date.parse(p.last_seen_at) < ONLINE_MS).length;
  const columns = meta.questions.map((q) => {
    const sorted = rankBests((bests ?? []).filter((b: any) => b.assessment_id === q.assessmentId).map(toBest));
    return {
      ...q,
      rankedCount: sorted.length,
      top: sorted.slice(0, 5).map((b, i) => {
        const p = byId.get(b.participantId);
        return { place: i + 1, name: p?.display_name || p?.anon_label || "Learner", avatar: p?.avatar_key ?? null, ms: b.bestMs };
      }),
    };
  });
  const ranked = new Set((bests ?? []).map((b: any) => b.participant_id)).size;
  return {
    title: share.title, status: share.status, sessionTitle: meta.sessionTitle, crumbs: meta.crumbs,
    joined: (people ?? []).length, online, rankedParticipants: ranked, columns,
  };
};

/** Best-effort live nudge so open reports re-read their snapshot. */
const broadcast = async (shareId: string, assessmentId: string) => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return;
  const headers: Record<string, string> = { "Content-Type": "application/json", apikey: key };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages: [{ topic: `arena:${shareId}`, event: "update", payload: { assessmentId } }] }),
    });
  } catch { /* the report also re-reads on reconnect */ }
};

const Body = z.object({
  action: z.enum(["join", "start", "complete", "beat"]),
  token: z.string().uuid(),
  name: z.string().max(40).nullish(),
  avatar: z.string().max(20).nullish(),
  assessmentId: z.string().uuid().optional(),
  questionId: z.string().max(64).optional(),
  elapsedMs: z.number().min(0).max(86_400_000).optional(),
});

export const Route = createFileRoute("/api/public/arena/$code")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as never as Admin;
        const code = String(params.code ?? "").trim().toUpperCase();
        if (!/^T[AD][A-Z0-9]{8,16}$/.test(code)) return json({ error: "not_found" }, 404);
        const share = await loadShare(admin, code);
        if (!share) return json({ error: "not_found" }, 404);
        const action = new URL(request.url).searchParams.get("action") ?? "info";

        if (action === "info" && !share.isDisplay) {
          return json({
            shareId: share.id, title: share.title, status: share.status, guestCode: share.guest_code,
            entry: normaliseEntry(share.entry_config), avatars: ARENA_AVATARS.map((a) => a.key),
          });
        }
        if (action === "board") return json({ shareId: share.id, ...(await snapshot(admin, share)) });

        if (action === "me" && !share.isDisplay) {
          const token = new URL(request.url).searchParams.get("token") ?? "";
          const assessmentId = new URL(request.url).searchParams.get("assessmentId") ?? "";
          if (!z.string().uuid().safeParse(token).success || !z.string().uuid().safeParse(assessmentId).success) return json({ error: "bad_request" }, 400);
          const { data: me } = await admin.from("arena_participants").select("id, display_name, anon_label").eq("share_id", share.id).eq("device_token", token).maybeSingle();
          const [{ data: rows }, { count: joined }] = await Promise.all([
            admin.from("arena_bests").select("participant_id, best_ms, achieved_at, attempt_id").eq("share_id", share.id).eq("assessment_id", assessmentId).limit(50000),
            admin.from("arena_participants").select("id", { count: "exact", head: true }).eq("share_id", share.id),
          ]);
          const sorted = rankBests((rows ?? []).map(toBest));
          const mine = me ? sorted.find((b) => b.participantId === me.id) : undefined;
          return json({
            joined: joined ?? 0,
            myBestMs: mine?.bestMs ?? null,
            overallBestMs: sorted[0]?.bestMs ?? null,
            position: me ? myPosition(sorted, me.id) : { ranked: false, rankedCount: sorted.length },
          });
        }
        return json({ error: "bad_request" }, 400);
      },

      POST: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as never as Admin;
        const code = String(params.code ?? "").trim().toUpperCase();
        if (!/^TA[A-Z0-9]{8,16}$/.test(code)) return json({ error: "not_found" }, 404);
        const share = await loadShare(admin, code);
        if (!share) return json({ error: "not_found" }, 404);
        if (share.status !== "open") return json({ error: "closed" }, 403);
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "bad_request" }, 400);
        const body = parsed.data;
        const entry = normaliseEntry(share.entry_config);

        const { data: existing } = await admin
          .from("arena_participants")
          .select("id, anon_label, display_name, avatar_key")
          .eq("share_id", share.id)
          .eq("device_token", body.token)
          .maybeSingle();

        if (body.action === "join") {
          let displayName: string | null = null;
          if (entry.name !== "off" && body.name) {
            displayName = cleanDisplayName(body.name);
            if (!displayName) return json({ error: "name_rejected" }, 422);
          }
          if (entry.name === "required" && !displayName) return json({ error: "name_required" }, 422);
          const avatar = entry.photo !== "off" && ARENA_AVATARS.some((a) => a.key === body.avatar) ? body.avatar! : null;
          if (entry.photo === "required" && !avatar) return json({ error: "avatar_required" }, 422);
          if (existing) {
            // Changing name or picture never touches earlier times.
            await admin.from("arena_participants").update({
              display_name: displayName ?? existing.display_name, avatar_key: avatar ?? existing.avatar_key,
              last_seen_at: new Date().toISOString(),
            }).eq("id", existing.id);
            return json({ participantId: existing.id, anonLabel: existing.anon_label });
          }
          for (let i = 0; i < 6; i++) {
            const label = `Learner-${1000 + Math.floor(Math.random() * 9000)}`;
            const { data: row, error } = await admin.from("arena_participants").insert({
              share_id: share.id, device_token: body.token, display_name: displayName, anon_label: label, avatar_key: avatar,
            }).select("id, anon_label").maybeSingle();
            if (row) return json({ participantId: row.id, anonLabel: row.anon_label });
            if (!/duplicate/i.test(error?.message ?? "")) break;
          }
          return json({ error: "join_failed" }, 500);
        }

        if (!existing) return json({ error: "not_joined" }, 403);
        await admin.from("arena_participants").update({ last_seen_at: new Date().toISOString() }).eq("id", existing.id);
        if (body.action === "beat") return json({ ok: true });
        if (!body.assessmentId) return json({ error: "bad_request" }, 400);

        // The question must belong to this group's Session.
        const { data: act } = await admin.from("academia_activities").select("id")
          .eq("session_id", share.source_id).eq("assessment_id", body.assessmentId).limit(1).maybeSingle();
        if (!act) return json({ error: "not_in_session" }, 403);
        const questionId = body.questionId ?? body.assessmentId;

        const { data: open } = await admin.from("arena_attempts").select("id, started_at")
          .eq("participant_id", existing.id).eq("assessment_id", body.assessmentId).is("completed_at", null)
          .order("started_at", { ascending: false }).limit(1).maybeSingle();

        if (body.action === "start") {
          if (!open) {
            await admin.from("arena_attempts").insert({
              share_id: share.id, participant_id: existing.id, assessment_id: body.assessmentId, question_id: questionId,
            });
          }
          return json({ ok: true });
        }

        // complete — only a fully correct, server-marked sitting counts.
        if (!open) return json({ error: "no_open_attempt" }, 409);
        const { data: link } = await admin.from("guest_links").select("id").eq("code", share.guest_code).maybeSingle();
        const { data: marked } = link
          ? await admin.from("guest_attempts").select("score, total_marks").eq("link_id", link.id)
              .eq("guest_token", body.token).eq("assessment_id", body.assessmentId).maybeSingle()
          : { data: null };
        const total = Number(marked?.total_marks) || 0;
        const fullyCorrect = total > 0 && Number(marked?.score) >= total;
        // Marking may land a moment after the board's own tick: keep the
        // attempt open so the device can retry; nothing is counted yet.
        if (!fullyCorrect) return json({ ok: true, counted: false, pending: true });
        const nowIso = new Date().toISOString();
        const serverMs = Date.now() - Date.parse(open.started_at);
        const elapsed = verifiedElapsed(body.elapsedMs ?? 0, serverMs);
        await admin.from("arena_attempts").update({
          completed_at: nowIso, elapsed_ms: elapsed, success: elapsed != null,
        }).eq("id", open.id);
        if (elapsed == null) return json({ ok: true, counted: false });

        const { data: prev } = await admin.from("arena_bests").select("best_ms")
          .eq("share_id", share.id).eq("participant_id", existing.id).eq("assessment_id", body.assessmentId).eq("question_id", questionId).maybeSingle();
        if (isStrictlyFaster(prev ? Number(prev.best_ms) : null, elapsed)) {
          await admin.from("arena_bests").upsert({
            share_id: share.id, participant_id: existing.id, assessment_id: body.assessmentId, question_id: questionId,
            best_ms: elapsed, achieved_at: nowIso, attempt_id: open.id,
          }, { onConflict: "share_id,participant_id,assessment_id,question_id" });
          await broadcast(share.id, body.assessmentId);
          return json({ ok: true, counted: true, newBest: true, ms: elapsed });
        }
        return json({ ok: true, counted: true, newBest: false, ms: elapsed });
      },
    },
  },
});
